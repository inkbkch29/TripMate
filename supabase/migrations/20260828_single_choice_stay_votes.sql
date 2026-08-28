-- Enforce one accommodation choice per voter and make changing a vote atomic.
-- Signed-in members are keyed by account; guests keep using their normalized nickname.

-- Keep only the latest choice if older app versions created multiple rows.
delete from public.stay_poll_votes older
using public.stay_poll_votes newer
where older.poll_id = newer.poll_id
  and older.voter_key = newer.voter_key
  and (
    older.created_at < newer.created_at
    or (older.created_at = newer.created_at and older.ctid < newer.ctid)
  );

create unique index if not exists stay_poll_votes_one_choice_per_voter
  on public.stay_poll_votes (poll_id, voter_key);

create or replace function public.cast_stay_vote(
  poll_token uuid,
  voter text,
  option_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  poll_id_value uuid;
  selected_option_id uuid;
  voter_key_value text;
  legacy_name_key text;
begin
  if length(trim(coalesce(voter, ''))) < 1 then
    raise exception 'กรุณาใส่ชื่อก่อนโหวต';
  end if;

  if coalesce(cardinality(option_ids), 0) <> 1 then
    raise exception 'เลือกที่พักได้เพียง 1 แห่ง';
  end if;

  select id
  into poll_id_value
  from public.stay_polls
  where token = poll_token
    and status = 'open';

  if poll_id_value is null then
    raise exception 'โพลนี้ปิดแล้ว';
  end if;

  selected_option_id := option_ids[1];

  if not exists (
    select 1
    from public.stay_poll_options
    where id = selected_option_id
      and poll_id = poll_id_value
  ) then
    raise exception 'ไม่พบตัวเลือกที่พักนี้';
  end if;

  legacy_name_key := md5(lower(trim(voter)));
  voter_key_value := case
    when auth.uid() is not null then 'user:' || auth.uid()::text
    else legacy_name_key
  end;

  -- Remove a legacy nickname-keyed vote when the same person is now signed in.
  if auth.uid() is not null then
    delete from public.stay_poll_votes
    where poll_id = poll_id_value
      and voter_key = legacy_name_key;
  end if;

  insert into public.stay_poll_votes (
    poll_id,
    option_id,
    voter_key,
    voter_name,
    created_at
  ) values (
    poll_id_value,
    selected_option_id,
    voter_key_value,
    trim(voter),
    now()
  )
  on conflict (poll_id, voter_key)
  do update set
    option_id = excluded.option_id,
    voter_name = excluded.voter_name,
    created_at = excluded.created_at;
end;
$$;

revoke all on function public.cast_stay_vote(uuid, text, uuid[]) from public;
grant execute on function public.cast_stay_vote(uuid, text, uuid[]) to anon, authenticated;
