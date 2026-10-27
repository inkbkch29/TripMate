begin;
do $$declare tid uuid;uid uuid;item jsonb;count_before integer;begin
 select owner_id into uid from public.trips where name='ทดสอบ' limit 1;
 insert into public.trips(name,owner_id,start_date,end_date,status)values('QA packing sync rollback',uid,current_date+1,current_date+3,'planning')returning id into tid;
 insert into public.trip_members(trip_id,user_id,trip_role)values(tid,uid,'owner');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
 item:=public.manage_trip_packing(tid,gen_random_uuid(),'create','{"title":"PRIVATE SENTINEL","visibility":"personal"}');
 perform public.manage_trip_packing(tid,(item->>'id')::uuid,'delete','{}',1);
 if exists(select 1 from public.trip_activity_log where trip_id=tid and kind='packing')then raise exception 'Private delete broadcast leaked';end if;
 item:=public.manage_trip_packing(tid,gen_random_uuid(),'create','{"title":"SHARED SENTINEL","visibility":"shared"}');
 perform public.manage_trip_packing(tid,(item->>'id')::uuid,'delete','{}',1);
 if (select count(*) from public.trip_activity_log where trip_id=tid and kind='packing')<>1 then raise exception 'Shared delete did not invalidate list';end if;
 if exists(select 1 from public.trip_activity_log where trip_id=tid and kind='packing' and (message like '%SENTINEL%' or entity_id is not null))then raise exception 'Item contents in invalidation event';end if;
 delete from public.trips where id=tid;
end$$;
rollback;
