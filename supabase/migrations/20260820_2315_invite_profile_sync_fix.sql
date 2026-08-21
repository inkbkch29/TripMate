-- Reliable one-person invite links and realtime member/profile updates.
-- Run once in the Supabase SQL editor.

create or replace function public.claim_trip_invite(invite_token uuid)
returns uuid language plpgsql security definer set search_path=public
as $$
declare selected_invite public.trip_invites%rowtype;
begin
  select * into selected_invite from public.trip_invites
  where token=invite_token for update;
  if not found then raise exception 'ไม่พบลิงก์เชิญนี้'; end if;
  if selected_invite.revoked_at is not null then raise exception 'ลิงก์เชิญถูกยกเลิกแล้ว'; end if;
  if selected_invite.expires_at <= now() then raise exception 'ลิงก์เชิญหมดอายุแล้ว'; end if;

  -- A retry by the same friend is safe (for example after an interrupted redirect).
  if selected_invite.claimed_at is not null then
    if selected_invite.claimed_by=auth.uid() then return selected_invite.trip_id; end if;
    raise exception 'ลิงก์เชิญนี้ถูกใช้โดยสมาชิกคนอื่นแล้ว';
  end if;

  insert into public.trip_members(trip_id,user_id,trip_role)
  values(selected_invite.trip_id,auth.uid(),'member') on conflict do nothing;
  update public.trip_invites set claimed_by=auth.uid(),claimed_at=now()
  where id=selected_invite.id;
  return selected_invite.trip_id;
end;
$$;

revoke all on function public.claim_trip_invite(uuid) from public;
grant execute on function public.claim_trip_invite(uuid) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','trip_members'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=table_name
    ) then execute format('alter publication supabase_realtime add table public.%I',table_name);
    end if;
  end loop;
end $$;
