begin;
alter table public.collection_payments
 add column if not exists rejection_reason text,
 add column if not exists rejected_at timestamptz;

create or replace function public.review_settlement(target_id uuid,target_status text)
returns void language plpgsql security definer set search_path=public as $$
declare item public.trip_settlements;
begin
 if target_status is null or target_status not in ('confirmed','rejected') then raise exception 'สถานะไม่ถูกต้อง';end if;
 select * into item from public.trip_settlements where id=target_id for update;
 if not found or auth.uid() is null or not public.is_trip_member(item.trip_id)
 or not (item.to_user=auth.uid() or public.trip_finance_permission(item.trip_id,'confirm')) then
  raise insufficient_privilege using message='คุณไม่มีสิทธิ์ยืนยันรายการนี้';
 end if;
 if item.status='confirmed' then
  if target_status='confirmed' then return;end if;
  raise exception 'ยืนยันรับเงินแล้ว ไม่สามารถเปลี่ยนสถานะย้อนหลัง';
 end if;
 if item.status='rejected' and target_status='rejected' then return;end if;
 if item.status<>'pending' then raise exception 'กรุณาส่งสลิปใหม่ก่อนยืนยัน';end if;
 update public.trip_settlements set status=target_status,
  confirmed_at=case when target_status='confirmed' then now() else null end,
  confirmed_by=case when target_status='confirmed' then auth.uid() else null end
 where id=target_id;
end $$;

-- Protect confirmed history through direct writes as well as the RPC.
create function public.preserve_confirmed_settlement() returns trigger language plpgsql set search_path=public as $$
begin
 if old.status='confirmed' and (
  new.status is distinct from old.status or new.trip_id is distinct from old.trip_id
  or new.from_user is distinct from old.from_user or new.to_user is distinct from old.to_user
  or new.submitted_by is distinct from old.submitted_by or new.amount is distinct from old.amount
  or new.slip_path is distinct from old.slip_path or new.submitted_at is distinct from old.submitted_at
  or new.confirmed_at is distinct from old.confirmed_at or new.confirmed_by is distinct from old.confirmed_by
 ) then raise exception 'ยืนยันรับเงินแล้ว ไม่สามารถเปลี่ยนประวัติการชำระ';end if;
 return new;
end $$;
create trigger preserve_confirmed_settlement before update on public.trip_settlements for each row execute function public.preserve_confirmed_settlement();

create function public.reject_collection_payment(target_collection uuid,target_user uuid,target_slip text,target_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare c public.collections; item public.collection_payments;
begin
 select * into c from public.collections where id=target_collection;
 if c.id is null or auth.uid() is null or not public.is_trip_member(c.trip_id)
 or not (c.receiver_id=auth.uid() or public.trip_finance_permission(c.trip_id,'confirm')) then
  raise insufficient_privilege using message='เฉพาะผู้รับเงินหรือผู้มีสิทธิ์ตรวจเงินเท่านั้น';
 end if;
 if nullif(trim(target_reason),'') is null then raise exception 'ระบุเหตุผลที่ต้องแก้ไขสลิป';end if;
 select * into item from public.collection_payments where collection_id=target_collection and user_id=target_user for update;
 if not found or item.installment_superseded_at is not null then raise exception 'ไม่พบยอดชำระที่ใช้งานอยู่';end if;
 if item.status='unpaid' and item.rejected_at is not null and item.slip_url is not distinct from target_slip and item.rejection_reason=trim(target_reason) then return;end if;
 if item.status<>'pending' or item.slip_url is distinct from target_slip then raise exception 'สถานะหรือสลิปเปลี่ยนแล้ว กรุณาโหลดข้อมูลใหม่';end if;
 update public.collection_payments set status='unpaid',rejection_reason=trim(target_reason),rejected_at=now(),confirmed_at=null,received_amount=null
 where collection_id=target_collection and user_id=target_user;
end $$;

create or replace function public.submit_collection_payment(target_collection uuid,target_slip text,target_user uuid default null)
returns void language plpgsql security definer set search_path=public as $$
declare paid_for uuid:=coalesce(target_user,auth.uid());item public.collection_payments;tid uuid;
begin
 if auth.uid() is null then raise insufficient_privilege using message='กรุณาเข้าสู่ระบบก่อนแจ้งชำระ';end if;
 select trip_id into tid from public.collections where id=target_collection;
 if tid is null or not public.is_trip_member(tid) then raise insufficient_privilege using message='ไม่พบรายการชำระ หรือคุณไม่ได้อยู่ในทริปนี้';end if;
 select * into item from public.collection_payments where collection_id=target_collection and user_id=paid_for for update;
 if not found or item.installment_superseded_at is not null then raise exception 'ไม่พบยอดชำระที่ใช้งานอยู่';end if;
 if item.status='paid' then
  if item.slip_url is not distinct from target_slip then return;end if;
  raise exception 'ยืนยันรับเงินแล้ว ไม่สามารถส่งสลิปทับประวัติเดิม';
 end if;
 if item.status='pending' and item.submitted_by is distinct from auth.uid() then raise insufficient_privilege using message='มีสลิปรอตรวจจากสมาชิกอื่นแล้ว';end if;
 if not public.valid_trip_financial_attachment(tid,target_slip,true) then raise insufficient_privilege using message='ใช้สลิปที่คุณอัปโหลดในทริปนี้';end if;
 if item.status='pending' and item.slip_url is not distinct from target_slip and item.submitted_by=auth.uid() then return;end if;
 update public.collection_payments set status='pending',slip_url=target_slip,submitted_by=auth.uid(),confirmed_at=null,rejection_reason=null,rejected_at=null
 where collection_id=target_collection and user_id=paid_for;
end $$;
-- Remove the obsolete overload: the guarded three-argument API already
-- defaults target_user to auth.uid(), so old two-argument calls remain valid.
-- Keeping both signatures makes PostgreSQL's default-argument dispatch ambiguous.
drop function if exists public.submit_collection_payment(uuid,text);
revoke all on function public.submit_collection_payment(uuid,text,uuid) from public,anon;
grant execute on function public.submit_collection_payment(uuid,text,uuid) to authenticated;

revoke all on function public.reject_collection_payment(uuid,uuid,text,text) from public,anon;
grant execute on function public.reject_collection_payment(uuid,uuid,text,text) to authenticated;
revoke all on function public.preserve_confirmed_settlement() from public,anon,authenticated;
commit;
