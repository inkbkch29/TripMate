-- Show the nickname attached to each public accommodation vote.
-- The poll link is intentionally public, so expose display names only (never email or user id).
create or replace function public.stay_poll_snapshot(poll_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', p.id,
    'token', p.token,
    'title', p.title,
    'status', p.status,
    'winner_option_id', p.winner_option_id,
    'closed_at', p.closed_at,
    'member_count', (select count(*) from public.trip_members m where m.trip_id = p.trip_id),
    'voter_count', (select count(distinct v.voter_key) from public.stay_poll_votes v where v.poll_id = p.id),
    'trip', jsonb_build_object('name', t.name, 'start_date', t.start_date, 'end_date', t.end_date),
    'options', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'details', o.details,
        'pros', o.pros,
        'cons', o.cons,
        'price', o.price,
        'image_url', o.image_url,
        'votes', (select count(*) from public.stay_poll_votes v where v.option_id = o.id),
        'voters', coalesce((
          select jsonb_agg(v.voter_name order by v.created_at)
          from public.stay_poll_votes v
          where v.option_id = o.id
        ), '[]'::jsonb)
      ) order by o.sort_order, o.id)
      from public.stay_poll_options o
      where o.poll_id = p.id
    ), '[]'::jsonb)
  into result
  from public.stay_polls p
  join public.trips t on t.id = p.trip_id
  where p.token = poll_token;

  if result is null then
    raise exception 'ไม่พบลิงก์โหวตหรือหมดอายุ';
  end if;

  return result;
end;
$$;

revoke all on function public.stay_poll_snapshot(uuid) from public;
grant execute on function public.stay_poll_snapshot(uuid) to anon, authenticated;

