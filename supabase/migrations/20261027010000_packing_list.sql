begin;
-- Existing visibility is authoritative. Stop rather than guess ambiguous legacy ownership.
do $$begin
 if exists(select 1 from public.trip_checklist_items where visibility not in ('personal','shared') or visibility is null or (visibility='personal' and assigned_to is not null and assigned_to<>created_by)) then raise exception 'ตรวจสอบประเภทหรือเจ้าของรายการเดิมก่อนย้ายข้อมูล';end if;
end$$;
alter table public.trip_checklist_items add column owner_user_id uuid references public.profiles(id),add column note text not null default '',add column updated_at timestamptz not null default now(),add column revision integer not null default 1;
update public.trip_checklist_items set owner_user_id=created_by,assigned_to=null where visibility='personal';
alter table public.trip_checklist_items add constraint checklist_owner_scope check((visibility='personal' and owner_user_id is not null and assigned_to is null)or(visibility='shared' and owner_user_id is null)),add constraint checklist_note_length check(length(note)<=1000);
create table public.trip_packing_history(id bigint generated always as identity primary key,item_id uuid not null,trip_id uuid not null references public.trips(id) on delete cascade,actor_id uuid,action text not null,previous_state jsonb,new_state jsonb,created_at timestamptz not null default now());
alter table public.trip_packing_history enable row level security;
-- Metadata only, no titles/notes or private item payloads in history/realtime logs.
revoke all on public.trip_packing_history from public,anon,authenticated;
create function public.record_packing_change() returns trigger language plpgsql security definer set search_path=public as $$
declare old_meta jsonb;new_meta jsonb;begin
 if tg_op='DELETE' and not exists(select 1 from public.trips where id=old.trip_id) then return old;end if;
 if tg_op<>'INSERT' then old_meta=jsonb_build_object('visibility',old.visibility,'owner',old.owner_user_id,'assigned',old.assigned_to,'done',old.is_done,'completed_by',old.completed_by,'completed_at',old.completed_at,'revision',old.revision);end if;
 if tg_op<>'DELETE' then new_meta=jsonb_build_object('visibility',new.visibility,'owner',new.owner_user_id,'assigned',new.assigned_to,'done',new.is_done,'completed_by',new.completed_by,'completed_at',new.completed_at,'revision',new.revision);end if;
 insert into public.trip_packing_history(item_id,trip_id,actor_id,action,previous_state,new_state)values(coalesce(new.id,old.id),coalesce(new.trip_id,old.trip_id),auth.uid(),tg_op,old_meta,new_meta);
 if tg_op='UPDATE' and old.visibility='shared' and new.visibility='personal' then
 insert into public.trip_activity_log(trip_id,actor_id,kind,message,entity_type)values(new.trip_id,auth.uid(),'packing','อัปเดตรายการของส่วนกลาง','packing');
 end if;
 return coalesce(new,old);
end$$;
create trigger packing_history after insert or update or delete on public.trip_checklist_items for each row execute function public.record_packing_change();
-- Replace all legacy policies, including permissive OR policies from older releases.
do $$declare p record;begin for p in select policyname from pg_policies where schemaname='public' and tablename='trip_checklist_items' loop execute format('drop policy %I on public.trip_checklist_items',p.policyname);end loop;end$$;
create policy "members read scoped packing" on public.trip_checklist_items for select to authenticated using(public.is_trip_member(trip_id) and(visibility='shared' or owner_user_id=auth.uid()));
revoke insert,update,delete on public.trip_checklist_items from authenticated,anon;
grant select on public.trip_checklist_items to authenticated;
create function public.manage_trip_packing(target_trip uuid,target_item uuid,operation text,payload jsonb default '{}'::jsonb,expected_revision integer default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();item public.trip_checklist_items;manager boolean;kind text;assignee uuid;item_title text;item_note text;done boolean;begin
 if uid is null or not public.is_trip_member(target_trip) then raise insufficient_privilege using message='ไม่มีสิทธิ์เข้าถึงรายการในทริปนี้';end if;
 
 -- Serialize assignment against membership removal (same lock ordering as departure trigger).
 perform 1 from public.trip_members where trip_id=target_trip order by user_id for share;
 if not public.is_trip_member(target_trip) then raise insufficient_privilege using message='ไม่ได้อยู่ในทริปแล้ว';end if;
 manager:=public.trip_plan_manager(target_trip);
 select * into item from public.trip_checklist_items where id=target_item and trip_id=target_trip for update;
 if operation='create' then
  if found then if item.created_by=uid then return to_jsonb(item);else raise exception 'รหัสรายการซ้ำ';end if;end if;
  kind:=payload->>'visibility';item_title:=trim(payload->>'title');item_note:=coalesce(payload->>'note','');
  if kind not in ('personal','shared') or kind is null or item_title is null or length(item_title) not between 1 and 160 or length(item_note)>1000 then raise exception 'ตรวจสอบชื่อ ประเภท และหมายเหตุ';end if;
  assignee:=nullif(payload->>'assignedTo','')::uuid;
  if kind='personal' then assignee:=null;end if;
  if assignee is not null and not exists(select 1 from public.trip_members where trip_id=target_trip and user_id=assignee)then raise exception 'ผู้รับผิดชอบไม่ได้อยู่ในทริปแล้ว';end if;
  insert into public.trip_checklist_items(id,trip_id,title,visibility,created_by,owner_user_id,assigned_to,note)values(target_item,target_trip,item_title,kind,uid,case when kind='personal' then uid end,assignee,item_note)returning * into item;
  return to_jsonb(item);
 end if;
 if not found or(item.visibility='personal' and item.owner_user_id<>uid)then raise insufficient_privilege using message='ไม่พบรายการหรือไม่มีสิทธิ์';end if;
 if expected_revision is null or expected_revision<>item.revision then raise exception 'รายการนี้เพิ่งเปลี่ยนแปลง กรุณาโหลดใหม่';end if;
 if operation='delete' then
  if not(case when item.visibility='personal' then item.owner_user_id=uid else item.created_by=uid or manager end)then raise insufficient_privilege using message='ไม่มีสิทธิ์ลบรายการ';end if;
  delete from public.trip_checklist_items where id=item.id;return jsonb_build_object('id',item.id,'deleted',true);
 elsif operation='update' then
  if not(case when item.visibility='personal' then item.owner_user_id=uid else item.created_by=uid or manager end)then raise insufficient_privilege using message='ไม่มีสิทธิ์แก้ไขรายการ';end if;
  kind:=payload->>'visibility';item_title:=trim(payload->>'title');item_note:=coalesce(payload->>'note','');
  if kind not in ('personal','shared') or kind is null or item_title is null or length(item_title) not between 1 and 160 or length(item_note)>1000 then raise exception 'ตรวจสอบชื่อ ประเภท และหมายเหตุ';end if;
  if kind<>item.visibility and item.created_by<>uid then raise insufficient_privilege using message='เฉพาะผู้สร้างเท่านั้นที่เปลี่ยนประเภทได้';end if;
  assignee:=case when kind='shared' then nullif(payload->>'assignedTo','')::uuid end;
  if assignee is not null and not exists(select 1 from public.trip_members where trip_id=target_trip and user_id=assignee)then raise exception 'ผู้รับผิดชอบไม่ได้อยู่ในทริปแล้ว';end if;
  update public.trip_checklist_items set title=item_title,note=item_note,visibility=kind,owner_user_id=case when kind='personal' then uid end,assigned_to=assignee,
   is_done=case when kind<>item.visibility or assignee is distinct from item.assigned_to then false else is_done end,
   completed_by=case when kind<>item.visibility or assignee is distinct from item.assigned_to then null else completed_by end,
   completed_at=case when kind<>item.visibility or assignee is distinct from item.assigned_to then null else completed_at end,
   updated_at=now(),revision=revision+1 where id=item.id returning * into item;
 elsif operation='claim' then
  if item.visibility<>'shared' or item.assigned_to is not null then raise exception 'รายการนี้มีผู้รับผิดชอบแล้ว';end if;
  update public.trip_checklist_items set assigned_to=uid,is_done=false,completed_by=null,completed_at=null,updated_at=now(),revision=revision+1 where id=item.id returning * into item;
 elsif operation='release' then
  if item.visibility<>'shared' or not(coalesce(item.assigned_to=uid,false) or manager) then raise insufficient_privilege using message='ไม่มีสิทธิ์ยกเลิกผู้รับผิดชอบ';end if;
  update public.trip_checklist_items set assigned_to=null,is_done=false,completed_by=null,completed_at=null,updated_at=now(),revision=revision+1 where id=item.id returning * into item;
 elsif operation='toggle' then
  if item.visibility='shared' and not(coalesce(item.assigned_to=uid,false) or manager)then raise insufficient_privilege using message='เฉพาะผู้รับผิดชอบหรือผู้จัดทริปเท่านั้นที่ติ๊กได้';end if;
  done:=(payload->>'done')::boolean;if done is null then raise exception 'ระบุสถานะ';end if;
  update public.trip_checklist_items set is_done=done,completed_by=case when done then uid end,completed_at=case when done then now() end,updated_at=now(),revision=revision+1 where id=item.id returning * into item;
 else raise exception 'คำสั่งไม่ถูกต้อง';end if;
 return to_jsonb(item);
end$$;
revoke all on function public.manage_trip_packing(uuid,uuid,text,jsonb,integer) from public,anon;
grant execute on function public.manage_trip_packing(uuid,uuid,text,jsonb,integer) to authenticated;
-- Retain the old toggle RPC entry point, with the same backend permission checks.
create or replace function public.toggle_trip_checklist(target_item uuid,target_done boolean)returns void language plpgsql security definer set search_path=public as $$declare item public.trip_checklist_items;begin
 select * into item from public.trip_checklist_items where id=target_item;perform public.manage_trip_packing(item.trip_id,item.id,'toggle',jsonb_build_object('done',target_done),item.revision);end$$;
create function public.release_departed_packing_member()returns trigger language plpgsql security definer set search_path=public as $$begin
 if not exists(select 1 from public.trips where id=old.trip_id)then return old;end if;
 update public.trip_checklist_items set assigned_to=null,is_done=false,completed_by=null,completed_at=null,updated_at=now(),revision=revision+1 where trip_id=old.trip_id and assigned_to=old.user_id and visibility='shared';return old;
end$$;
create trigger release_departed_packing after delete on public.trip_members for each row execute function public.release_departed_packing_member();
-- Clear only stale assignments, never delete old shared items.
update public.trip_checklist_items i set assigned_to=null,updated_at=now(),revision=revision+1 where visibility='shared' and assigned_to is not null and not exists(select 1 from public.trip_members m where m.trip_id=i.trip_id and m.user_id=i.assigned_to);
commit;
