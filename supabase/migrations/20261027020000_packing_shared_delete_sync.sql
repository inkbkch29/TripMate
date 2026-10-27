begin;
-- DELETE payloads omit trip_id with the default replica identity, so filtered subscriptions miss them.
-- A generic shared-only activity invalidates the list without publishing private item contents.
create or replace function public.record_packing_change() returns trigger language plpgsql security definer set search_path=public as $$
declare old_meta jsonb;new_meta jsonb;begin
 if tg_op='DELETE' and not exists(select 1 from public.trips where id=old.trip_id) then return old;end if;
 if tg_op<>'INSERT' then old_meta=jsonb_build_object('visibility',old.visibility,'owner',old.owner_user_id,'assigned',old.assigned_to,'done',old.is_done,'completed_by',old.completed_by,'completed_at',old.completed_at,'revision',old.revision);end if;
 if tg_op<>'DELETE' then new_meta=jsonb_build_object('visibility',new.visibility,'owner',new.owner_user_id,'assigned',new.assigned_to,'done',new.is_done,'completed_by',new.completed_by,'completed_at',new.completed_at,'revision',new.revision);end if;
 insert into public.trip_packing_history(item_id,trip_id,actor_id,action,previous_state,new_state)values(coalesce(new.id,old.id),coalesce(new.trip_id,old.trip_id),auth.uid(),tg_op,old_meta,new_meta);
 if (tg_op='DELETE' and old.visibility='shared') or (tg_op='UPDATE' and old.visibility='shared' and new.visibility='personal') then
 insert into public.trip_activity_log(trip_id,actor_id,kind,message,entity_type)values(coalesce(new.trip_id,old.trip_id),auth.uid(),'packing','อัปเดตรายการของส่วนกลาง','packing');
 end if;
 return coalesce(new,old);
end$$;

commit;
