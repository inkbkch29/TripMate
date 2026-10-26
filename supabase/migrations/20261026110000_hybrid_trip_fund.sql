begin;
create table public.trip_fund_transactions(
 id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id),
 type text not null check(type in ('deposit','expense','rounding','refund','adjustment','reversal')),
 amount_satang bigint not null check(amount_satang<>0 and abs(amount_satang)<=1000000000000),
 status text not null default 'confirmed' check(status='confirmed'),
 description text not null check(length(trim(description))>0), occurred_on date not null default current_date,
 recorded_by uuid not null references public.profiles(id),custodian_id uuid not null references public.profiles(id),
 member_id uuid references public.profiles(id),collection_id uuid references public.collections(id),expense_id uuid references public.expenses(id),
 source_key text, reversal_of uuid unique references public.trip_fund_transactions(id),note text not null default '',created_at timestamptz not null default now(),
 unique(trip_id,source_key),check(type<>'deposit' or amount_satang>0),check(type<>'rounding' or amount_satang>0),check(type not in ('expense','refund') or amount_satang<0)
);
create index on public.trip_fund_transactions(trip_id,created_at desc);
create table public.trip_fund_settlements(
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.trips(id),
 policy text not null check(policy in ('proportional','equal','carry')),surplus_policy text not null check(surplus_policy in ('contributors','equal')),
 status text not null default 'pending' check(status in ('pending','completed','cancelled')),
 balance_satang bigint not null check(balance_satang>=0),custodian_id uuid not null references public.profiles(id),
 reconciliation_note text not null default '',created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),completed_at timestamptz
);
create unique index on public.trip_fund_settlements(trip_id) where status<>'cancelled';
create table public.trip_fund_refunds(
 id uuid primary key default gen_random_uuid(),settlement_id uuid not null references public.trip_fund_settlements(id),
 trip_id uuid not null references public.trips(id),member_id uuid not null references public.profiles(id),amount_satang bigint not null check(amount_satang>0),
 status text not null default 'pending' check(status in ('pending','completed')),transaction_id uuid unique references public.trip_fund_transactions(id),unique(settlement_id,member_id)
);
create table public.trip_fund_requests(trip_id uuid not null references public.trips(id),request_id uuid not null,action text not null,payload jsonb not null,result jsonb not null default '{}',primary key(trip_id,request_id));
alter table public.collections add column fund_request_key uuid;
alter table public.collections add column fund_account_label text;
alter table public.collections alter column due_date drop not null;
create unique index on public.collections(trip_id,fund_request_key) where fund_request_key is not null;
alter table public.expenses add column fund_paid_satang bigint not null default 0 check(fund_paid_satang>=0 and fund_paid_satang<=amount*100);
alter table public.expenses add column fund_only boolean not null default false;

create function public.trip_fund_manager(tid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from public.trips t left join public.trip_members m on m.trip_id=t.id and m.user_id=auth.uid() where t.id=tid and (t.owner_id=auth.uid() or m.trip_role='treasurer'));
$$;
create function public.trip_fund_balance(tid uuid,custodian uuid default null) returns bigint language sql stable security definer set search_path=public as $$
 select coalesce(sum(amount_satang),0)::bigint from public.trip_fund_transactions where trip_id=tid and (custodian is null or custodian_id=custodian);
$$;
create function public.trip_fund_lock(tid uuid) returns void language plpgsql security definer set search_path=public as $$
begin perform 1 from public.trips where id=tid for update;if not found then raise exception 'ไม่พบทริป';end if;end $$;

-- All receipts are posted exactly once, after the existing receiver confirmation RPC.
-- Old paid flags with no actual receipt amount are intentionally not imported as cash.
create function public.trip_fund_receipt() returns trigger language plpgsql security definer set search_path=public as $$
declare c public.collections;posted public.trip_fund_transactions;
begin
 select * into c from public.collections where id=coalesce(new.collection_id,old.collection_id);
 if c.id is null then return coalesce(new,old);end if;
 perform public.trip_fund_lock(c.trip_id);
 if not c.is_fund then
  if exists(select 1 from public.trip_fund_transactions where collection_id=c.id and type='rounding') and (tg_op='DELETE' or new.received_amount is distinct from old.received_amount or new.status is distinct from old.status or new.amount is distinct from old.amount) then raise exception 'จัดสรรส่วนเกินแล้ว ไม่สามารถแก้ประวัติรับเงิน';end if;
  return coalesce(new,old);end if;
 perform public.trip_fund_lock(c.trip_id);
 select * into posted from public.trip_fund_transactions where trip_id=c.trip_id and source_key='receipt:'||c.id||':'||coalesce(new.user_id,old.user_id);
 if posted.id is not null then
  if exists(select 1 from public.trip_fund_transactions where reversal_of=posted.id) then raise exception 'รายการรับนี้กลับบัญชีแล้ว กรุณาสร้างคำขอใหม่';end if;
  if tg_op='DELETE' or new.status<>'paid' or new.received_amount*100<>posted.amount_satang or new.received_amount is null or new.amount<>old.amount then raise exception 'มีบัญชีรับเงินแล้ว กรุณาใช้รายการกลับบัญชี';end if;
  return new;
 end if;
 if tg_op<>'DELETE' and new.status='paid' and new.received_amount>0 and new.confirmed_at is not null then
  if exists(select 1 from public.trip_fund_settlements where trip_id=c.trip_id and status<>'cancelled') then raise exception 'กองกลางกำลังปิดยอด กรุณายกเลิกแผนคืนเงินก่อน';end if;
  if not public.trip_fund_manager(c.trip_id) and auth.uid()<>c.receiver_id then raise insufficient_privilege;end if;
  insert into public.trip_fund_transactions(trip_id,type,amount_satang,description,recorded_by,custodian_id,member_id,collection_id,source_key)
  values(c.trip_id,'deposit',(new.received_amount*100)::bigint,c.title,auth.uid(),c.receiver_id,new.user_id,c.id,'receipt:'||c.id||':'||new.user_id);
 end if;return coalesce(new,old);
end $$;
create trigger trip_fund_receipt after insert or update or delete on public.collection_payments for each row execute function public.trip_fund_receipt();

create function public.trip_fund_immutable() returns trigger language plpgsql security definer set search_path=public as $$begin raise exception 'บัญชีกองกลางแก้หรือลบไม่ได้ กรุณาบันทึกกลับบัญชี';end $$;
create trigger trip_fund_immutable before update or delete on public.trip_fund_transactions for each row execute function public.trip_fund_immutable();
create function public.trip_fund_protect_source() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_table_name='collections' then
  if tg_op<>'INSERT' then perform public.trip_fund_lock(old.trip_id);end if;
  if tg_op<>'DELETE' and new.is_fund and not public.trip_fund_manager(new.trip_id) then raise insufficient_privilege using message='เฉพาะผู้ดูแลการเงินสร้างเงินสมทบได้';end if;
  if exists(select 1 from public.trip_fund_transactions where collection_id=old.id) then
   if tg_op='DELETE' or new.amount<>old.amount or new.receiver_id<>old.receiver_id or new.is_fund<>old.is_fund or new.original_amount<>old.original_amount or new.fund_account_label is distinct from old.fund_account_label or new.fund_shares is distinct from old.fund_shares then raise exception 'รายการนี้มีบัญชีกองกลางแล้ว ห้ามเปลี่ยนยอดหรือผู้ถือเงิน';end if;
  end if;
 else
  if (tg_op='INSERT' and (new.fund_paid_satang<>0 or new.fund_only) or tg_op='UPDATE' and (new.fund_paid_satang<>old.fund_paid_satang or new.fund_only<>old.fund_only)) and current_setting('tripmate.fund_write',true) is distinct from 'yes' then raise exception 'ใช้บัญชีกองกลางเท่านั้น';end if;
  if exists(select 1 from public.trip_fund_transactions original_tx where expense_id=old.id and type<>'reversal' and not exists(select 1 from public.trip_fund_transactions rev where rev.reversal_of=original_tx.id)) then
   if tg_op='DELETE' or new.amount<>old.amount or new.paid_by<>old.paid_by or new.approval_status<>old.approval_status or new.receipt_breakdown is distinct from old.receipt_breakdown then raise exception 'รายการนี้จ่ายจากกองกลางแล้ว กรุณากลับบัญชีก่อน';end if;
  end if;
 end if;return coalesce(new,old);
end $$;
create trigger trip_fund_protect_collection before insert or update or delete on public.collections for each row execute function public.trip_fund_protect_source();
create trigger trip_fund_protect_expense before insert or update or delete on public.expenses for each row execute function public.trip_fund_protect_source();

create function public.trip_fund_protect_shares() returns trigger language plpgsql security definer set search_path=public as $$
declare tid uuid;eid uuid;
begin
 eid:=coalesce(new.expense_id,old.expense_id);select trip_id into tid from public.expenses where id=eid;perform public.trip_fund_lock(tid);
 if exists(select 1 from public.expenses where id=eid and fund_paid_satang>0) and current_setting('tripmate.fund_write',true) is distinct from 'yes' then raise exception 'บิลนี้ใช้เงินกองกลางแล้ว ไม่สามารถเปลี่ยนส่วนแบ่ง';end if;return coalesce(new,old);
end $$;
create trigger trip_fund_protect_shares before insert or update or delete on public.expense_participants for each row execute function public.trip_fund_protect_shares();

create function public.trip_fund_rounding(tid uuid) returns table(collection_id uuid,title text,custodian_id uuid,available_satang bigint,expense_id uuid) language sql stable security definer set search_path=public as $$
 select c.id,c.title,c.receiver_id,greatest(0,(sum(p.received_amount)*100-c.original_amount*100)::bigint-coalesce((select sum(t.amount_satang) from public.trip_fund_transactions t where t.collection_id=c.id and (t.type='rounding' or t.type='reversal' and exists(select 1 from public.trip_fund_transactions x where x.id=t.reversal_of and x.type='rounding'))),0)),c.expense_id
 from public.collections c join public.collection_payments p on p.collection_id=c.id
 where c.trip_id=tid and not c.is_fund group by c.id
 having bool_and(p.status='paid' and p.received_amount is not null) and sum(p.received_amount)>c.original_amount;
$$;
create function public.trip_fund_snapshot(target_trip uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.is_trip_member(target_trip) then raise insufficient_privilege;end if;
 return jsonb_build_object('can_manage',public.trip_fund_manager(target_trip),'balance_satang',public.trip_fund_balance(target_trip),
 'transactions',coalesce((select jsonb_agg(t order by created_at desc) from public.trip_fund_transactions t where trip_id=target_trip),'[]'),
 'rounding',coalesce((select jsonb_agg(r) from public.trip_fund_rounding(target_trip)r where available_satang>0),'[]'),
 'settlements',coalesce((select jsonb_agg(s order by created_at desc) from public.trip_fund_settlements s where trip_id=target_trip),'[]'),
 'refunds',coalesce((select jsonb_agg(r) from public.trip_fund_refunds r where trip_id=target_trip),'[]'),
 'custodians',coalesce((select jsonb_agg(x) from (select custodian_id,sum(amount_satang) as balance_satang from public.trip_fund_transactions where trip_id=target_trip group by custodian_id)x),'[]'),
 'unresolved_count',(select count(*) from public.collection_payments p join public.collections c on c.id=p.collection_id where c.trip_id=target_trip and c.is_fund and (p.status<>'paid' or p.received_amount is null))+(select count(*) from public.trip_fund_rounding(target_trip)r where available_satang>0));
end $$;

-- JSON integer weights -> integer allocations with deterministic remainder distribution.
create function public.trip_fund_allocate(total bigint,weights jsonb) returns jsonb language sql immutable as $$
 with w as(select key,value::bigint as weight from jsonb_each_text(weights) where value::bigint>0),
 p as(select key,floor(total::numeric*weight/sum(weight)over())::bigint as base,mod(total::numeric*weight,sum(weight)over()) as rem from w),
 r as(select *,row_number()over(order by rem desc,key) as n,total-sum(base)over() as left_over from p)
 select coalesce(jsonb_object_agg(key,base+case when n<=left_over then 1 else 0 end),'{}') from r;
$$;

create function public.trip_fund_action(target_trip uuid,action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
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
  if trim(coalesce(payload->>'account_label',''))='' then raise exception 'ระบุบัญชีรับเงินจริง';end if;
  if holder is null or trim(coalesce(payload->>'title',''))='' or jsonb_typeof(payload->'amounts')<>'object' then raise exception 'กรอกรายการ ผู้ถือเงิน และยอดสมาชิก';end if;
  select sum(value::bigint) into total from jsonb_each_text(payload->'amounts');
  if total is null or total<=0 or exists(select 1 from jsonb_each_text(payload->'amounts')x where x.value!~'^\d+$' or x.value::numeric<=0 or x.value::numeric>1000000000000 or not exists(select 1 from public.trip_members m where m.trip_id=target_trip and m.user_id::text=x.key)) then raise exception 'ยอดสมทบหรือสมาชิกไม่ถูกต้อง';end if;
  insert into public.collections(trip_id,title,amount,original_amount,fund_remainder,is_fund,receiver_id,due_date,created_by,fund_request_key,fund_account_label)
  values(target_trip,payload->>'title',total/100.0,total/100.0,total/100.0,true,holder,nullif(payload->>'date','')::date,auth.uid(),request_id,nullif(trim(payload->>'account_label'),'')) returning id into cid;
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
  values(target_trip,'rounding',amount,'ส่วนเกินจากการหาร · '||c.title,auth.uid(),holder,c.id,c.expense_id,note,'rounding:'||request_id);
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
   select coalesce(sum(case when status='paid' then received_amount else 0 end),0)*100 into total from public.collection_payments where collection_id=cid;
   select coalesce(-sum(amount_satang),0) into available from public.trip_fund_transactions where collection_id=cid and type in ('expense','reversal');
   if c.id is null or exists(select 1 from public.collection_payments where collection_id=cid and (status<>'paid' or received_amount is null)) or -amount>c.original_amount*100-total-available then raise exception 'เชื่อมรายการเรียกเก็บได้เฉพาะยอดขาดหลังรับเงินจริงครบแล้ว';end if;
  elsif action='expense' then
   insert into public.expenses(trip_id,title,amount,paid_by,created_by,expense_date,approval_status,fund_paid_satang,fund_only)
   values(target_trip,payload->>'title',-amount/100.0,holder,auth.uid(),coalesce(nullif(payload->>'date','')::date,current_date),'approved',-amount,true) returning id into eid;
  end if;
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
  if t.type='expense' and t.expense_id is not null then update public.expenses set fund_paid_satang=fund_paid_satang+t.amount_satang where id=t.expense_id;end if;
 else raise exception 'ไม่รองรับการทำรายการนี้';end if;
 insert into public.trip_fund_requests(trip_id,request_id,action,payload) values(target_trip,request_id,action,payload);
 perform set_config('tripmate.fund_write','no',true);
 return public.trip_fund_snapshot(target_trip);
end $$;

alter table public.trip_fund_transactions enable row level security;alter table public.trip_fund_settlements enable row level security;alter table public.trip_fund_refunds enable row level security;alter table public.trip_fund_requests enable row level security;
create policy fund_read on public.trip_fund_transactions for select to authenticated using(public.is_trip_member(trip_id));
create policy fund_settlements_read on public.trip_fund_settlements for select to authenticated using(public.is_trip_member(trip_id));
create policy fund_refunds_read on public.trip_fund_refunds for select to authenticated using(public.is_trip_member(trip_id));
revoke all on public.trip_fund_transactions,public.trip_fund_settlements,public.trip_fund_refunds,public.trip_fund_requests from anon,authenticated;
grant select on public.trip_fund_transactions,public.trip_fund_settlements,public.trip_fund_refunds to authenticated;
revoke all on function public.trip_fund_action(uuid,text,jsonb,uuid),public.trip_fund_snapshot(uuid),public.trip_fund_balance(uuid,uuid),public.trip_fund_manager(uuid),public.trip_fund_rounding(uuid),public.trip_fund_allocate(bigint,jsonb),public.trip_fund_lock(uuid),public.trip_fund_receipt(),public.trip_fund_immutable(),public.trip_fund_protect_source(),public.trip_fund_protect_shares() from public,anon,authenticated;
grant execute on function public.trip_fund_action(uuid,text,jsonb,uuid),public.trip_fund_snapshot(uuid),public.trip_fund_manager(uuid) to authenticated;
do $$begin if exists(select 1 from pg_publication where pubname='supabase_realtime' and not puballtables) then alter publication supabase_realtime add table public.trip_fund_transactions;end if;end $$;
commit;
