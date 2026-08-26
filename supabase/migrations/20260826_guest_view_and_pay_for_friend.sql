-- Read-only guest snapshots and collection payments made on behalf of a friend.

alter table public.collection_payments
  add column if not exists submitted_by uuid references public.profiles(id);

create or replace function public.submit_collection_payment(target_collection uuid,target_slip text,target_user uuid default null)
returns void language plpgsql security definer set search_path=public
as $$
declare paid_for uuid:=coalesce(target_user,auth.uid());
begin
  if auth.uid() is null then raise exception 'กรุณาเข้าสู่ระบบก่อนแจ้งชำระ'; end if;
  if not exists(
    select 1 from public.collection_payments p
    join public.collections c on c.id=p.collection_id
    where p.collection_id=target_collection and p.user_id=paid_for
      and public.is_trip_member(c.trip_id)
      and exists(select 1 from public.trip_members tm where tm.trip_id=c.trip_id and tm.user_id=auth.uid())
  ) then raise exception 'ไม่พบรายการชำระ หรือคุณไม่ได้อยู่ในทริปนี้'; end if;
  update public.collection_payments
  set status='pending',slip_url=target_slip,submitted_by=auth.uid(),confirmed_at=null
  where collection_id=target_collection and user_id=paid_for;
end;
$$;

create or replace function public.guest_trip_snapshot(invite_token uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare selected_invite public.trip_invites%rowtype; result jsonb;
begin
  select * into selected_invite from public.trip_invites where token=invite_token;
  if not found or selected_invite.revoked_at is not null or selected_invite.expires_at<=now() then
    raise exception 'ลิงก์สำหรับผู้เยี่ยมชมไม่ถูกต้องหรือหมดอายุแล้ว';
  end if;
  select jsonb_build_object(
    'trip',jsonb_build_object('id',t.id,'name',t.name,'start_date',t.start_date,'end_date',t.end_date,'description',t.description,'cover_url',t.cover_url),
    'members',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'avatar',p.avatar_url,'role',case when tm.trip_role='owner' then 'เจ้าของทริป' else 'สมาชิก' end) order by case when tm.trip_role='owner' then 0 else 1 end,p.display_name) from public.trip_members tm join public.profiles p on p.id=tm.user_id where tm.trip_id=t.id),'[]'::jsonb),
    'stops',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'day',s.day_number,'time',left(s.start_time::text,5),'title',s.title,'place',s.place_name,'note',s.note,'latitude',s.latitude,'longitude',s.longitude,'googleMapsUrl',s.google_maps_url,'sortOrder',s.sort_order,'done',s.is_done) order by s.day_number,s.sort_order,s.start_time) from public.trip_stops s where s.trip_id=t.id),'[]'::jsonb),
    'expense_summary',jsonb_build_object('total',coalesce((select sum(e.amount) from public.expenses e where e.trip_id=t.id and coalesce(e.approval_status,'approved')='approved'),0),'count',coalesce((select count(*) from public.expenses e where e.trip_id=t.id and coalesce(e.approval_status,'approved')='approved'),0)),
    'collections',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'amount',c.amount,'due',c.due_date) order by c.due_date) from public.collections c where c.trip_id=t.id),'[]'::jsonb)
  ) into result from public.trips t where t.id=selected_invite.trip_id;
  return result;
end;
$$;

revoke all on function public.submit_collection_payment(uuid,text,uuid) from public;
revoke all on function public.guest_trip_snapshot(uuid) from public;
grant execute on function public.submit_collection_payment(uuid,text,uuid) to authenticated;
grant execute on function public.guest_trip_snapshot(uuid) to anon,authenticated;
