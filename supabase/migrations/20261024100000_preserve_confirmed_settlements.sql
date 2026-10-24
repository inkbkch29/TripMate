begin;
-- A later transfer must not overwrite the history already deducted from balances.
alter table public.trip_settlements drop constraint if exists trip_settlements_trip_id_from_user_to_user_key;
create unique index if not exists trip_settlements_active_pair_idx on public.trip_settlements(trip_id,from_user,to_user) where status <> 'confirmed';
create or replace function public.submit_settlement(target_trip uuid,target_to uuid,target_amount numeric,target_slip text)
returns uuid language plpgsql security definer set search_path=public as $$
declare settlement_id uuid;
begin
 if target_amount is null or target_amount<=0 or target_amount::text in ('NaN','Infinity','-Infinity') or target_amount<>round(target_amount,2) or not public.is_trip_member(target_trip) then raise exception 'Invalid transfer'; end if;
 if target_to=auth.uid() or not exists(select 1 from public.trip_members where trip_id=target_trip and user_id=target_to) then raise exception 'Invalid recipient'; end if;
 insert into public.trip_settlements(trip_id,from_user,to_user,amount,status,slip_path,submitted_at,confirmed_at,confirmed_by)
 values(target_trip,auth.uid(),target_to,target_amount,'pending',target_slip,now(),null,null)
 on conflict(trip_id,from_user,to_user) where status <> 'confirmed' do update
 set amount=excluded.amount,status='pending',slip_path=excluded.slip_path,submitted_at=now(),confirmed_at=null,confirmed_by=null
 returning id into settlement_id;
 return settlement_id;
end $$;
commit;
