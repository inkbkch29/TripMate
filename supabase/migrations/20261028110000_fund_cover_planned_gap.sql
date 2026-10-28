CREATE OR REPLACE FUNCTION public.trip_fund_action(target_trip uuid, action text, payload jsonb, request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
<<fund_op>>
declare prior public.trip_fund_requests;c public.collections;e public.expenses;t public.trip_fund_transactions;s public.trip_fund_settlements;r public.trip_fund_refunds;cid uuid;eid uuid;uid uuid;holder uuid;amount bigint;bal bigint;total bigint;rounding bigint;weights jsonb;alloc jsonb;extra jsonb;row record;policy text;note text;result jsonb;available bigint;
begin
 if not public.trip_fund_manager(target_trip) then raise insufficient_privilege using message='เฉพาะเจ้าของทริปหรือเหรัญญิก';end if;
 if request_id is null then raise exception 'ต้องมีรหัสป้องกันรายการซ้ำ';end if;
 perform public.trip_fund_lock(target_trip);
 select * into prior from public.trip_fund_requests q where q.trip_id=target_trip and q.request_id=trip_fund_action.request_id;
 if prior.request_id is not null then if prior.action<>action or prior.payload<>payload then raise exception 'รหัสนี้ใช้กับรายการอื่นแล้ว';end if;return public.trip_fund_snapshot(target_trip);end if;
 perform set_config('tripmate.fund_write','yes',true);
 holder:=nullif(payload->>'custodian_id','')::uuid;note:=coalesce(payload->>'note','');
 if holder is not null and not exists(select 1 from public.trip_members where trip_id=target_trip and user_id=holder) then raise exception 'ผู้ถือเงินต้องเป็นสมาชิกในทริป';end if;
 if action not in ('refund_confirm','settlement_cancel','reverse') and exists(select 1 from public.trip_fund_settlements where trip_id=target_trip and status<>'cancelled') then raise exception 'กองกลางปิดรับรายการระหว่างสรุปคืนเงิน';end if;
 if action='contribution' then
  -- Receiving settings are captured by the collection trigger.
  if holder is null or trim(coalesce(payload->>'title',''))='' or jsonb_typeof(payload->'amounts')<>'object' then raise exception 'กรอกรายการ ผู้ถือเงิน และยอดสมาชิก';end if;
  select sum(value::bigint) into total from jsonb_each_text(payload->'amounts');
  if total is null or total<=0 or exists(select 1 from jsonb_each_text(payload->'amounts')x where x.value!~'^\d+$' or x.value::numeric<=0 or x.value::numeric>1000000000000 or not exists(select 1 from public.trip_members m where m.trip_id=target_trip and m.user_id::text=x.key)) then raise exception 'ยอดสมทบหรือสมาชิกไม่ถูกต้อง';end if;
  insert into public.collections(id,trip_id,title,amount,original_amount,fund_remainder,is_fund,receiver_id,due_date,created_by,fund_request_key,fund_account_label)
  values(coalesce((payload->>'collection_id')::uuid,gen_random_uuid()),target_trip,payload->>'title',total/100.0,total/100.0,total/100.0,true,holder,nullif(payload->>'date','')::date,auth.uid(),request_id,nullif(trim(payload->>'account_label'),'')) returning id into cid;
  insert into public.collection_payments(collection_id,user_id,amount,status) select cid,key::uuid,value::bigint/100.0,'unpaid' from jsonb_each_text(payload->'amounts');
 elsif action='confirm_receipt' then
  select * into c from public.collections where id=(payload->>'collection_id')::uuid and trip_id=target_trip and is_fund;
  if c.id is null then raise exception 'ไม่พบเงินสมทบ';end if;
  perform public.confirm_collection_received(c.id,(payload->>'member_id')::uuid,(payload->>'amount_satang')::bigint/100.0);
 elsif action='rounding' then
  select * into c from public.collections where id=(payload->>'collection_id')::uuid and trip_id=target_trip;
  select available_satang into amount from public.trip_fund_rounding(target_trip) where collection_id=c.id;
  if amount is null or amount<=0 or amount is distinct from (payload->>'amount_satang')::bigint or holder is distinct from c.receiver_id then raise exception 'ส่วนเกินต้องรับครบจริงและยอดตรงกับปัจจุบัน';end if;
  insert into public.trip_fund_transactions(trip_id,type,amount_satang,description,recorded_by,custodian_id,collection_id,expense_id,note,source_key)
  values(target_trip,'rounding',amount,'ส่วนเกินจากการหาร · '||c.title,auth.uid(),holder,c.id,case when c.installment_id is null then c.expense_id else (select parent_expense_id from public.expense_installments where id=c.installment_id) end,note,'rounding:'||request_id);
 elsif action in ('expense','adjustment') then
  if coalesce(payload->>'amount_satang','')!~'^-?\d+$' then raise exception 'จำนวนเงินต้องเป็นสตางค์เต็ม';end if;
  amount:=(payload->>'amount_satang')::bigint;
  if holder is null or amount=0 or abs(amount)>1000000000000 or trim(coalesce(payload->>'title',''))='' then raise exception 'กรอกข้อมูลให้ครบ';end if;
  if action='expense' and amount<0 then raise exception 'ยอดจ่ายต้องเป็นบวก';end if;
  if action='adjustment' and (length(trim(note))<5 or not exists(select 1 from public.trips where id=target_trip and owner_id=auth.uid())) then raise insufficient_privilege using message='เจ้าของทริปต้องระบุเหตุผลปรับยอดจริง';end if;
  if action='expense' then amount:=-amount;end if;
  bal:=public.trip_fund_balance(target_trip,holder);if bal+amount<0 then raise exception 'ยอดเงินที่ผู้ถือเงินคนนี้ไม่พอ';end if;
  eid:=nullif(payload->>'expense_id','')::uuid;cid:=nullif(payload->>'collection_id','')::uuid;
  if eid is not null and cid is not null then raise exception 'เชื่อมโยงได้ครั้งละหนึ่งรายการ';end if;
  if action='adjustment' and (eid is not null or cid is not null) then raise exception 'ปรับยอดต้องไม่เปลี่ยนบิล';end if;
  if action='expense' and eid is not null then
   select * into e from public.expenses where id=eid and trip_id=target_trip and approval_status='approved' for update;
   if e.id is null or exists(select 1 from public.collections where expense_id=eid) or exists(select 1 from public.trip_settlements where trip_id=target_trip and status in ('pending','confirmed')) then raise exception 'บิลนี้มีการเรียกเก็บหรือปิดยอดแล้ว ให้ใช้รายการเชื่อมโยงที่ยังไม่ชำระ';end if;
   if e.fund_paid_satang-amount>e.amount*100 then raise exception 'จ่ายจากกองกลางเกินบิลจริง';end if;
   update public.expenses set fund_paid_satang=fund_paid_satang-fund_op.amount where id=eid;
  elsif action='expense' and cid is not null then
   select * into c from public.collections where id=cid and trip_id=target_trip and not is_fund for update;
   select coalesce(sum(cash_satang),0) into total from public.installment_cash_receipts where collection_id=cid;
   select coalesce(-sum(amount_satang),0) into available from public.trip_fund_transactions where collection_id=cid and type in ('expense','reversal');
   if c.id is null then raise exception 'ไม่พบรายการเรียกเก็บ';end if;
   if exists(select 1 from public.installment_cash_receipts where collection_id=cid and installment_superseded_at is null and (status<>'paid' or cash_satang is null)) then
    -- Before collection completes, cover only the gap beyond all active requests.
    -- Never spend the fund on money still owed by members.
    select greatest(total,coalesce(sum(cp.amount*100),0)::bigint) into total from public.collection_payments cp where cp.collection_id=cid and cp.installment_superseded_at is null;
   end if;
   if -amount>public.collection_bill_satang(c.id)-total-available then raise exception 'ใช้กองกลางได้ไม่เกินส่วนขาด หลังหักยอดเรียกเก็บและเงินที่ใช้แล้ว';end if;
  elsif action='expense' then
   insert into public.expenses(trip_id,title,amount,paid_by,created_by,expense_date,approval_status,fund_paid_satang,fund_only)
   values(target_trip,payload->>'title',-amount/100.0,holder,auth.uid(),coalesce(nullif(payload->>'date','')::date,current_date),'approved',-amount,true) returning id into eid;
  end if;
  if cid is not null and action='expense' then select i.parent_expense_id into eid from public.collections co join public.expense_installments i on i.id=co.installment_id where co.id=cid;end if;
  insert into public.trip_fund_transactions(trip_id,type,amount_satang,description,occurred_on,recorded_by,custodian_id,expense_id,collection_id,note,source_key)
  values(target_trip,action,amount,payload->>'title',coalesce(nullif(payload->>'date','')::date,current_date),auth.uid(),holder,eid,cid,note,action||':'||request_id);
 elsif action='transfer' then
  uid:=(payload->>'to_custodian')::uuid;amount:=(payload->>'amount_satang')::bigint;
  if holder is null or uid=holder or amount<=0 or not exists(select 1 from public.trip_members where trip_id=target_trip and user_id=uid) or public.trip_fund_balance(target_trip,holder)<amount or length(trim(note))<5 then raise exception 'ระบุผู้ถือเงินใหม่ ยอดเงินจริง และบันทึกส่งมอบ';end if;
  insert into public.trip_fund_transactions(trip_id,type,amount_satang,description,recorded_by,custodian_id,note,source_key) values
  (target_trip,'adjustment',-amount,'ส่งมอบเงินกองกลาง',auth.uid(),holder,note,'transfer-out:'||request_id),
  (target_trip,'adjustment',amount,'รับมอบเงินกองกลาง',auth.uid(),uid,note,'transfer-in:'||request_id);
 elsif action='settlement' then
  if not exists(select 1 from public.trips where id=target_trip and (status='completed' or end_date<(now() at time zone 'Asia/Bangkok')::date)) then raise exception 'สรุปคืนเงินได้เมื่อทริปจบแล้ว';end if;
  if (public.trip_fund_snapshot(target_trip)->>'unresolved_count')::int>0 and length(trim(note))<5 then raise exception 'ยังมีเงินสมทบหรือส่วนเกินรอจัดสรร ต้องระบุการกระทบยอดที่อนุมัติ';end if;
  bal:=public.trip_fund_balance(target_trip);policy:=payload->>'policy';
  if holder is null or public.trip_fund_balance(target_trip,holder)<>bal then raise exception 'ต้องรวมเงินจริงไว้ที่ผู้ถือเงินที่ระบุก่อนสรุปคืน';end if;
  if policy not in ('proportional','equal','carry') or payload->>'surplus_policy' not in ('contributors','equal') then raise exception 'เลือกนโยบายคืนเงินและเจ้าของส่วนเกิน';end if;
  if policy='carry' and length(trim(note))<5 then raise exception 'ระบุการอนุมัติยกยอดและผู้ถือเงิน';end if;
  select coalesce(jsonb_object_agg(member_id,paid),'{}') into weights from(select txrow.member_id,sum(txrow.amount_satang) as paid from public.trip_fund_transactions txrow where txrow.trip_id=target_trip and txrow.type='deposit' and not exists(select 1 from public.trip_fund_transactions x where x.reversal_of=txrow.id) group by txrow.member_id having sum(txrow.amount_satang)>0)x;
  if policy='equal' then select coalesce(jsonb_object_agg(x,1),'{}') into weights from jsonb_object_keys(payload->'eligible')x where exists(select 1 from public.trip_members where trip_id=target_trip and user_id::text=x);end if;
  if policy<>'carry' and weights='{}' then raise exception 'เลือกสมาชิกที่รับเงินคืนได้';end if;
  if policy='proportional' and payload->>'surplus_policy'='equal' then
   select coalesce(sum(amount_satang),0) into rounding from public.trip_fund_transactions where trip_id=target_trip and type='rounding' and not exists(select 1 from public.trip_fund_transactions x where x.reversal_of=trip_fund_transactions.id);
   rounding:=least(bal,rounding);alloc:=public.trip_fund_allocate(bal-rounding,weights);
   select jsonb_object_agg(key,1) into extra from jsonb_each(weights);extra:=public.trip_fund_allocate(rounding,extra);
   select jsonb_object_agg(a.key,a.value::bigint+coalesce((extra->>a.key)::bigint,0)) into alloc from jsonb_each_text(alloc)a;
  elsif policy<>'carry' then alloc:=public.trip_fund_allocate(bal,weights);end if;
  insert into public.trip_fund_settlements(trip_id,policy,surplus_policy,balance_satang,custodian_id,reconciliation_note,created_by,status,completed_at)
  values(target_trip,policy,payload->>'surplus_policy',bal,holder,note,auth.uid(),case when policy='carry' or bal=0 then 'completed' else 'pending' end,case when policy='carry' or bal=0 then now() end) returning id into uid;
  if policy<>'carry' then insert into public.trip_fund_refunds(settlement_id,trip_id,member_id,amount_satang) select uid,target_trip,key::uuid,value::bigint from jsonb_each_text(alloc) where value::bigint>0;end if;
 elsif action='refund_confirm' then
  select * into r from public.trip_fund_refunds where id=(payload->>'refund_id')::uuid and trip_id=target_trip for update;
  select * into s from public.trip_fund_settlements where id=r.settlement_id and status='pending';
  if r.id is null or s.id is null then raise exception 'ไม่พบรายการคืนเงินรอดำเนินการ';end if;
  if r.status<>'completed' then
   if public.trip_fund_balance(target_trip,s.custodian_id)<r.amount_satang then raise exception 'เงินไม่พอคืน';end if;
   insert into public.trip_fund_transactions(trip_id,type,amount_satang,description,recorded_by,custodian_id,member_id,source_key,note) values(target_trip,'refund',-r.amount_satang,'คืนเงินกองกลาง',auth.uid(),s.custodian_id,r.member_id,'refund:'||r.id||':'||request_id,note) returning id into uid;
   update public.trip_fund_refunds set status='completed',transaction_id=uid where id=r.id;
   if not exists(select 1 from public.trip_fund_refunds where settlement_id=s.id and status='pending') then update public.trip_fund_settlements set status='completed',completed_at=now() where id=s.id;end if;
  end if;
 elsif action='settlement_cancel' then
  select * into s from public.trip_fund_settlements where id=(payload->>'settlement_id')::uuid and trip_id=target_trip;
  if s.id is null or exists(select 1 from public.trip_fund_refunds where settlement_id=s.id and status='completed') then raise exception 'มีการคืนเงินจริงแล้ว ต้องกลับบัญชีก่อน';end if;
  update public.trip_fund_settlements set status='cancelled' where id=s.id;
 elsif action='reverse' then
  select * into t from public.trip_fund_transactions where id=(payload->>'transaction_id')::uuid and trip_id=target_trip;
  if t.source_key like 'transfer-%' then raise exception 'ใช้ส่งมอบกลับเพื่อแก้การย้ายผู้ถือเงิน';end if;
  if t.id is null or t.type='reversal' or length(trim(note))<5 then raise exception 'ระบุรายการต้นทางและเหตุผลกลับบัญชี';end if;
  if t.type<>'refund' and exists(select 1 from public.trip_fund_settlements where trip_id=target_trip and status<>'cancelled') then raise exception 'ยกเลิกแผนคืนเงินก่อนกลับบัญชี';end if;
  if public.trip_fund_balance(target_trip,t.custodian_id)-t.amount_satang<0 then raise exception 'เงินไม่พอกลับบัญชี';end if;
  insert into public.trip_fund_transactions(trip_id,type,amount_satang,description,recorded_by,custodian_id,member_id,collection_id,expense_id,reversal_of,note,source_key)
  values(target_trip,'reversal',-t.amount_satang,'กลับบัญชี · '||t.description,auth.uid(),t.custodian_id,t.member_id,t.collection_id,t.expense_id,t.id,note,'reverse:'||t.id);
  if t.type='refund' then update public.trip_fund_refunds set status='pending',transaction_id=null where transaction_id=t.id returning settlement_id into uid;update public.trip_fund_settlements set status='pending',completed_at=null where id=uid;end if;
  if t.type='expense' and t.expense_id is not null and t.collection_id is null then update public.expenses set fund_paid_satang=fund_paid_satang+t.amount_satang where id=t.expense_id;end if;
 else raise exception 'ไม่รองรับการทำรายการนี้';end if;
 insert into public.trip_fund_requests(trip_id,request_id,action,payload) values(target_trip,request_id,action,payload);
 perform set_config('tripmate.fund_write','no',true);
 return public.trip_fund_snapshot(target_trip);
end $function$;
