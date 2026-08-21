-- One reusable trip link with owner approval for every new member.
-- Run once after the earlier TripMate migrations.

alter table public.trip_invites
  add column if not exists is_reusable boolean not null default false;

create table if not exists public.trip_join_requests (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  invite_id uuid references public.trip_invites(id) on delete set null,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  unique(trip_id,user_id)
);

alter table public.trip_join_requests enable row level security;
drop policy if exists "users read own join requests" on public.trip_join_requests;
drop policy if exists "owners read trip join requests" on public.trip_join_requests;
create policy "users read own join requests" on public.trip_join_requests
for select to authenticated using(user_id=auth.uid());
create policy "owners read trip join requests" on public.trip_join_requests
for select to authenticated using(exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=auth.uid()));

-- The UI keeps calling the existing function, but it now returns one active
-- reusable URL per trip instead of creating a new one for every friend.
create or replace function public.create_trip_invite(target_trip uuid,invite_label text default null)
returns uuid language plpgsql security definer set search_path=public
as $$
declare shared_token uuid;
begin
  if not exists(select 1 from public.trips where id=target_trip and owner_id=auth.uid()) then
    raise exception 'เฉพาะเจ้าของทริปเท่านั้นที่สร้างลิงก์ได้';
  end if;
  select token into shared_token from public.trip_invites
  where trip_id=target_trip and is_reusable and revoked_at is null and expires_at>now()
  order by created_at desc limit 1;
  if shared_token is null then
    insert into public.trip_invites(trip_id,label,invited_by,expires_at,is_reusable)
    values(target_trip,'ลิงก์เข้าร่วมทริป',auth.uid(),now()+interval '1 year',true)
    returning token into shared_token;
  end if;
  return shared_token;
end;
$$;

create or replace function public.request_trip_join(invite_token uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare selected_invite public.trip_invites%rowtype;
declare request_status text;
begin
  select * into selected_invite from public.trip_invites where token=invite_token;
  if not found then raise exception 'ไม่พบลิงก์เข้าร่วมทริป'; end if;
  if not selected_invite.is_reusable then raise exception 'ลิงก์เชิญแบบเก่าใช้ไม่ได้แล้ว กรุณาขอลิงก์ใหม่จากแอดมิน'; end if;
  if selected_invite.revoked_at is not null then raise exception 'ลิงก์นี้ถูกปิดใช้งานแล้ว'; end if;
  if selected_invite.expires_at<=now() then raise exception 'ลิงก์นี้หมดอายุแล้ว'; end if;
  if exists(select 1 from public.trip_members where trip_id=selected_invite.trip_id and user_id=auth.uid()) then
    return jsonb_build_object('trip_id',selected_invite.trip_id,'status','approved');
  end if;
  insert into public.trip_join_requests(trip_id,user_id,invite_id,status,requested_at,reviewed_at,reviewed_by)
  values(selected_invite.trip_id,auth.uid(),selected_invite.id,'pending',now(),null,null)
  on conflict(trip_id,user_id) do update set
    invite_id=excluded.invite_id,
    status=case when trip_join_requests.status='approved' then 'approved' else 'pending' end,
    requested_at=case when trip_join_requests.status='rejected' then now() else trip_join_requests.requested_at end,
    reviewed_at=case when trip_join_requests.status='rejected' then null else trip_join_requests.reviewed_at end,
    reviewed_by=case when trip_join_requests.status='rejected' then null else trip_join_requests.reviewed_by end
  returning status into request_status;
  return jsonb_build_object('trip_id',selected_invite.trip_id,'status',request_status);
end;
$$;

-- Keep the old RPC name working for already deployed clients.
drop function if exists public.claim_trip_invite(uuid);
create or replace function public.claim_trip_invite(invite_token uuid)
returns jsonb language sql security definer set search_path=public
as $$ select public.request_trip_join(invite_token) $$;

create or replace function public.list_trip_join_requests(target_trip uuid)
returns table(id uuid,user_id uuid,display_name text,email text,avatar_url text,status text,requested_at timestamptz)
language plpgsql security definer set search_path=public,auth
as $$
begin
  if not exists(select 1 from public.trips t where t.id=target_trip and t.owner_id=auth.uid()) then
    raise exception 'เฉพาะเจ้าของทริปเท่านั้นที่ดูคำขอได้';
  end if;
  return query select r.id,r.user_id,p.display_name,u.email::text,p.avatar_url,r.status,r.requested_at
  from public.trip_join_requests r join public.profiles p on p.id=r.user_id join auth.users u on u.id=r.user_id
  where r.trip_id=target_trip order by r.requested_at desc;
end;
$$;

create or replace function public.get_trip_join_status(invite_token uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare selected_invite public.trip_invites%rowtype;
declare request_status text;
begin
  select * into selected_invite from public.trip_invites where token=invite_token;
  if not found then raise exception 'ไม่พบลิงก์เข้าร่วมทริป'; end if;
  if exists(select 1 from public.trip_members where trip_id=selected_invite.trip_id and user_id=auth.uid()) then
    return jsonb_build_object('trip_id',selected_invite.trip_id,'status','approved');
  end if;
  select status into request_status from public.trip_join_requests
  where trip_id=selected_invite.trip_id and user_id=auth.uid();
  return jsonb_build_object('trip_id',selected_invite.trip_id,'status',coalesce(request_status,'none'));
end;
$$;

create or replace function public.review_trip_join_request(target_request uuid,target_status text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare selected_request public.trip_join_requests%rowtype;
begin
  if target_status not in ('approved','rejected') then raise exception 'สถานะไม่ถูกต้อง'; end if;
  select r.* into selected_request from public.trip_join_requests r join public.trips t on t.id=r.trip_id
  where r.id=target_request and t.owner_id=auth.uid() for update;
  if not found then raise exception 'ไม่พบคำขอ หรือคุณไม่มีสิทธิ์อนุมัติ'; end if;
  update public.trip_join_requests set status=target_status,reviewed_at=now(),reviewed_by=auth.uid()
  where id=target_request;
  if target_status='approved' then
    insert into public.trip_members(trip_id,user_id,trip_role)
    values(selected_request.trip_id,selected_request.user_id,'member') on conflict do nothing;
  else
    delete from public.trip_members where trip_id=selected_request.trip_id and user_id=selected_request.user_id;
  end if;
  return selected_request.trip_id;
end;
$$;

revoke all on function public.create_trip_invite(uuid,text) from public;
revoke all on function public.request_trip_join(uuid) from public;
revoke all on function public.claim_trip_invite(uuid) from public;
revoke all on function public.list_trip_join_requests(uuid) from public;
revoke all on function public.get_trip_join_status(uuid) from public;
revoke all on function public.review_trip_join_request(uuid,text) from public;
grant execute on function public.create_trip_invite(uuid,text) to authenticated;
grant execute on function public.request_trip_join(uuid) to authenticated;
grant execute on function public.claim_trip_invite(uuid) to authenticated;
grant execute on function public.list_trip_join_requests(uuid) to authenticated;
grant execute on function public.get_trip_join_status(uuid) to authenticated;
grant execute on function public.review_trip_join_request(uuid,text) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','trip_members','trip_join_requests'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then
      execute format('alter publication supabase_realtime add table public.%I',table_name);
    end if;
  end loop;
end $$;
