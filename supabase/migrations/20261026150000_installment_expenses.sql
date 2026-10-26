begin;
alter table public.expenses add column is_installment_parent boolean not null default false;
alter table public.expenses add column installment_revision integer not null default 1;
create table public.expense_installments(
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.trips(id),parent_expense_id uuid not null references public.expenses(id),
 number integer not null check(number>0),title text not null,bill_satang bigint not null check(bill_satang>0),due_date date,created_at timestamptz not null default now(),unique(parent_expense_id,number)
);
alter table public.collections add column installment_id uuid references public.expense_installments(id);
alter table public.collections add column installment_bill_satang bigint check(installment_bill_satang>=0);
alter table public.collection_payments add column installment_superseded_at timestamptz;
create table public.expense_installment_members(
 parent_expense_id uuid not null references public.expenses(id),trip_id uuid not null references public.trips(id),user_id uuid not null references public.profiles(id),
 scope text not null check(scope in ('full','future')),start_number integer not null check(start_number>0),primary key(parent_expense_id,user_id)
);
create table public.expense_installment_receipts(
 id uuid primary key default gen_random_uuid(),sequence bigint generated always as identity,trip_id uuid not null references public.trips(id),collection_id uuid not null references public.collections(id),user_id uuid not null references public.profiles(id),
 amount_satang bigint not null check(amount_satang>=0),confirmed_by uuid not null references public.profiles(id),note text not null,source_snapshot jsonb not null,created_at timestamptz not null default now()
);
create table public.expense_installment_vendor_payments(
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.trips(id),installment_id uuid not null references public.expense_installments(id),
 amount_satang bigint not null check(amount_satang<>0),paid_on date not null,recorded_by uuid not null references public.profiles(id),note text not null,
 reversal_of uuid unique references public.expense_installment_vendor_payments(id),created_at timestamptz not null default now()
);
create table public.expense_installment_audit(
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.trips(id),parent_expense_id uuid not null references public.expenses(id),
 request_id uuid not null,action text not null,payload jsonb not null,source_snapshot jsonb,recorded_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),unique(trip_id,request_id)
);
create index on public.expense_installment_receipts(collection_id,user_id,created_at desc);

create view public.installment_cash_receipts with(security_invoker=true) as
 select p.collection_id,p.user_id,p.status,p.amount,p.slip_url,p.installment_superseded_at,
 case when p.status='paid' and p.installment_superseded_at is null then coalesce((select a.amount_satang from public.expense_installment_receipts a where a.collection_id=p.collection_id and a.user_id=p.user_id order by a.sequence desc limit 1),(p.received_amount*100)::bigint) end as cash_satang
 from public.collection_payments p;
create function public.collection_bill_satang(cid uuid) returns bigint language sql stable security definer set search_path=public as $$select coalesce(installment_bill_satang,(original_amount*100)::bigint) from public.collections where id=cid$$;

create function public.installment_expense_snapshot(parent_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare e public.expenses;
begin
 select * into e from public.expenses where id=parent_id and is_installment_parent;
 if e.id is null or not public.is_trip_member(e.trip_id) then raise insufficient_privilege;end if;
 return jsonb_build_object('expense_id',e.id,'trip_id',e.trip_id,'revision',e.installment_revision,'total_satang',(e.amount*100)::bigint,
 'members',coalesce((select jsonb_agg(m order by user_id) from public.expense_installment_members m where parent_expense_id=e.id),'[]'),
 'installments',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('collection_ids',(select coalesce(jsonb_agg(c.id order by c.created_at,c.id),'[]') from public.collections c where c.installment_id=i.id),
 'vendor_paid_satang',coalesce((select sum(amount_satang) from public.expense_installment_vendor_payments v where v.installment_id=i.id),0),
 'fund_paid_satang',coalesce((select -sum(t.amount_satang) from public.trip_fund_transactions t join public.collections c on c.id=t.collection_id where c.installment_id=i.id and (t.type='expense' or t.type='reversal' and exists(select 1 from public.trip_fund_transactions orig where orig.id=t.reversal_of and orig.type='expense'))),0),
 'vendor_payments',(select coalesce(jsonb_agg(v order by created_at desc),'[]') from public.expense_installment_vendor_payments v where installment_id=i.id)) order by i.number) from public.expense_installments i where parent_expense_id=e.id),'[]'),
 'receipts',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('fund_paid_satang',coalesce((select -sum(t.amount_satang) from public.trip_fund_transactions t where t.collection_id=c.id and (t.type='expense' or t.type='reversal' and exists(select 1 from public.trip_fund_transactions orig where orig.id=t.reversal_of and orig.type='expense'))),0))) from public.installment_cash_receipts p join public.collections c on c.id=p.collection_id join public.expense_installments i on i.id=c.installment_id where i.parent_expense_id=e.id),'[]'),
 'audit',coalesce((select jsonb_agg(to_jsonb(a)-'source_snapshot' order by created_at desc) from public.expense_installment_audit a where parent_expense_id=e.id),'[]'));
end $$;
create function public.installment_trip_snapshot(target_trip uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin if not public.is_trip_member(target_trip) then raise insufficient_privilege;end if;return coalesce((select jsonb_agg(public.installment_expense_snapshot(e.id) order by e.created_at) from public.expenses e where trip_id=target_trip and is_installment_parent),'[]');end $$;

create function public.installment_expense_preview(parent_id uuid,target_number integer,additions jsonb default '[]',rounding_unit integer default 100,remainder_member uuid default null,rounding_mode text default 'balanced')
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare e public.expenses;i record;c record;p record;m jsonb;people jsonb;weights jsonb;shares jsonb;responsibility jsonb:='{}';credits jsonb:='{}';fundcredits jsonb:='{}';gross jsonb:='{}';charges jsonb:='{}';overpaid jsonb:='{}';raw jsonb:='{}';extra jsonb:='[]';rows jsonb;cash bigint;basis bigint;known bigint;unknown integer:=0;pending integer:=0;target bigint:=0;leftover bigint;uid text;value bigint;fund bigint;denominator numeric:=1;responsibility_total bigint:=0;
begin
 select * into e from public.expenses where id=parent_id and is_installment_parent;if e.id is null or not public.is_trip_member(e.trip_id) then raise insufficient_privilege;end if;
 if rounding_mode not in ('balanced','ceil') or rounding_unit not in (1,100) or not exists(select 1 from public.expense_installments where parent_expense_id=e.id and number=target_number) then raise exception 'งวดหรือวิธีปัดเศษไม่ถูกต้อง';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by user_id),'[]') into people from public.expense_installment_members x where parent_expense_id=e.id;
 for m in select * from jsonb_array_elements(additions) loop
  if m->>'scope' not in ('full','future') or not exists(select 1 from public.trip_members where trip_id=e.trip_id and user_id=(m->>'user_id')::uuid) or exists(select 1 from jsonb_array_elements(people)x where x->>'user_id'=m->>'user_id') then raise exception 'เลือกสมาชิกใหม่และขอบเขตให้ถูกต้อง';end if;
  people:=people||jsonb_build_array(m||jsonb_build_object('start_number',target_number));
 end loop;
 for i in select * from public.expense_installments where parent_expense_id=e.id and number<=target_number order by number loop
  select count(*) into value from jsonb_array_elements(people)x where x->>'scope'='full' or (x->>'start_number')::integer<=i.number;
  if value=0 then raise exception 'ไม่มีสมาชิกที่รับผิดชอบงวดนี้';end if;denominator:=lcm(denominator,value::numeric);
 end loop;
 for i in select * from public.expense_installments where parent_expense_id=e.id and number<=target_number order by number loop
  select count(*) into value from jsonb_array_elements(people)x where x->>'scope'='full' or (x->>'start_number')::integer<=i.number;
  for uid in select x->>'user_id' from jsonb_array_elements(people)x where x->>'scope'='full' or (x->>'start_number')::integer<=i.number loop
   responsibility:=jsonb_set(responsibility,array[uid],to_jsonb(coalesce((responsibility->>uid)::numeric,0)+i.bill_satang::numeric*denominator/value));
  end loop;responsibility_total:=responsibility_total+i.bill_satang;
 end loop;
 select responsibility_total-coalesce(sum(floor(x.value::numeric/denominator)),0) into leftover from jsonb_each_text(responsibility)x;
 shares:='{}';for p in select x.key,x.value::numeric as n from jsonb_each_text(responsibility)x order by mod(x.value::numeric,denominator) desc,x.key loop
  cash:=floor(p.n/denominator)::bigint;if leftover>0 then cash:=cash+1;leftover:=leftover-1;end if;shares:=shares||jsonb_build_object(p.key,cash);
 end loop;responsibility:=shares;
 for c in select c0.* from public.collections c0 join public.expense_installments i0 on i0.id=c0.installment_id where i0.parent_expense_id=e.id and i0.number<target_number loop
  weights:='{}';known:=0;
  for p in select * from public.installment_cash_receipts where collection_id=c.id and installment_superseded_at is null loop
   if p.status='pending' then pending:=pending+1;end if;
   if p.status='paid' then
    if p.cash_satang is null then unknown:=unknown+1;else weights:=weights||jsonb_build_object(p.user_id::text,p.cash_satang);known:=known+p.cash_satang;gross:=jsonb_set(gross,array[p.user_id::text],to_jsonb(coalesce((gross->>p.user_id::text)::bigint,0)+p.cash_satang));end if;
   end if;
  end loop;
  basis:=public.collection_bill_satang(c.id);shares:=public.trip_fund_allocate(least(known,basis),weights);
  for uid,value in select x.key,x.value::bigint from jsonb_each_text(shares)x loop credits:=jsonb_set(credits,array[uid],to_jsonb(coalesce((credits->>uid)::bigint,0)+value));end loop;
  select coalesce(-sum(t.amount_satang),0) into fund from public.trip_fund_transactions t where t.collection_id=c.id and (t.type='expense' or t.type='reversal' and exists(select 1 from public.trip_fund_transactions orig where orig.id=t.reversal_of and orig.type='expense'));
  if fund>0 then
   select coalesce(jsonb_object_agg(user_id::text,1),'{}') into weights from public.collection_payments where collection_id=c.id and installment_superseded_at is null;
   shares:=public.trip_fund_allocate(fund,weights);for uid,value in select x.key,x.value::bigint from jsonb_each_text(shares)x loop fundcredits:=jsonb_set(fundcredits,array[uid],to_jsonb(coalesce((fundcredits->>uid)::bigint,0)+value));end loop;
  end if;
 end loop;
 for uid,value in select x.key,x.value::bigint from jsonb_each_text(responsibility)x loop
  cash:=value-coalesce((credits->>uid)::bigint,0)-coalesce((fundcredits->>uid)::bigint,0);
  if cash<0 then overpaid:=overpaid||jsonb_build_object(uid,-cash);else raw:=raw||jsonb_build_object(uid,cash);target:=target+cash;end if;
 end loop;
 if rounding_mode='balanced' and mod(target,rounding_unit)<>0 then raise exception 'ยอดรวมไม่ลงตัวเป็นบาทเต็ม ให้เลือกจัดสรรเป็นสตางค์';end if;
 select (target-coalesce(sum(floor(x.value::numeric/rounding_unit)*rounding_unit),0))/rounding_unit into leftover from jsonb_each_text(raw)x;
 if rounding_mode='ceil' then leftover:=0;end if;
 for p in select x.key,x.value::bigint as n from jsonb_each_text(raw)x order by case when x.key=remainder_member::text then 0 else 1 end,mod(x.value::bigint,rounding_unit) desc,x.key loop
  cash:=case when rounding_mode='ceil' then ceil(p.n::numeric/rounding_unit)::bigint*rounding_unit else (p.n/rounding_unit)*rounding_unit end;
  if mod(p.n,rounding_unit)>0 and leftover>0 then cash:=cash+rounding_unit;leftover:=leftover-1;extra:=extra||jsonb_build_array(p.key);end if;
  charges:=charges||jsonb_build_object(p.key,cash);
 end loop;
 if leftover<>0 then raise exception 'ไม่สามารถจัดสรรเศษได้';end if;
 return jsonb_build_object('members',people,'responsibility',responsibility,'cash',jsonb_build_object('credits',credits,'fundCredits',fundcredits,'gross',gross,'unknown',unknown,'pending',pending),'charges',charges,'target_satang',target,'charged_satang',(select sum(x.value::bigint) from jsonb_each_text(charges)x),'mode',rounding_mode,'overpaid',overpaid,'extra',extra,'unit',rounding_unit,'revision',e.installment_revision,'current_unknown',(select count(*) from public.installment_cash_receipts r join public.collections co on co.id=r.collection_id join public.expense_installments ei on ei.id=co.installment_id where ei.parent_expense_id=e.id and ei.number=target_number and r.status='paid' and r.amount>0 and r.cash_satang is null and r.installment_superseded_at is null));
end $$;

create function public.installment_expense_action(target_trip uuid,action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
<<op>>
declare e public.expenses;i public.expense_installments;c public.collections;v public.expense_installment_vendor_payments;a public.expense_installment_audit;m jsonb;part jsonb;s jsonb;p record;uid text;value bigint;parent uuid;cid uuid;actual bigint;total bigint;source_total bigint:=0;note text:=coalesce(payload->>'note','');before_snapshot jsonb;preview jsonb;vendor bigint;fund bigint;
begin
 if not public.trip_fund_manager(target_trip) then raise insufficient_privilege using message='เฉพาะเจ้าของทริปหรือเหรัญญิก';end if;
 if request_id is null or payload is null then raise exception 'ไม่มีรหัสคำขอ';end if;
 perform public.trip_fund_lock(target_trip);
 select * into a from public.expense_installment_audit x where x.trip_id=target_trip and x.request_id=installment_expense_action.request_id;
 if a.id is not null then if a.action<>action or a.payload<>payload then raise exception 'รหัสนี้ใช้กับข้อมูลอื่นแล้ว';end if;return public.installment_expense_snapshot(a.parent_expense_id);end if;
 perform set_config('tripmate.installment_write','yes',true);
 if action in ('create','import') then
  total:=(payload->>'total_satang')::bigint;
  if total is null or total<=0 or total>999999999999 or trim(coalesce(payload->>'title',''))='' or jsonb_array_length(payload->'installments')<1 or jsonb_array_length(payload->'members')<1 then raise exception 'กรอกยอดบิล ชื่อ สมาชิก และงวดให้ครบ';end if;
  if (select sum((x->>'bill_satang')::bigint) from jsonb_array_elements(payload->'installments')x)<>total then raise exception 'ยอดจริงทุกงวดต้องรวมเท่าบิลหลัก';end if;
  if action='create' and exists(select 1 from jsonb_array_elements(payload->'installments')p0 where jsonb_array_length(coalesce(p0->'sources','[]'))>0) then raise exception 'รายการเก่าต้องใช้หน้าตรวจและอนุมัติการรวม';end if;
  if action='import' and (length(trim(note))<5 or not coalesce((payload->>'approved')::boolean,false)) then raise exception 'ตรวจส่วนต่างและยืนยันก่อนรวมรายการเดิม';end if;
  insert into public.expenses(trip_id,title,amount,paid_by,created_by,approval_status,is_installment_parent)values(target_trip,payload->>'title',total/100.0,auth.uid(),auth.uid(),'approved',true)returning id into parent;
  for m in select * from jsonb_array_elements(payload->'members') loop
   if not exists(select 1 from public.trip_members where trip_id=target_trip and user_id=(m->>'user_id')::uuid) then raise exception 'สมาชิกไม่ได้อยู่ในทริป';end if;
   insert into public.expense_installment_members(parent_expense_id,trip_id,user_id,scope,start_number)values(parent,target_trip,(m->>'user_id')::uuid,'full',1);
  end loop;
  actual:=0;before_snapshot:='[]';
  for part in select * from jsonb_array_elements(payload->'installments') loop
   actual:=actual+1;
   insert into public.expense_installments(trip_id,parent_expense_id,number,title,bill_satang,due_date) values(target_trip,parent,actual::integer,coalesce(nullif(part->>'title',''),'งวด '||actual),(part->>'bill_satang')::bigint,nullif(part->>'date','')::date) returning * into i;
   source_total:=0;
   for s in select * from jsonb_array_elements(coalesce(part->'sources','[]')) loop
    select * into c from public.collections where id=(s->>'collection_id')::uuid and trip_id=target_trip for update;
    if c.id is null or c.is_fund or c.installment_id is not null or (c.expense_id is not null and exists(select 1 from public.collections z where z.expense_id=c.expense_id and z.id<>c.id)) then raise exception 'รายการเดิมไม่ถูกต้อง ถูกจัดกลุ่มแล้ว หรือเชื่อมบิลอื่น';end if;
    if c.expense_id is not null and exists(select 1 from public.expenses where id=c.expense_id and (fund_only or is_installment_parent or approval_status<>'approved')) then raise exception 'บิลเดิมยังไม่อนุมัติหรือเป็นรายการพิเศษ';end if;
    value:=(s->>'bill_satang')::bigint;if value is null or value<=0 then raise exception 'ระบุยอดบิลอ้างอิงของแต่ละรายการเดิม';end if;
    if exists(select 1 from public.collection_payments cp where cp.collection_id=c.id and not exists(select 1 from public.expense_installment_members mm where mm.parent_expense_id=parent and mm.user_id=cp.user_id)) then raise exception 'รายชื่อที่รับผิดชอบต้องรวมสมาชิกจากรายการเดิม';end if;
    if coalesce((select sum(amount_satang) from public.trip_fund_transactions t where t.collection_id=c.id and (t.type='rounding' or t.type='reversal' and exists(select 1 from public.trip_fund_transactions original_tx where original_tx.id=t.reversal_of and original_tx.type='rounding'))),0)>greatest(0,coalesce((select sum(cash_satang) from public.installment_cash_receipts where collection_id=c.id),0)-value) then raise exception 'มีกองกลางจัดสรรจากยอดเดิมเกินผลตรวจใหม่ ต้องกลับบัญชีก่อนรวม';end if;
    before_snapshot:=before_snapshot||jsonb_build_array(to_jsonb(c)||jsonb_build_object('payments',(select coalesce(jsonb_agg(cp),'[]') from public.collection_payments cp where collection_id=c.id)));
    update public.collections set installment_id=i.id,installment_bill_satang=value where id=c.id;source_total:=source_total+value;
   end loop;
   if source_total>0 and source_total<>i.bill_satang then raise exception 'ยอดอ้างอิงรายการเดิมในแต่ละงวดต้องตรงกับยอดจริงงวดนั้น';end if;
  end loop;
 elsif action in ('issue','attest','vendor','vendor_reverse','shortfall') then
  select * into e from public.expenses where id=(payload->>'parent_id')::uuid and trip_id=target_trip and is_installment_parent for update;
  if e.id is null then raise exception 'ไม่พบรายการหลัก';end if;parent:=e.id;
  if e.installment_revision is distinct from (payload->>'revision')::integer then raise exception 'ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่และตรวจยอดอีกครั้ง';end if;
  before_snapshot:=public.installment_expense_snapshot(parent);
  if action='issue' then
   select * into i from public.expense_installments where parent_expense_id=parent and number=(payload->>'number')::integer;
   if i.id is null then raise exception 'ไม่พบงวด';end if;
   if exists(select 1 from public.collection_payments cp join public.collections co on co.id=cp.collection_id join public.expense_installments ei on ei.id=co.installment_id where ei.parent_expense_id=parent and ei.number>=i.number and cp.installment_superseded_at is null and (cp.slip_url is not null or cp.status='pending' or cp.status='paid' and cp.amount>0 and (select r.cash_satang is null or r.cash_satang>0 from public.installment_cash_receipts r where r.collection_id=cp.collection_id and r.user_id=cp.user_id))) then raise exception 'งวดนี้หรืองวดถัดไปมีการชำระแล้ว ห้ามแก้ย้อนหลัง';end if;
   preview:=public.installment_expense_preview(parent,i.number,coalesce(payload->'additions','[]'),coalesce((payload->>'unit')::integer,100),nullif(payload->>'remainder_member','')::uuid,coalesce(payload->>'mode','balanced'));
   if preview->'overpaid'<>'{}' then raise exception 'มีสมาชิกจ่ายบิลเกินส่วนใหม่ ต้องตรวจสอบเงินคืนก่อนออกยอดใหม่';end if;
   if (preview->'cash'->>'unknown')::integer>0 or (preview->'cash'->>'pending')::integer>0 then raise exception 'ยืนยันยอดรับเก่าและตรวจสลิปที่ค้างก่อนปรับสมาชิก';end if;
   if preview->'charges' is distinct from payload->'charges' then raise exception 'ยอดตัวอย่างไม่ตรงกับเซิร์ฟเวอร์ กรุณาตรวจใหม่';end if;
   if not exists(select 1 from public.trip_members where trip_id=target_trip and user_id=(payload->>'receiver_id')::uuid) then raise exception 'เลือกผู้รับเงินในทริป';end if;
   for m in select * from jsonb_array_elements(coalesce(payload->'additions','[]')) loop
    insert into public.expense_installment_members(parent_expense_id,trip_id,user_id,scope,start_number)values(parent,target_trip,(m->>'user_id')::uuid,m->>'scope',i.number);
   end loop;
   -- Preserve every old amount/status/slip. Only retire unpaid requests being rolled forward.
   update public.collection_payments cp set installment_superseded_at=now() from public.collections co join public.expense_installments ei on ei.id=co.installment_id where cp.collection_id=co.id and ei.parent_expense_id=parent and (cp.status='unpaid' or cp.status='paid' and (select r.cash_satang=0 from public.installment_cash_receipts r where r.collection_id=cp.collection_id and r.user_id=cp.user_id)) and cp.slip_url is null and cp.installment_superseded_at is null;
   total:=(preview->>'target_satang')::bigint;
   if total<=0 then raise exception 'ไม่มีเงินที่ต้องเรียกเก็บ';end if;
   insert into public.collections(trip_id,title,amount,original_amount,fund_remainder,is_fund,receiver_id,due_date,created_by,installment_id,installment_bill_satang)
   values(target_trip,e.title||' · งวด '||i.number,(preview->>'charged_satang')::bigint/100.0,total/100.0,((preview->>'charged_satang')::bigint-total)/100.0,false,(payload->>'receiver_id')::uuid,i.due_date,auth.uid(),i.id,total) returning id into cid;
   insert into public.collection_payments(collection_id,user_id,amount,status,received_amount,confirmed_at)
   select cid,x.key::uuid,x.value::bigint/100.0,case when x.value::bigint=0 then 'paid' else 'unpaid' end,case when x.value::bigint=0 then 0 end,case when x.value::bigint=0 then now() end from jsonb_each_text(preview->'charges')x;
  elsif action='shortfall' then
   select * into c from public.collections co where co.id=(payload->>'collection_id')::uuid and exists(select 1 from public.expense_installments ei where ei.id=co.installment_id and ei.parent_expense_id=parent) for update;
   if c.id is null or length(trim(note))<3 or not exists(select 1 from public.expense_installment_members mm where mm.parent_expense_id=parent and mm.user_id=(payload->>'member_id')::uuid) then raise exception 'เลือกรายการ สมาชิกที่รับส่วนขาด และบันทึกเหตุผล';end if;
   if exists(select 1 from public.installment_cash_receipts r where r.collection_id=c.id and r.status='paid' and r.cash_satang is null and r.installment_superseded_at is null) then raise exception 'ยืนยันยอดรับเก่าของรายการนี้ก่อนเรียกเพิ่ม';end if;
   select coalesce(-sum(t.amount_satang),0) into fund from public.trip_fund_transactions t where t.collection_id=c.id and (t.type='expense' or t.type='reversal' and exists(select 1 from public.trip_fund_transactions orig where orig.id=t.reversal_of and orig.type='expense'));
   select public.collection_bill_satang(c.id)-coalesce(sum(cp.amount*100),0)-fund into value from public.collection_payments cp where cp.collection_id=c.id and cp.installment_superseded_at is null;
   if not exists(select 1 from public.installment_cash_receipts r where r.collection_id=c.id and r.installment_superseded_at is null and (r.status<>'paid' or r.cash_satang is null)) then
    select least(op.value,greatest(0,public.collection_bill_satang(c.id)-coalesce(sum(r.cash_satang),0)-fund)) into value from public.installment_cash_receipts r where r.collection_id=c.id;
   end if;
   if value is null or value<=0 or value is distinct from (payload->>'amount_satang')::bigint then raise exception 'ส่วนขาดเปลี่ยนหรือถูกชดเชยแล้ว กรุณาตรวจใหม่';end if;
   if exists(select 1 from public.trip_fund_transactions t where t.collection_id=c.id and t.type='rounding' and not exists(select 1 from public.trip_fund_transactions rev where rev.reversal_of=t.id)) then raise exception 'มีการจัดสรรกองกลางจากรายการนี้ ต้องตรวจกลับบัญชีก่อน';end if;
   update public.collections set installment_bill_satang=public.collection_bill_satang(id)-op.value where id=c.id;
   insert into public.collections(trip_id,title,amount,original_amount,fund_remainder,is_fund,receiver_id,due_date,created_by,installment_id,installment_bill_satang)
   values(target_trip,e.title||' · ส่วนขาดงวด',value/100.0,value/100.0,0,false,c.receiver_id,c.due_date,auth.uid(),c.installment_id,value) returning id into cid;
   insert into public.collection_payments(collection_id,user_id,amount,status)values(cid,(payload->>'member_id')::uuid,value/100.0,'unpaid');
  elsif action='attest' then
   select * into c from public.collections co where co.id=(payload->>'collection_id')::uuid and exists(select 1 from public.expense_installments x where x.id=co.installment_id and x.parent_expense_id=parent);
   select * into p from public.collection_payments where collection_id=c.id and user_id=(payload->>'member_id')::uuid;
   value:=(payload->>'cash_satang')::bigint;
   if c.id is null or p.status<>'paid' or value is null or value<0 or p.installment_superseded_at is not null or length(trim(note))<5 then raise exception 'เลือกยอดจ่ายเดิมและระบุการตรวจเงินจริง';end if;
   insert into public.expense_installment_receipts(trip_id,collection_id,user_id,amount_satang,confirmed_by,note,source_snapshot)values(target_trip,c.id,p.user_id,value,auth.uid(),note,to_jsonb(p));
   if coalesce((select sum(amount_satang) from public.trip_fund_transactions t where t.collection_id=c.id and (t.type='rounding' or t.type='reversal' and exists(select 1 from public.trip_fund_transactions orig where orig.id=t.reversal_of and orig.type='rounding'))),0)>greatest(0,coalesce((select sum(cash_satang) from public.installment_cash_receipts where collection_id=c.id),0)-public.collection_bill_satang(c.id)) then raise exception 'เงินส่วนเกินถูกจัดสรรแล้ว ต้องกลับบัญชีก่อนแก้ยอดรับ';end if;
  else
   select * into i from public.expense_installments where id=(payload->>'installment_id')::uuid and parent_expense_id=parent;
   if i.id is null or length(trim(note))<3 then raise exception 'เลือกงวดและระบุหลักฐาน/บันทึกการจ่ายจริง';end if;
   if action='vendor_reverse' then
    select * into v from public.expense_installment_vendor_payments where id=(payload->>'transaction_id')::uuid and installment_id=i.id;
    if v.id is null or v.reversal_of is not null then raise exception 'ไม่พบรายการจ่ายต้นทาง';end if;
    insert into public.expense_installment_vendor_payments(trip_id,installment_id,amount_satang,paid_on,recorded_by,note,reversal_of)values(target_trip,i.id,-v.amount_satang,current_date,auth.uid(),note,v.id);
   else
    value:=(payload->>'amount_satang')::bigint;
    select coalesce(sum(amount_satang),0) into vendor from public.expense_installment_vendor_payments where installment_id=i.id;
    select coalesce(-sum(t.amount_satang),0) into fund from public.trip_fund_transactions t join public.collections co on co.id=t.collection_id where co.installment_id=i.id and (t.type='expense' or t.type='reversal' and exists(select 1 from public.trip_fund_transactions orig where orig.id=t.reversal_of and orig.type='expense'));
    if value is null or value<=0 or vendor+value>i.bill_satang then raise exception 'ยอดจ่ายจริงเกินยอดบิลงวดนี้';end if;
    insert into public.expense_installment_vendor_payments(trip_id,installment_id,amount_satang,paid_on,recorded_by,note)values(target_trip,i.id,value,coalesce(nullif(payload->>'date','')::date,current_date),auth.uid(),note);
   end if;
  end if;
  update public.expenses set installment_revision=installment_revision+1 where id=parent;
 else raise exception 'ไม่รองรับคำสั่ง';end if;
 insert into public.expense_installment_audit(trip_id,parent_expense_id,request_id,action,payload,source_snapshot,recorded_by)values(target_trip,parent,request_id,action,payload,before_snapshot,auth.uid());
 perform set_config('tripmate.installment_write','no',true);
 return public.installment_expense_snapshot(parent);
end $$;

create function public.installment_protect_source() returns trigger language plpgsql security definer set search_path=public as $$
declare child uuid;
begin
 if current_setting('tripmate.installment_write',true)='yes' then return coalesce(new,old);end if;
 if tg_table_name='expenses' then
  if tg_op<>'DELETE' then if new.is_installment_parent or tg_op='UPDATE' and (new.is_installment_parent<>old.is_installment_parent or new.installment_revision<>old.installment_revision) then raise exception 'ใช้หน้ารายการหลายงวดเท่านั้น';end if;end if;
  if tg_op<>'INSERT' then if old.is_installment_parent or exists(select 1 from public.collections where expense_id=old.id and installment_id is not null) then raise exception 'รายการนี้มีประวัติหลายงวดแล้ว ห้ามแก้/ลบรายการต้นทาง';end if;end if;
 elsif tg_table_name='collections' then
  if tg_op<>'DELETE' then if new.installment_id is not null or tg_op='UPDATE' and (new.installment_id is distinct from old.installment_id or new.installment_bill_satang is distinct from old.installment_bill_satang) then raise exception 'ใช้หน้ารายละเอียดงวดเท่านั้น';end if;end if;
  if tg_op='DELETE' and old.installment_id is not null then raise exception 'ห้ามลบประวัติงวด';end if;
 else
  select installment_id into child from public.collections where id=coalesce(new.collection_id,old.collection_id);
  if child is not null then
   if tg_op in ('INSERT','DELETE') then raise exception 'ห้ามเพิ่มหรือลบสมาชิกในงวดเดิม';end if;
   if old.installment_superseded_at is not null or new.installment_superseded_at is distinct from old.installment_superseded_at or new.amount<>old.amount or new.user_id<>old.user_id then raise exception 'คำขอนี้ถูกยกยอดไปงวดใหม่ หรือแก้ย้อนหลังไม่ได้';end if;
   if old.status='paid' and old.received_amount is not null and (new.status<>old.status or new.received_amount is distinct from old.received_amount) then raise exception 'ใช้ยืนยันยอดเก่าพร้อม audit แทนแก้ประวัติ';end if;
  end if;
 end if;return coalesce(new,old);
end $$;
create trigger installment_protect_expense before insert or update or delete on public.expenses for each row execute function public.installment_protect_source();
create trigger installment_protect_collection before insert or update or delete on public.collections for each row execute function public.installment_protect_source();
create trigger installment_protect_payment before insert or update or delete on public.collection_payments for each row execute function public.installment_protect_source();

-- Use the approved cash basis for grouped legacy items and effective attested receipts.
create or replace function public.trip_fund_rounding(tid uuid) returns table(collection_id uuid,title text,custodian_id uuid,available_satang bigint,expense_id uuid) language sql stable security definer set search_path=public as $$
 select c.id,c.title,c.receiver_id,greatest(0,coalesce(sum(p.cash_satang),0)-public.collection_bill_satang(c.id)-coalesce((select sum(t.amount_satang) from public.trip_fund_transactions t where t.collection_id=c.id and (t.type='rounding' or t.type='reversal' and exists(select 1 from public.trip_fund_transactions x where x.id=t.reversal_of and x.type='rounding'))),0))::bigint,c.expense_id
 from public.collections c join public.installment_cash_receipts p on p.collection_id=c.id where c.trip_id=tid and not c.is_fund group by c.id
 having bool_and(p.installment_superseded_at is not null or p.status='paid' and p.cash_satang is not null) and coalesce(sum(p.cash_satang),0)>public.collection_bill_satang(c.id);
$$;
-- Fund top-ups keep the existing authorized/locked action and change only its bill/cash source.
do $$declare definition text;begin
 definition:=pg_get_functiondef('public.trip_fund_action(uuid,text,jsonb,uuid)'::regprocedure);
 if position('collection_bill_satang(c.id)' in definition)=0 then
  if position('c.original_amount*100-total-available' in definition)=0 then raise exception 'Unexpected fund action definition';end if;
  definition:=replace(definition,'c.original_amount*100-total-available','public.collection_bill_satang(c.id)-total-available');
  definition:=replace(definition,'select coalesce(sum(case when status=''paid'' then received_amount else 0 end),0)*100 into total from public.collection_payments where collection_id=cid;', 'select coalesce(sum(cash_satang),0) into total from public.installment_cash_receipts where collection_id=cid;');
  definition:=replace(definition,'exists(select 1 from public.collection_payments where collection_id=cid and (status<>''paid'' or received_amount is null))','exists(select 1 from public.installment_cash_receipts where collection_id=cid and installment_superseded_at is null and (status<>''paid'' or cash_satang is null))');
  definition:=replace(definition,'holder,c.id,c.expense_id,note', 'holder,c.id,case when c.installment_id is null then c.expense_id else (select parent_expense_id from public.expense_installments where id=c.installment_id) end,note');
  definition:=replace(definition,'insert into public.trip_fund_transactions(trip_id,type,amount_satang,description,occurred_on', $patch$if cid is not null and action='expense' then select i.parent_expense_id into eid from public.collections co join public.expense_installments i on i.id=co.installment_id where co.id=cid;end if;
  insert into public.trip_fund_transactions(trip_id,type,amount_satang,description,occurred_on$patch$);
  definition:=replace(definition,'if t.type=''expense'' and t.expense_id is not null then','if t.type=''expense'' and t.expense_id is not null and t.collection_id is null then');
  execute definition;
 end if;
end $$;
-- Child payment/receipt edits must also lock the parent revision used for allocation previews.
create function public.installment_receipt_revision() returns trigger language plpgsql security definer set search_path=public as $$
declare parent uuid;begin
 select i.parent_expense_id into parent from public.collections c join public.expense_installments i on i.id=c.installment_id where c.id=coalesce(new.collection_id,old.collection_id);
 if parent is not null and current_setting('tripmate.installment_write',true) is distinct from 'yes' then
  perform set_config('tripmate.installment_write','yes',true);update public.expenses set installment_revision=installment_revision+1 where id=parent;perform set_config('tripmate.installment_write','no',true);
 end if;return coalesce(new,old);
end $$;
create trigger installment_receipt_revision after update on public.collection_payments for each row execute function public.installment_receipt_revision();

create trigger installment_receipt_immutable before update or delete on public.expense_installment_receipts for each row execute function public.trip_fund_immutable();
create trigger installment_vendor_immutable before update or delete on public.expense_installment_vendor_payments for each row execute function public.trip_fund_immutable();
create trigger installment_audit_immutable before update or delete on public.expense_installment_audit for each row execute function public.trip_fund_immutable();
alter table public.expense_installments enable row level security;alter table public.expense_installment_members enable row level security;alter table public.expense_installment_receipts enable row level security;alter table public.expense_installment_vendor_payments enable row level security;alter table public.expense_installment_audit enable row level security;
create policy installment_read on public.expense_installments for select to authenticated using(public.is_trip_member(trip_id));
create policy installment_members_read on public.expense_installment_members for select to authenticated using(public.is_trip_member(trip_id));
create policy installment_receipts_read on public.expense_installment_receipts for select to authenticated using(public.is_trip_member(trip_id));
create policy installment_vendor_read on public.expense_installment_vendor_payments for select to authenticated using(public.is_trip_member(trip_id));
create policy installment_audit_read on public.expense_installment_audit for select to authenticated using(public.is_trip_member(trip_id));
revoke all on public.expense_installments,public.expense_installment_members,public.expense_installment_receipts,public.expense_installment_vendor_payments,public.expense_installment_audit,public.installment_cash_receipts from anon,authenticated;
grant select on public.expense_installments,public.expense_installment_members,public.expense_installment_receipts,public.expense_installment_vendor_payments,public.expense_installment_audit,public.installment_cash_receipts to authenticated;
revoke all on function public.collection_bill_satang(uuid),public.installment_expense_snapshot(uuid),public.installment_trip_snapshot(uuid),public.installment_expense_preview(uuid,integer,jsonb,integer,uuid,text),public.installment_expense_action(uuid,text,jsonb,uuid),public.installment_protect_source(),public.installment_receipt_revision() from public,anon,authenticated;
grant execute on function public.installment_expense_snapshot(uuid),public.installment_trip_snapshot(uuid),public.installment_expense_preview(uuid,integer,jsonb,integer,uuid,text),public.installment_expense_action(uuid,text,jsonb,uuid) to authenticated;
create function public.installment_fund_unresolved(tid uuid) returns bigint language sql stable security definer set search_path=public as $$
 select count(*) from public.expense_installments i where i.trip_id=tid and (
 coalesce((select sum(v.amount_satang) from public.expense_installment_vendor_payments v where v.installment_id=i.id),0)<>i.bill_satang
 or exists(select 1 from public.collections c join public.installment_cash_receipts p on p.collection_id=c.id where c.installment_id=i.id and p.installment_superseded_at is null and (p.status<>'paid' or p.cash_satang is null)));
$$;
revoke all on function public.installment_fund_unresolved(uuid) from public,anon,authenticated;
do $$declare definition text;begin
 definition:=pg_get_functiondef('public.trip_fund_snapshot(uuid)'::regprocedure);
 if position('installment_fund_unresolved' in definition)=0 then
  if position('+(select count(*) from public.trip_fund_rounding(target_trip)r where available_satang>0)' in definition)=0 then raise exception 'Unexpected fund snapshot';end if;
  definition:=replace(definition,'+(select count(*) from public.trip_fund_rounding(target_trip)r where available_satang>0)','+(select count(*) from public.trip_fund_rounding(target_trip)r where available_satang>0)+public.installment_fund_unresolved(target_trip)');execute definition;
 end if;
end $$;

commit;
