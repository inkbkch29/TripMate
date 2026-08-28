create or replace function public.reset_stay_poll_votes(poll_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_poll uuid;
begin
  select p.id
  into target_poll
  from public.stay_polls p
  join public.trips t on t.id = p.trip_id
  where p.token = poll_token
    and t.owner_id = auth.uid();

  if target_poll is null then
    raise exception 'ไม่พบโพลหรือไม่มีสิทธิ์รีเซ็ตผลโหวต';
  end if;

  delete from public.stay_poll_votes where poll_id = target_poll;
end;
$$;

revoke all on function public.reset_stay_poll_votes(uuid) from public;
grant execute on function public.reset_stay_poll_votes(uuid) to authenticated;
