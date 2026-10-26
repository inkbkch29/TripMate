begin;
-- Optional per-installment responsibility settings; old schedules keep their existing behavior.
alter table public.expense_installments add column allocation jsonb;
create function public.installment_capture_allocation() returns trigger language plpgsql security definer set search_path=public as $$
declare ids jsonb;known jsonb;shares jsonb;mode text;
begin
 if tg_op='UPDATE' and new.allocation is distinct from old.allocation then raise exception 'ยอดรับผิดชอบที่อนุมัติแล้วแก้ย้อนหลังไม่ได้';end if;
 if tg_op='UPDATE' or new.allocation is null then return new;end if;
 ids:=new.allocation->'member_ids';mode:=new.allocation->>'mode';
 if mode not in ('equal','custom') or mode is null or jsonb_typeof(ids)<>'array' or ids is null or jsonb_array_length(ids)=0 then raise exception 'เลือกสมาชิกและวิธีแบ่งงวดให้ถูกต้อง';end if;
 if (select count(*) from jsonb_array_elements_text(ids))<>(select count(distinct value) from jsonb_array_elements_text(ids)) or exists(select 1 from jsonb_array_elements_text(ids)x where not exists(select 1 from public.expense_installment_members m where m.parent_expense_id=new.parent_expense_id and m.user_id::text=x.value)) then raise exception 'สมาชิกงวดไม่ถูกต้องหรือซ้ำ';end if;
 select jsonb_agg(user_id::text order by user_id) into known from public.expense_installment_members where parent_expense_id=new.parent_expense_id;
 if mode='equal' then
  select public.trip_fund_allocate(new.bill_satang,jsonb_object_agg(value,1)) into shares from jsonb_array_elements_text(ids);
 else
  shares:=new.allocation->'shares_satang';
  if shares is null or jsonb_typeof(shares)<>'object' then raise exception 'กรอกยอดรับผิดชอบรายคน';end if;
  if exists(select 1 from jsonb_each_text(shares)x where not(ids ? x.key) or x.value is null or x.value!~'^\d+$' or x.value::numeric>1000000000000) or exists(select 1 from jsonb_array_elements_text(ids)x where not(shares ? x.value)) or (select sum(value::bigint) from jsonb_each_text(shares))<>new.bill_satang then raise exception 'ยอดรับผิดชอบรายคนต้องรวมเท่ายอดบิลจริงของงวด';end if;
 end if;
 new.allocation:=jsonb_build_object('mode',mode,'member_ids',ids,'known_member_ids',known,'shares_satang',shares);return new;
end $$;
create trigger installment_capture_allocation before insert or update on public.expense_installments for each row execute function public.installment_capture_allocation();

create function public.installment_allocation_people(allocation jsonb,people jsonb,part_number integer) returns table(user_id text) language sql immutable as $$
 select p->>'user_id' from jsonb_array_elements(people)p where (p->>'scope'='full' or (p->>'start_number')::integer<=part_number) and (allocation is null or allocation->'member_ids' ? (p->>'user_id') or not(allocation->'known_member_ids' ? (p->>'user_id')));
$$;
create function public.installment_configured_responsibility(parent_id uuid,through_number integer,people jsonb) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare i record;p record;uid text;value bigint;denominator numeric:=1;total bigint:=0;leftover bigint;cash bigint;weights jsonb:='{}';shares jsonb:='{}';
begin
 for i in select * from public.expense_installments where parent_expense_id=parent_id and number<=through_number order by number loop
  select count(*) into value from public.installment_allocation_people(i.allocation,people,i.number);
  if value=0 then raise exception 'ไม่มีสมาชิกที่รับผิดชอบงวดนี้';end if;
  if i.allocation->>'mode'='custom' then
   if exists(select 1 from public.installment_allocation_people(i.allocation,people,i.number)x where not(i.allocation->'known_member_ids' ? x.user_id)) then raise exception 'งวดที่กำหนดยอดรายคนต้องตรวจยอดรับผิดชอบก่อนเพิ่มสมาชิก กรุณาเลือกเฉพาะงวดใหม่ที่หารเท่ากัน';end if;
  else denominator:=lcm(denominator,value::numeric);end if;
 end loop;
 for i in select * from public.expense_installments where parent_expense_id=parent_id and number<=through_number order by number loop
  if i.allocation->>'mode'='custom' then
   for uid,value in select x.key,x.value::bigint from jsonb_each_text(i.allocation->'shares_satang')x loop weights:=jsonb_set(weights,array[uid],to_jsonb(coalesce((weights->>uid)::numeric,0)+value*denominator));end loop;
  else
   select count(*) into value from public.installment_allocation_people(i.allocation,people,i.number);
   for uid in select user_id from public.installment_allocation_people(i.allocation,people,i.number) loop weights:=jsonb_set(weights,array[uid],to_jsonb(coalesce((weights->>uid)::numeric,0)+i.bill_satang::numeric*denominator/value));end loop;
  end if;total:=total+i.bill_satang;
 end loop;
 select total-coalesce(sum(floor(x.value::numeric/denominator)),0) into leftover from jsonb_each_text(weights)x;
 for p in select x.key,x.value::numeric as n from jsonb_each_text(weights)x order by mod(x.value::numeric,denominator) desc,x.key loop
  cash:=floor(p.n/denominator)::bigint;if leftover>0 then cash:=cash+1;leftover:=leftover-1;end if;shares:=shares||jsonb_build_object(p.key,cash);
 end loop;return shares;
end $$;

create function public.installment_source_review(cid uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('amount_satang',(c.amount*100)::bigint,'original_satang',(coalesce(c.original_amount,c.amount)*100)::bigint,'receiver_id',c.receiver_id,'payments',coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'amount_satang',(p.amount*100)::bigint,'status',p.status,'received_satang',(p.received_amount*100)::bigint,'slip_path',nullif(p.slip_url,'')) order by p.user_id) from public.collection_payments p where collection_id=c.id),'[]')) from public.collections c where c.id=cid;
$$;

do $$declare definition text;old_block text;start_at integer;end_at integer;begin
 definition:=pg_get_functiondef('public.installment_expense_action(uuid,text,jsonb,uuid)'::regprocedure);
 if position('bill_satang,due_date) values' in definition)=0 then raise exception 'Unexpected installment insert';end if;
 definition:=replace(definition,'bill_satang,due_date) values','bill_satang,due_date,allocation) values');
 definition:=replace(definition,'nullif(part->>''date'','''')::date) returning * into i;','nullif(part->>''date'','''')::date,part->''allocation'') returning * into i;');
 definition:=replace(definition,'value:=(s->>''bill_satang'')::bigint;',$patch$if s ? 'review' and s->'review' is distinct from public.installment_source_review(c.id) then raise exception 'รายการเดิมเปลี่ยนแล้ว กรุณาปิดและเริ่มตรวจใหม่';end if;
    value:=(s->>'bill_satang')::bigint;$patch$);
 execute definition;
 definition:=pg_get_functiondef('public.installment_expense_preview(uuid,integer,jsonb,integer,uuid,text)'::regprocedure);
 start_at:=position(' for i in select * from public.expense_installments where parent_expense_id=e.id and number<=target_number' in definition);end_at:=position(' for c in select c0.*' in definition);
 if start_at=0 or end_at<=start_at then raise exception 'Unexpected responsibility preview';end if;
 definition:=left(definition,start_at-1)||' responsibility:=public.installment_configured_responsibility(e.id,target_number,people);'||chr(10)||substring(definition from end_at);
 execute definition;
end $$;
revoke all on function public.installment_capture_allocation(),public.installment_allocation_people(jsonb,jsonb,integer),public.installment_configured_responsibility(uuid,integer,jsonb),public.installment_source_review(uuid) from public,anon,authenticated;
commit;
