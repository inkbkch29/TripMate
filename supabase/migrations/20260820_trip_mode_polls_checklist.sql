-- Trip Mode, group polls, shared checklist and stop check-ins.
create table if not exists public.trip_polls (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  question text not null check (length(trim(question)) between 1 and 180),
  status text not null default 'open' check (status in ('open','closed')),
  closes_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.trip_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.trip_polls(id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 100),
  sort_order integer not null default 0
);

create table if not exists public.trip_poll_votes (
  poll_id uuid not null references public.trip_polls(id) on delete cascade,
  option_id uuid not null references public.trip_poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id,user_id)
);

create table if not exists public.trip_checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  assigned_to uuid references public.profiles(id) on delete set null,
  is_done boolean not null default false,
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.trip_stop_checkins (
  stop_id uuid not null references public.trip_stops(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  primary key (stop_id,user_id)
);

alter table public.trip_polls enable row level security;
alter table public.trip_poll_options enable row level security;
alter table public.trip_poll_votes enable row level security;
alter table public.trip_checklist_items enable row level security;
alter table public.trip_stop_checkins enable row level security;

drop policy if exists "members read polls" on public.trip_polls;
drop policy if exists "members create polls" on public.trip_polls;
drop policy if exists "creators manage polls" on public.trip_polls;
drop policy if exists "members read poll options" on public.trip_poll_options;
drop policy if exists "poll creators add options" on public.trip_poll_options;
drop policy if exists "members read votes" on public.trip_poll_votes;
drop policy if exists "members read checklist" on public.trip_checklist_items;
drop policy if exists "members create checklist" on public.trip_checklist_items;
drop policy if exists "members read checkins" on public.trip_stop_checkins;
drop policy if exists "users manage own checkins" on public.trip_stop_checkins;

create policy "members read polls" on public.trip_polls for select to authenticated using (public.is_trip_member(trip_id));
create policy "members create polls" on public.trip_polls for insert to authenticated with check (created_by=auth.uid() and public.is_trip_member(trip_id));
create policy "creators manage polls" on public.trip_polls for update to authenticated using (created_by=auth.uid() or exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=auth.uid())) with check (public.is_trip_member(trip_id));
create policy "members read poll options" on public.trip_poll_options for select to authenticated using (exists(select 1 from public.trip_polls p where p.id=poll_id and public.is_trip_member(p.trip_id)));
create policy "poll creators add options" on public.trip_poll_options for insert to authenticated with check (exists(select 1 from public.trip_polls p where p.id=poll_id and p.created_by=auth.uid()));
create policy "members read votes" on public.trip_poll_votes for select to authenticated using (exists(select 1 from public.trip_polls p where p.id=poll_id and public.is_trip_member(p.trip_id)));

create policy "members read checklist" on public.trip_checklist_items for select to authenticated using (public.is_trip_member(trip_id));
create policy "members create checklist" on public.trip_checklist_items for insert to authenticated with check (created_by=auth.uid() and public.is_trip_member(trip_id));

create policy "members read checkins" on public.trip_stop_checkins for select to authenticated using (exists(select 1 from public.trip_stops s where s.id=stop_id and public.is_trip_member(s.trip_id)));
create policy "users manage own checkins" on public.trip_stop_checkins for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and exists(select 1 from public.trip_stops s where s.id=stop_id and public.is_trip_member(s.trip_id)));

-- Members may add stops when enabled, but only the trip owner may edit, reorder or delete them.
drop policy if exists "allowed members manage stops" on public.trip_stops;
drop policy if exists "allowed members add stops" on public.trip_stops;
drop policy if exists "owner edits stops" on public.trip_stops;
drop policy if exists "owner deletes stops" on public.trip_stops;
create policy "allowed members add stops" on public.trip_stops for insert to authenticated
with check (exists(select 1 from public.trips t join public.trip_members tm on tm.trip_id=t.id and tm.user_id=auth.uid() where t.id=trip_id and (t.owner_id=auth.uid() or tm.trip_role='planner' or t.members_can_add_stops)));
create policy "owner edits stops" on public.trip_stops for update to authenticated
using (exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=auth.uid()))
with check (exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=auth.uid()));
create policy "owner deletes stops" on public.trip_stops for delete to authenticated
using (exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=auth.uid()));

create or replace function public.vote_trip_poll(target_poll uuid,target_option uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.trip_polls p join public.trip_poll_options o on o.poll_id=p.id where p.id=target_poll and o.id=target_option and p.status='open' and (p.closes_at is null or p.closes_at>now()) and public.is_trip_member(p.trip_id)) then
    raise exception 'โพลนี้ปิดแล้วหรือตัวเลือกไม่ถูกต้อง';
  end if;
  insert into public.trip_poll_votes(poll_id,option_id,user_id) values(target_poll,target_option,auth.uid())
  on conflict(poll_id,user_id) do update set option_id=excluded.option_id,created_at=now();
end; $$;

create or replace function public.toggle_trip_checklist(target_item uuid,target_done boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.trip_checklist_items i where i.id=target_item and public.is_trip_member(i.trip_id)) then raise exception 'ไม่พบรายการ'; end if;
  update public.trip_checklist_items set is_done=target_done,completed_by=case when target_done then auth.uid() else null end,completed_at=case when target_done then now() else null end where id=target_item;
end; $$;

create or replace function public.toggle_trip_stop_done(target_stop uuid,target_done boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.trip_stops s where s.id=target_stop and public.is_trip_member(s.trip_id)) then raise exception 'ไม่พบสถานที่'; end if;
  update public.trip_stops set is_done=target_done where id=target_stop;
end; $$;

revoke all on function public.vote_trip_poll(uuid,uuid) from public;
revoke all on function public.toggle_trip_checklist(uuid,boolean) from public;
revoke all on function public.toggle_trip_stop_done(uuid,boolean) from public;
grant execute on function public.vote_trip_poll(uuid,uuid) to authenticated;
grant execute on function public.toggle_trip_checklist(uuid,boolean) to authenticated;
grant execute on function public.toggle_trip_stop_done(uuid,boolean) to authenticated;

create index if not exists trip_polls_trip_created_idx on public.trip_polls(trip_id,created_at desc);
create index if not exists checklist_trip_done_idx on public.trip_checklist_items(trip_id,is_done,created_at);
