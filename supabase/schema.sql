-- Run once in Supabase SQL Editor. Review policies before production use.
create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  promptpay_id text,
  bank_name text,
  account_name text,
  payment_qr_path text,
  app_role text not null default 'member' check (app_role in ('admin','member')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.trips (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id),
  name text not null, cover_url text, description text, google_photos_url text, start_date date not null, end_date date not null,
  status text not null default 'planning' check (status in ('planning','active','completed','cancelled')),
  created_at timestamptz not null default now(), check (end_date >= start_date)
);
create table public.trip_members (
  trip_id uuid references public.trips(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade,
  trip_role text not null default 'member' check (trip_role in ('owner','planner','treasurer','member')),
  primary key (trip_id,user_id)
);
create table public.trip_stops (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  day_number int not null check (day_number > 0), start_time time, title text not null, place_name text not null,
  latitude double precision, longitude double precision, note text, sort_order int not null default 0,
  is_done boolean not null default false, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.live_locations (
  trip_id uuid references public.trips(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade,
  latitude double precision not null, longitude double precision not null, accuracy_m double precision,
  sharing_enabled boolean not null default true, updated_at timestamptz not null default now(),
  primary key (trip_id,user_id)
);
create table public.collections (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null, amount numeric(12,2) not null check (amount > 0), receiver_id uuid not null references public.profiles(id),
  due_date date not null, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.collection_payments (
  collection_id uuid references public.collections(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0), status text not null default 'unpaid' check (status in ('unpaid','pending','paid','refunded')),
  slip_url text, confirmed_at timestamptz, primary key (collection_id,user_id)
);
create table public.expenses (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null, amount numeric(12,2) not null check (amount > 0), paid_by uuid not null references public.profiles(id),
  category text not null default 'other', expense_date date not null default current_date,
  meal_period text not null default 'other' check (meal_period in ('breakfast','lunch','dinner','snack','other')),
  receipt_url text, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.expense_participants (
  expense_id uuid references public.expenses(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade,
  share_amount numeric(12,2) not null check (share_amount >= 0), primary key (expense_id,user_id)
);
create table public.trip_invites (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(), label text, invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'), claimed_by uuid references public.profiles(id),
  claimed_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now()
);

-- Every authenticated user gets a profile automatically on first signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1)));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_trip_member(target_trip uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.trip_members where trip_id=target_trip and user_id=auth.uid()) $$;

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_stops enable row level security;
alter table public.live_locations enable row level security;
alter table public.collections enable row level security;
alter table public.collection_payments enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_participants enable row level security;
alter table public.trip_invites enable row level security;

create policy "profiles visible to authenticated users" on public.profiles for select to authenticated using (true);
create policy "user updates own profile" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
create policy "members read trips" on public.trips for select to authenticated using (public.is_trip_member(id));
create policy "owner manages trips" on public.trips for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "members read memberships" on public.trip_members for select to authenticated using (public.is_trip_member(trip_id));
create policy "owner manages memberships" on public.trip_members for all to authenticated using (exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=auth.uid())) with check (exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=auth.uid()));
create policy "members manage stops" on public.trip_stops for all to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy "members read locations" on public.live_locations for select to authenticated using (public.is_trip_member(trip_id));
create policy "users manage own location" on public.live_locations for all to authenticated using (user_id=auth.uid() and public.is_trip_member(trip_id)) with check (user_id=auth.uid() and public.is_trip_member(trip_id));
create policy "members manage collections" on public.collections for all to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy "members read payments" on public.collection_payments for select to authenticated using (exists(select 1 from public.collections c where c.id=collection_id and public.is_trip_member(c.trip_id)));
create policy "users update own payments" on public.collection_payments for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "collection creators add payments" on public.collection_payments for insert to authenticated with check (exists(select 1 from public.collections c where c.id=collection_id and c.created_by=auth.uid()));
create policy "collection receivers manage payments" on public.collection_payments for all to authenticated using (exists(select 1 from public.collections c where c.id=collection_id and c.receiver_id=auth.uid())) with check (exists(select 1 from public.collections c where c.id=collection_id and c.receiver_id=auth.uid()));
create policy "members manage expenses" on public.expenses for all to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy "members read expense shares" on public.expense_participants for select to authenticated using (exists(select 1 from public.expenses e where e.id=expense_id and public.is_trip_member(e.trip_id)));
create policy "members add expense shares" on public.expense_participants for insert to authenticated with check (exists(select 1 from public.expenses e where e.id=expense_id and public.is_trip_member(e.trip_id)));
create policy "members update expense shares" on public.expense_participants for update to authenticated using (exists(select 1 from public.expenses e where e.id=expense_id and public.is_trip_member(e.trip_id))) with check (exists(select 1 from public.expenses e where e.id=expense_id and public.is_trip_member(e.trip_id)));
create policy "owners read invites" on public.trip_invites for select to authenticated using (exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=auth.uid()));

-- Owners generate a one-time URL token; no service-role key is exposed to the browser.
create or replace function public.create_trip_invite(target_trip uuid, invite_label text default null)
returns uuid language plpgsql security definer set search_path = public
as $$
declare new_token uuid;
begin
  if not exists(select 1 from public.trips where id=target_trip and owner_id=auth.uid()) then
    raise exception 'เฉพาะเจ้าของทริปเท่านั้นที่สร้างลิงก์เชิญได้';
  end if;
  insert into public.trip_invites (trip_id, label, invited_by)
  values (target_trip, invite_label, auth.uid()) returning token into new_token;
  return new_token;
end;
$$;

create or replace function public.claim_trip_invite(invite_token uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare selected_invite public.trip_invites%rowtype;
begin
  select * into selected_invite from public.trip_invites
  where token=invite_token and claimed_at is null and revoked_at is null and expires_at > now()
  for update;
  if not found then raise exception 'ลิงก์เชิญไม่ถูกต้อง ถูกใช้แล้ว หรือหมดอายุ'; end if;
  insert into public.trip_members (trip_id,user_id,trip_role)
  values (selected_invite.trip_id,auth.uid(),'member') on conflict do nothing;
  update public.trip_invites set claimed_by=auth.uid(),claimed_at=now() where id=selected_invite.id;
  return selected_invite.trip_id;
end;
$$;

revoke all on function public.create_trip_invite(uuid,text) from public;
revoke all on function public.claim_trip_invite(uuid) from public;
grant execute on function public.create_trip_invite(uuid,text) to authenticated;
grant execute on function public.claim_trip_invite(uuid) to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('avatars','avatars',true,2097152,array['image/jpeg','image/png','image/webp']),
       ('trip-files','trip-files',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy "avatar uploads" on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "avatar updates" on storage.objects for update to authenticated using (bucket_id='avatars' and owner_id=auth.uid()::text);
create policy "trip members read files" on storage.objects for select to authenticated using (bucket_id='trip-files');
create policy "users upload own trip files" on storage.objects for insert to authenticated with check (bucket_id='trip-files' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "users update own trip files" on storage.objects for update to authenticated using (bucket_id='trip-files' and owner_id=auth.uid()::text);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='live_locations') then
    alter publication supabase_realtime add table public.live_locations;
  end if;
end $$;
create index if not exists live_locations_updated_at_idx on public.live_locations(updated_at);
