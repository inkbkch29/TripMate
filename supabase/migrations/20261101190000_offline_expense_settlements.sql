begin;
alter table public.trip_settlements
 add column receipt_method text not null default 'slip' check(receipt_method in ('slip','offline')),
 add column receipt_note text,
 add column offline_request_id uuid;
create unique index trip_settlement_offline_request on public.trip_settlements(trip_id,offline_request_id) where offline_request_id is not null;

create function public.record_offline_settlement(target_trip uuid,target_from uuid,target_to uuid,target_amount numeric,target_note text,request_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare existing public.trip_settlements;sid uuid;debt bigint;credit bigint;cash bigint;
begin
 if auth.uid() is null or not public.is_trip_member(target_trip) or not (auth.uid()=target_to or public.trip_finance_permission(target_trip,'confirm')) then
  raise insufficient_privilege using message='เฉพาะผู้รับเงินหรือผู้มีสิทธิ์ยืนยันเงินเท่านั้น';end if;
 if target_from is null or target_to is null or target_from=target_to
 or not exists(select 1 from public.trip_members where trip_id=target_trip and user_id=target_from)
 or not exists(select 1 from public.trip_members where trip_id=target_trip and user_id=target_to) then raise exception 'สมาชิกไม่ถูกต้อง';end if;
 if request_id is null or nullif(trim(target_note),'') is null or length(target_note)>1000 then raise exception 'ระบุหมายเหตุการรับเงินไม่เกิน 1000 ตัวอักษร';end if;
 if target_amount is null or target_amount<=0 or target_amount::text in ('NaN','Infinity','-Infinity') or target_amount<>round(target_amount,2) then raise exception 'ยอดรับต้องมากกว่า 0 และไม่เกิน 2 ตำแหน่ง';end if;
 -- Serialize offline records for this trip and share the upload API's pair lock.
 perform pg_advisory_xact_lock(hashtextextended('offline:'||target_trip::text,0));
 perform pg_advisory_xact_lock(hashtextextended(target_trip::text||':'||target_from::text||':'||target_to::text,0));
 select * into existing from public.trip_settlements where trip_id=target_trip and offline_request_id=request_id;
 if found then
  if existing.from_user=target_from and existing.to_user=target_to and existing.amount=target_amount and existing.receipt_note=trim(target_note) and existing.confirmed_by=auth.uid() then return existing.id;end if;
  raise exception 'รหัสรายการนี้ถูกใช้แล้ว';
 end if;
 if exists(select 1 from public.trip_settlements where trip_id=target_trip and status='pending' and (from_user in (target_from,target_to) or to_user in (target_from,target_to))) then
  raise exception 'มีสลิปรอตรวจของสมาชิกนี้ กรุณาตรวจสลิปก่อนเพื่อไม่หักยอดซ้ำ';end if;
 -- Match the expense ledger: approved ordinary bills only, exclude collections
 -- and installment parents; use the same largest-remainder fund allocation.
 with eligible as (
  select e.*,greatest(0,round(e.amount*100)::bigint-least(round(e.amount*100)::bigint,e.fund_paid_satang)) as outstanding
  from public.expenses e where e.trip_id=target_trip and (e.approval_status is null or e.approval_status='approved') and not e.is_installment_parent
  and exists(select 1 from public.trip_members where trip_id=target_trip and user_id=e.paid_by)
  and not exists(select 1 from public.collections c where c.expense_id=e.id)
 ),entries as (
  select paid_by as uid,outstanding as value from eligible
  union all
  select p.key::uuid,-p.value::bigint from eligible e
  cross join lateral jsonb_each_text(public.trip_fund_allocate(e.outstanding,coalesce((select jsonb_object_agg(user_id::text,round(share_amount*100)::bigint) from public.expense_participants where expense_id=e.id),'{}'))) p
  union all
  select s.from_user,round(s.amount*100)::bigint from public.trip_settlements s where s.trip_id=target_trip and s.status='confirmed'
   and exists(select 1 from public.trip_members where trip_id=target_trip and user_id=s.from_user) and exists(select 1 from public.trip_members where trip_id=target_trip and user_id=s.to_user)
  union all
  select s.to_user,-round(s.amount*100)::bigint from public.trip_settlements s where s.trip_id=target_trip and s.status='confirmed'
   and exists(select 1 from public.trip_members where trip_id=target_trip and user_id=s.from_user) and exists(select 1 from public.trip_members where trip_id=target_trip and user_id=s.to_user)
 ) select -coalesce(sum(value)filter(where uid=target_from),0),coalesce(sum(value)filter(where uid=target_to),0) into debt,credit from entries;
 cash:=round(target_amount*100)::bigint;
 if cash>least(debt,credit) then raise exception 'ยอดค้างเปลี่ยนแล้ว หรือยอดรับเกินยอดค้าง กรุณาโหลดข้อมูลใหม่';end if;
 insert into public.trip_settlements(trip_id,from_user,to_user,amount,status,submitted_by,submitted_at,confirmed_at,confirmed_by,receipt_method,receipt_note,offline_request_id)
 values(target_trip,target_from,target_to,target_amount,'confirmed',auth.uid(),now(),now(),auth.uid(),'offline',trim(target_note),request_id) returning id into sid;
 return sid;
end $$;
revoke all on function public.record_offline_settlement(uuid,uuid,uuid,numeric,text,uuid) from public,anon;
grant execute on function public.record_offline_settlement(uuid,uuid,uuid,numeric,text,uuid) to authenticated;
-- Protect offline audit fields just like confirmed amounts and counterparties.
create function public.preserve_settlement_receipt_audit() returns trigger language plpgsql set search_path=public as $$begin
 if old.status='confirmed' and (new.receipt_method is distinct from old.receipt_method or new.receipt_note is distinct from old.receipt_note or new.offline_request_id is distinct from old.offline_request_id) then raise exception 'แก้ประวัติรับเงินที่ยืนยันแล้วไม่ได้';end if;return new;end $$;
create trigger preserve_settlement_receipt_audit before update on public.trip_settlements for each row execute function public.preserve_settlement_receipt_audit();
revoke all on function public.preserve_settlement_receipt_audit() from public,anon,authenticated;
commit;
