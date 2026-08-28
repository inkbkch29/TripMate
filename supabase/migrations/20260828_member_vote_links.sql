create or replace function public.list_trip_vote_links(target_trip uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare result jsonb;
begin
  if not public.is_trip_member(target_trip) then
    raise exception 'ไม่มีสิทธิ์เข้าถึงโหวตของทริปนี้';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'token', p.token,
    'title', p.title,
    'status', p.status,
    'winner_option_id', p.winner_option_id,
    'option_count', (select count(*) from public.stay_poll_options o where o.poll_id=p.id),
    'voter_count', (select count(distinct v.voter_key) from public.stay_poll_votes v where v.poll_id=p.id)
  ) order by (p.status='open') desc, p.created_at desc), '[]'::jsonb)
  into result
  from public.stay_polls p
  where p.trip_id=target_trip;

  return result;
end;
$$;

revoke all on function public.list_trip_vote_links(uuid) from public;
grant execute on function public.list_trip_vote_links(uuid) to authenticated;
