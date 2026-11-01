begin;
alter table public.trip_settlements add column if not exists submitted_by uuid references auth.users(id);
update public.trip_settlements set submitted_by=from_user where submitted_by is null;

-- Debt belongs to target_from; the authenticated member owns the uploaded slip.
create or replace function public.submit_settlement_for_member(target_trip uuid,target_to uuid,target_amount numeric,target_slip text,target_from uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare existing public.trip_settlements; settlement_id uuid;
begin
 if auth.uid() is null or not public.is_trip_member(target_trip) then raise insufficient_privilege using message='กรุณาเข้าสู่ระบบด้วยบัญชีสมาชิกทริป';end if;
 if target_from is null or target_to is null or target_from=target_to or auth.uid()=target_to
 or not exists(select 1 from public.trip_members where trip_id=target_trip and user_id=target_from)
 or not exists(select 1 from public.trip_members where trip_id=target_trip and user_id=target_to)
 then raise exception 'Invalid transfer members';end if;
 if target_amount is null or target_amount<=0 or target_amount::text in ('NaN','Infinity','-Infinity') or target_amount<>round(target_amount,2) then raise exception 'Invalid transfer amount';end if;
 if not public.valid_trip_financial_attachment(target_trip,target_slip,true) then raise insufficient_privilege using message='ใช้สลิปที่คุณอัปโหลดในทริปนี้';end if;
 -- Serialize submissions even when no active row exists yet.
 perform pg_advisory_xact_lock(hashtextextended(target_trip::text||':'||target_from::text||':'||target_to::text,0));
 select * into existing from public.trip_settlements where trip_id=target_trip and from_user=target_from and to_user=target_to and status<>'confirmed' for update;
 if found and existing.status='pending' then
  if coalesce(existing.submitted_by,existing.from_user)=auth.uid() and existing.slip_path is not distinct from target_slip and existing.amount=target_amount then return existing.id;end if;
  raise exception 'มีสลิปรอตรวจแล้ว กรุณารอผู้รับตรวจสอบก่อน';
 end if;
 insert into public.trip_settlements(trip_id,from_user,to_user,submitted_by,amount,status,slip_path,submitted_at,confirmed_at,confirmed_by)
 values(target_trip,target_from,target_to,auth.uid(),target_amount,'pending',target_slip,now(),null,null)
 on conflict(trip_id,from_user,to_user) where status<>'confirmed' do update
 set submitted_by=excluded.submitted_by,amount=excluded.amount,status='pending',slip_path=excluded.slip_path,submitted_at=now(),confirmed_at=null,confirmed_by=null
 returning id into settlement_id;
 return settlement_id;
end $$;
revoke all on function public.submit_settlement_for_member(uuid,uuid,numeric,text,uuid) from public;
grant execute on function public.submit_settlement_for_member(uuid,uuid,numeric,text,uuid) to authenticated;
create or replace function public.submit_settlement(target_trip uuid,target_to uuid,target_amount numeric,target_slip text)
returns uuid language plpgsql security definer set search_path=public as $$
begin
 return public.submit_settlement_for_member(target_trip,target_to,target_amount,target_slip,auth.uid());
end $$;
commit;
