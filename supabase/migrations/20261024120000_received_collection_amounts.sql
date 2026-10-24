begin;
alter table public.collection_payments add column if not exists received_amount numeric(12,2) check(received_amount>=0);
create or replace function public.confirm_collection_received(target_collection uuid,target_user uuid,actual_amount numeric)
returns void language plpgsql security definer set search_path=public as $$
declare due numeric;
begin
 if not exists(select 1 from public.collections c join public.trips t on t.id=c.trip_id left join public.trip_members m on m.trip_id=c.trip_id and m.user_id=auth.uid() where c.id=target_collection and (c.receiver_id=auth.uid() or t.owner_id=auth.uid() or m.trip_role='treasurer')) then raise exception 'Only the receiver or money manager can confirm'; end if;
 select amount into due from public.collection_payments where collection_id=target_collection and user_id=target_user for update;
 if due is null or actual_amount is null or actual_amount<due or actual_amount::text in ('NaN','Infinity','-Infinity') or actual_amount<>round(actual_amount,2) then raise exception 'Received amount must cover the amount due'; end if;
 update public.collection_payments set received_amount=actual_amount,status='paid',confirmed_at=coalesce(confirmed_at,now()) where collection_id=target_collection and user_id=target_user;
end $$;
revoke all on function public.confirm_collection_received(uuid,uuid,numeric) from public;
grant execute on function public.confirm_collection_received(uuid,uuid,numeric) to authenticated;
commit;
