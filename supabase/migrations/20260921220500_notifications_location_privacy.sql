create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  type text not null,
  title text not null default 'TripMate',
  body text not null,
  target jsonb not null default '{}'::jsonb,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(recipient_id,dedupe_key)
);
create index if not exists user_notifications_recipient_time_idx on public.user_notifications(recipient_id,created_at desc);
alter table public.user_notifications enable row level security;
create policy "users read own notifications" on public.user_notifications for select to authenticated using(recipient_id=auth.uid());
create policy "users update own notifications" on public.user_notifications for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
create policy "users create own notifications" on public.user_notifications for insert to authenticated with check(recipient_id=auth.uid());

create table if not exists public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(user_id,type)
);
alter table public.notification_preferences enable row level security;
create policy "users manage own notification preferences" on public.notification_preferences for all to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());

create table if not exists public.location_consents (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  policy_version text not null default '2026-09-21',
  consented_at timestamptz not null default now(),
  revoked_at timestamptz,
  auto_stop_at timestamptz,
  primary key(trip_id,user_id)
);
alter table public.location_consents enable row level security;
create policy "users manage own location consent" on public.location_consents for all to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid() and public.is_trip_member(trip_id));

create or replace function public.notify_trip_activity()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.user_notifications(recipient_id,trip_id,type,title,body,target,dedupe_key)
  select m.user_id,new.trip_id,coalesce(new.entity_type,new.kind),'TripMate',new.message,
    jsonb_build_object('entityType',new.entity_type,'entityId',new.entity_id),
    'activity:'||new.id::text
  from public.trip_members m
  where m.trip_id=new.trip_id and m.user_id is distinct from new.actor_id
    and coalesce((select p.enabled from public.notification_preferences p where p.user_id=m.user_id and p.type=coalesce(new.entity_type,new.kind)),true);
  return new;
end; $$;
drop trigger if exists notify_trip_activity_members on public.trip_activity_log;
create trigger notify_trip_activity_members after insert on public.trip_activity_log
for each row execute function public.notify_trip_activity();

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='user_notifications') then
    alter publication supabase_realtime add table public.user_notifications;
  end if;
end $$;
