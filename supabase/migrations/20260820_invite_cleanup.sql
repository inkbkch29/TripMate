-- Allow trip owners to permanently remove old invite records from their list.
create or replace function public.delete_trip_invite(target_invite uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  delete from public.trip_invites i
  where i.id=target_invite
    and exists(select 1 from public.trips t where t.id=i.trip_id and t.owner_id=auth.uid());
  if not found then raise exception 'ไม่พบลิงก์เชิญ หรือคุณไม่มีสิทธิ์ลบ'; end if;
end;
$$;

revoke all on function public.delete_trip_invite(uuid) from public;
grant execute on function public.delete_trip_invite(uuid) to authenticated;
