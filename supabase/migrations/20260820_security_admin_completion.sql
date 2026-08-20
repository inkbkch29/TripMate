-- Security and admin completion for TripMate.
-- Run once in Supabase SQL Editor after the earlier migrations.

-- Private trip files use: {trip_id}/{uploader_id}/{kind}-{timestamp}-{uuid}.{ext}
drop policy if exists "trip members read files" on storage.objects;
drop policy if exists "users upload own trip files" on storage.objects;
drop policy if exists "users update own trip files" on storage.objects;
drop policy if exists "users delete own trip files" on storage.objects;

create policy "trip members read files" on storage.objects
for select to authenticated using (
  bucket_id = 'trip-files' and (
    exists (
      select 1 from public.trip_members tm
      where tm.user_id = auth.uid()
        and tm.trip_id::text = (storage.foldername(name))[1]
    )
    -- Keep old files readable only when they are referenced by a trip the viewer belongs to.
    or exists (select 1 from public.expenses e where e.receipt_path=name and public.is_trip_member(e.trip_id))
    or exists (select 1 from public.collection_payments p join public.collections c on c.id=p.collection_id where p.slip_url=name and public.is_trip_member(c.trip_id))
    or exists (select 1 from public.trip_settlements s where s.slip_path=name and public.is_trip_member(s.trip_id))
    or exists (
      select 1 from public.profiles p
      where p.payment_qr_path=name and exists (
        select 1 from public.trip_members mine join public.trip_members theirs on theirs.trip_id=mine.trip_id
        where mine.user_id=auth.uid() and theirs.user_id=p.id
      )
    )
  )
);

create policy "users upload trip files" on storage.objects
for insert to authenticated with check (
  bucket_id='trip-files'
  and (storage.foldername(name))[2]=auth.uid()::text
  and exists (
    select 1 from public.trip_members tm
    where tm.user_id=auth.uid() and tm.trip_id::text=(storage.foldername(name))[1]
  )
);

create policy "users update own trip files" on storage.objects
for update to authenticated using (
  bucket_id='trip-files' and owner_id=auth.uid()::text
) with check (
  bucket_id='trip-files' and owner_id=auth.uid()::text
);

create policy "users delete own trip files" on storage.objects
for delete to authenticated using (
  bucket_id='trip-files' and (
    owner_id=auth.uid()::text
    or exists (
      select 1 from public.trips t
      where t.owner_id=auth.uid() and t.id::text=(storage.foldername(name))[1]
    )
  )
);

-- Public trip cover images; only the trip owner can manage their folder.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('trip-covers','trip-covers',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "owners upload trip covers" on storage.objects;
drop policy if exists "owners update trip covers" on storage.objects;
drop policy if exists "owners delete trip covers" on storage.objects;
create policy "owners upload trip covers" on storage.objects for insert to authenticated
with check (bucket_id='trip-covers' and exists(select 1 from public.trips t where t.id::text=(storage.foldername(name))[1] and t.owner_id=auth.uid()));
create policy "owners update trip covers" on storage.objects for update to authenticated
using (bucket_id='trip-covers' and exists(select 1 from public.trips t where t.id::text=(storage.foldername(name))[1] and t.owner_id=auth.uid()))
with check (bucket_id='trip-covers' and exists(select 1 from public.trips t where t.id::text=(storage.foldername(name))[1] and t.owner_id=auth.uid()));
create policy "owners delete trip covers" on storage.objects for delete to authenticated
using (bucket_id='trip-covers' and exists(select 1 from public.trips t where t.id::text=(storage.foldername(name))[1] and t.owner_id=auth.uid()));

create or replace function public.revoke_trip_invite(target_invite uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  update public.trip_invites i set revoked_at=now()
  where i.id=target_invite and i.claimed_at is null and i.revoked_at is null
    and exists(select 1 from public.trips t where t.id=i.trip_id and t.owner_id=auth.uid());
  if not found then raise exception 'ไม่พบลิงก์ที่ยกเลิกได้ หรือคุณไม่มีสิทธิ์'; end if;
end;
$$;

create or replace function public.remove_trip_member(target_trip uuid,target_user uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not exists(select 1 from public.trips t where t.id=target_trip and t.owner_id=auth.uid()) then
    raise exception 'เฉพาะเจ้าของทริปเท่านั้นที่นำสมาชิกออกได้';
  end if;
  if target_user=auth.uid() or exists(select 1 from public.trips t where t.id=target_trip and t.owner_id=target_user) then
    raise exception 'ไม่สามารถนำเจ้าของทริปออกได้';
  end if;
  delete from public.live_locations where trip_id=target_trip and user_id=target_user;
  delete from public.trip_members where trip_id=target_trip and user_id=target_user;
  if not found then raise exception 'ไม่พบสมาชิกในทริป'; end if;
end;
$$;

-- Replace participants atomically so editing never leaves stale shares/payments.
create or replace function public.replace_expense_participants(target_expense uuid,target_users uuid[],target_shares numeric[])
returns void language plpgsql security definer set search_path=public
as $$
declare i int;
begin
  if coalesce(array_length(target_users,1),0)=0 or array_length(target_users,1)<>array_length(target_shares,1) then raise exception 'ข้อมูลการหารไม่ถูกต้อง'; end if;
  if not exists(select 1 from public.expenses e join public.trips t on t.id=e.trip_id left join public.trip_members tm on tm.trip_id=t.id and tm.user_id=auth.uid() where e.id=target_expense and (e.created_by=auth.uid() or t.owner_id=auth.uid() or tm.trip_role='treasurer')) then raise exception 'คุณไม่มีสิทธิ์แก้รายจ่ายนี้'; end if;
  delete from public.expense_participants where expense_id=target_expense;
  for i in 1..array_length(target_users,1) loop
    insert into public.expense_participants(expense_id,user_id,share_amount) values(target_expense,target_users[i],target_shares[i]);
  end loop;
end;
$$;

create or replace function public.replace_collection_payments(target_collection uuid,target_users uuid[],target_amount numeric,target_paid uuid[])
returns void language plpgsql security definer set search_path=public
as $$
declare member_id uuid;
begin
  if coalesce(array_length(target_users,1),0)=0 or target_amount<0 then raise exception 'ข้อมูลผู้ชำระไม่ถูกต้อง'; end if;
  if not exists(select 1 from public.collections c join public.trips t on t.id=c.trip_id left join public.trip_members tm on tm.trip_id=t.id and tm.user_id=auth.uid() where c.id=target_collection and (t.owner_id=auth.uid() or c.created_by=auth.uid() or tm.trip_role='treasurer')) then raise exception 'คุณไม่มีสิทธิ์แก้รายการนี้'; end if;
  delete from public.collection_payments where collection_id=target_collection and not (user_id=any(target_users));
  foreach member_id in array target_users loop
    insert into public.collection_payments(collection_id,user_id,amount,status)
    values(target_collection,member_id,target_amount,case when member_id=any(coalesce(target_paid,array[]::uuid[])) then 'paid' else 'unpaid' end)
    on conflict(collection_id,user_id) do update set amount=excluded.amount,
      status=case when collection_payments.status in ('pending','paid') then collection_payments.status when member_id=any(coalesce(target_paid,array[]::uuid[])) then 'paid' else 'unpaid' end;
  end loop;
end;
$$;

revoke all on function public.revoke_trip_invite(uuid) from public;
revoke all on function public.remove_trip_member(uuid,uuid) from public;
revoke all on function public.replace_expense_participants(uuid,uuid[],numeric[]) from public;
revoke all on function public.replace_collection_payments(uuid,uuid[],numeric,uuid[]) from public;
grant execute on function public.revoke_trip_invite(uuid) to authenticated;
grant execute on function public.remove_trip_member(uuid,uuid) to authenticated;
grant execute on function public.replace_expense_participants(uuid,uuid[],numeric[]) to authenticated;
grant execute on function public.replace_collection_payments(uuid,uuid[],numeric,uuid[]) to authenticated;

-- Treasurer has the same finance-management rights shown by the UI.
drop policy if exists "owners review expenses" on public.expenses;
drop policy if exists "owners or treasurers update expenses" on public.expenses;
create policy "owners or treasurers update expenses" on public.expenses for update to authenticated
using (exists(select 1 from public.trips t left join public.trip_members tm on tm.trip_id=t.id and tm.user_id=auth.uid() where t.id=trip_id and (t.owner_id=auth.uid() or tm.trip_role='treasurer')))
with check (exists(select 1 from public.trips t left join public.trip_members tm on tm.trip_id=t.id and tm.user_id=auth.uid() where t.id=trip_id and (t.owner_id=auth.uid() or tm.trip_role='treasurer')));
drop policy if exists "owners or creators delete expenses" on public.expenses;
drop policy if exists "finance managers or creators delete expenses" on public.expenses;
create policy "finance managers or creators delete expenses" on public.expenses for delete to authenticated
using (created_by=auth.uid() or exists(select 1 from public.trips t left join public.trip_members tm on tm.trip_id=t.id and tm.user_id=auth.uid() where t.id=trip_id and (t.owner_id=auth.uid() or tm.trip_role='treasurer')));

-- Participants must be removable by the expense creator or trip owner.
drop policy if exists "expense owners delete shares" on public.expense_participants;
create policy "expense owners delete shares" on public.expense_participants for delete to authenticated
using (exists(select 1 from public.expenses e join public.trips t on t.id=e.trip_id where e.id=expense_id and (e.created_by=auth.uid() or t.owner_id=auth.uid())));
