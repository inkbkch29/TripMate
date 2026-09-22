create or replace function public.notify_trip_activity()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  -- Adding or deleting a money item is visible on the shared money screen and
  -- does not need to interrupt every trip member. Actionable money alerts such
  -- as due dates, pending slips, and approvals are generated separately.
  if (new.kind = 'insert' and new.entity_type in ('expenses', 'collections'))
    or (new.kind = 'delete' and new.entity_type in ('expense', 'collection')) then
    return new;
  end if;

  insert into public.user_notifications(recipient_id,trip_id,type,title,body,target,dedupe_key)
  select m.user_id,new.trip_id,coalesce(new.entity_type,new.kind),'TripMate',new.message,
    jsonb_build_object('entityType',new.entity_type,'entityId',new.entity_id),
    'activity:'||new.id::text
  from public.trip_members m
  where m.trip_id=new.trip_id and m.user_id is distinct from new.actor_id
    and coalesce((select p.enabled from public.notification_preferences p where p.user_id=m.user_id and p.type=coalesce(new.entity_type,new.kind)),true);
  return new;
end; $$;
