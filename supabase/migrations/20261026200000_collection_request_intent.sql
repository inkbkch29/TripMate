begin;
-- Opt-in for new request-only collections. Historical bills retain their meaning.
alter table public.collections add column collection_only boolean not null default false;
create function public.protect_collection_request_intent() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' and new.collection_only is distinct from old.collection_only then raise exception 'เปลี่ยนประเภทรายการย้อนหลังไม่ได้';end if;
 if new.collection_only and (new.is_fund or new.expense_id is not null or new.installment_id is not null or new.fund_remainder<>0) then raise exception 'รายการเรียกเก็บแยกจากค่าใช้จ่ายและกองกลาง';end if;
 return new;
end $$;
create trigger protect_collection_request_intent before insert or update on public.collections for each row execute function public.protect_collection_request_intent();
create function public.save_collection_request(target_trip uuid,target_id uuid,payload jsonb) returns void language plpgsql security definer set search_path=public as $$
declare c public.collections; receiver uuid; total bigint; entry record; amounts jsonb; actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from public.trips t join public.trip_members m on m.trip_id=t.id and m.user_id=actor where t.id=target_trip and (t.owner_id=actor or m.trip_role='treasurer' or t.members_can_add_collections)) then raise exception 'ไม่มีสิทธิ์สร้างรายการเรียกเก็บ' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_id::text,0));
 select * into c from public.collections where id=target_id for update;
 if c.id is not null and (c.trip_id<>target_trip or not c.collection_only or not (c.created_by=actor or exists(select 1 from public.trips t left join public.trip_members m on m.trip_id=t.id and m.user_id=actor where t.id=target_trip and (t.owner_id=actor or m.trip_role='treasurer')))) then raise exception 'ไม่มีสิทธิ์แก้รายการนี้' using errcode='42501';end if;
 receiver:=(payload->>'receiver_id')::uuid;amounts:=payload->'amounts';
 if nullif(trim(payload->>'title'),'') is null or jsonb_typeof(amounts) is distinct from 'object' or amounts='{}' then raise exception 'กรอกชื่อรายการและยอดรายคน';end if;
 if not exists(select 1 from public.trip_members where trip_id=target_trip and user_id=receiver) then raise exception 'ผู้รับเงินไม่อยู่ในทริป';end if;
 total:=0;
 for entry in select * from jsonb_each_text(amounts) loop
  if entry.value!~'^[0-9]+$' or entry.value::numeric<=0 or entry.value::numeric>100000000000 then raise exception 'ยอดเงินต้องเป็นสตางค์จำนวนเต็มบวก';end if;
  if not exists(select 1 from public.trip_members where trip_id=target_trip and user_id=entry.key::uuid) then raise exception 'สมาชิกไม่อยู่ในทริป';end if;
  total:=total+entry.value::bigint;
 end loop;
 -- A retry is harmless; paid/slip history must never be rewritten.
 if c.id is not null and exists(select 1 from public.collection_payments p where p.collection_id=c.id and (p.status<>'unpaid' or p.slip_url is not null)) then
  if c.title=trim(payload->>'title') and c.receiver_id=receiver and c.due_date is not distinct from (payload->>'due')::date and (select jsonb_object_agg(user_id::text,(amount*100)::bigint) from public.collection_payments where collection_id=c.id)=amounts then return;end if;
  raise exception 'รายการนี้มีการชำระหรือส่งสลิปแล้ว กรุณาสร้างรายการใหม่เพื่อรักษาประวัติ';
 end if;
 insert into public.collections(id,trip_id,title,amount,original_amount,fund_remainder,is_fund,collection_only,receiver_id,due_date,created_by)
 values(target_id,target_trip,trim(payload->>'title'),total/100.0,total/100.0,0,false,true,receiver,(payload->>'due')::date,actor)
 on conflict(id) do update set title=excluded.title,amount=excluded.amount,original_amount=excluded.original_amount,receiver_id=excluded.receiver_id,due_date=excluded.due_date;
 delete from public.collection_payments where collection_id=target_id and not(amounts?user_id::text);
 for entry in select * from jsonb_each_text(amounts) loop
  insert into public.collection_payments(collection_id,user_id,amount,status)values(target_id,entry.key::uuid,entry.value::bigint/100.0,'unpaid')
  on conflict(collection_id,user_id)do update set amount=excluded.amount;
 end loop;
end $$;
revoke all on function public.save_collection_request(uuid,uuid,jsonb) from public,anon;
grant execute on function public.save_collection_request(uuid,uuid,jsonb) to authenticated;
-- A request is never an actual bill, nor an available rounding surplus.
do $$declare definition text;begin
 definition:=pg_get_functiondef('public.trip_fund_rounding(uuid)'::regprocedure);
 if position('where c.trip_id=tid and not c.is_fund' in definition)=0 then raise exception 'Unexpected rounding definition';end if;
 execute replace(definition,'where c.trip_id=tid and not c.is_fund','where c.trip_id=tid and not c.is_fund and not c.collection_only');
 definition:=pg_get_functiondef('public.guest_trip_snapshot(uuid)'::regprocedure);
 if position('from public.collections c where c.trip_id=t.id' in definition)=0 then raise exception 'Unexpected guest snapshot';end if;
 execute replace(definition,'from public.collections c where c.trip_id=t.id','from public.collections c where c.trip_id=t.id and not c.collection_only');
end $$;
-- Prevent a request from being reclassified through older management APIs.
create function public.guard_request_fund_transaction() returns trigger language plpgsql set search_path=public as $$
begin
 if new.type in ('rounding','expense') and exists(select 1 from public.collections where id=new.collection_id and collection_only) then raise exception 'รายการเรียกเก็บไม่ใช่บิลจริงหรือส่วนเกินกองกลาง';end if;
 return new;
end $$;
create trigger guard_request_fund_transaction before insert on public.trip_fund_transactions for each row execute function public.guard_request_fund_transaction();
create function public.guard_request_payment_history() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from public.collections where id=old.collection_id and collection_only) and (old.status<>'unpaid' or old.slip_url is not null) and (tg_op='DELETE' or new.amount is distinct from old.amount or new.user_id is distinct from old.user_id or new.collection_id is distinct from old.collection_id) then raise exception 'รักษายอดและประวัติการชำระเดิม';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger guard_request_payment_history before update or delete on public.collection_payments for each row execute function public.guard_request_payment_history();
commit;
