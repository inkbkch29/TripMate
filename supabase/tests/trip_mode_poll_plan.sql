-- Requires the designated two-member ทดสอบ trip. All changes roll back.
begin;
do $$
declare tid uuid;own uuid;mem uuid;tok uuid;s jsonb;opts uuid[];result jsonb;first_id uuid;request uuid:=gen_random_uuid();before_votes int;uid uuid;ct timestamptz;ll jsonb;
begin
 select id,owner_id into tid,own from public.trips where name='ทดสอบ' limit 1;
 select user_id into mem from public.trip_members where trip_id=tid and user_id<>own limit 1;
 if mem is null then raise exception 'Requires the designated two-member test trip';end if;
 update public.trips set start_date=(now() at time zone 'Asia/Bangkok')::date,end_date=(now() at time zone 'Asia/Bangkok')::date+2,status='active',members_can_add_stops=false where id=tid;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',own,'role','authenticated')::text,true);
 tok:=public.trip_poll_save(tid,null,'QA poll to plan','{"auto_close":true}','[{"name":"ที่พักจริง","price":1400,"details":"ริมแม่น้ำ","images":["https://example.com/photo.jpg"],"links":["https://vt.tiktok.com/review","https://www.google.com/maps/search/?api=1&query=14.2%2C100.5"]},{"name":"อีกที่"}]','open');
 s:=public.trip_poll_snapshot(tok);select array_agg((x->>'id')::uuid order by x->>'name' desc) into opts from jsonb_array_elements(s->'options')x;
 -- Capture the known option by name, independent of sorting.
 opts[1]:=(select (x->>'id')::uuid from jsonb_array_elements(s->'options')x where x->>'name'='ที่พักจริง');
 opts[2]:=(select (x->>'id')::uuid from jsonb_array_elements(s->'options')x where x->>'name'='อีกที่');
 perform public.trip_poll_vote(tok,array[opts[1]]);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',mem,'role','authenticated')::text,true);
 perform public.trip_poll_vote(tok,array[opts[2]]);s:=public.trip_poll_snapshot(tok);
 if jsonb_array_length(s->'leader_ids')<>2 or (s->>'can_add_to_plan')::boolean then raise exception 'Tie or permissions incorrect';end if;
 begin perform public.poll_option_to_plan(tok,opts[1],'{"day":1,"time":"10:30","title":"ที่พัก"}',false,request);raise exception 'UNAUTHORIZED SAVE';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',own,'role','authenticated')::text,true);
 select count(*) into before_votes from public.stay_poll_votes where poll_id=(s->>'id')::uuid;
 result:=public.poll_option_to_plan(tok,opts[1],'{"day":1,"time":"10:30","title":"เข้าที่พัก","place":"ที่พักจริง","note":"แก้หมายเหตุได้","price":1400,"images":["https://example.com/photo.jpg"],"links":["https://vt.tiktok.com/review","https://www.google.com/maps/search/?api=1&query=14.2%2C100.5"],"googleMapsUrl":"https://www.google.com/maps/search/?api=1&query=14.2%2C100.5","latitude":99,"longitude":99}',false,request);
 first_id:=(result->'stop'->>'id')::uuid;
 if (result->>'already_exists')::boolean or (result->'stop'->>'latitude')::numeric<>14.2 or result->'stop'->'poll_option_snapshot'->>'name'<>'ที่พักจริง' then raise exception 'Snapshot or reliable Maps coordinate missing';end if;
 result:=public.poll_option_to_plan(tok,opts[1],'{"day":1,"time":"10:30","title":"เข้าที่พัก"}',false,request);
 if (result->'stop'->>'id')::uuid<>first_id then raise exception 'Idempotent retry duplicated';end if;
 result:=public.poll_option_to_plan(tok,opts[1],'{"day":1,"time":"11:30","title":"เข้าที่พัก"}',true,gen_random_uuid());
 if not(result->>'already_exists')::boolean then raise exception 'Same day duplicate allowed';end if;
 result:=public.poll_option_to_plan(tok,opts[1],'{"day":2,"time":"11:30","title":"เข้าที่พัก"}',false,gen_random_uuid());
 if not(result->>'already_exists')::boolean then raise exception 'Unconfirmed second day allowed';end if;
 result:=public.poll_option_to_plan(tok,opts[1],'{"day":2,"time":"11:30","title":"เข้าที่พัก"}',true,gen_random_uuid());
 if (result->>'already_exists')::boolean then raise exception 'Confirmed second day rejected';end if;
 if (select count(*) from public.stay_poll_votes where poll_id=(s->>'id')::uuid)<>before_votes then raise exception 'Vote totals changed';end if;
 if (select jsonb_array_length(x->'planned_stops') from jsonb_array_elements(public.trip_poll_snapshot(tok)->'options')x where x->>'id'=opts[1]::text)<>2 then raise exception 'Plan references missing';end if;
 -- Backup choice is allowed; TikTok IDs do not become coordinates.
 result:=public.poll_option_to_plan(tok,opts[2],'{"day":1,"time":"12:30","title":"ตัวเลือกสำรอง","links":["https://vt.tiktok.com/1234"],"latitude":14.2,"longitude":100.5}',false,gen_random_uuid());
 if result->'stop'->'latitude'<>'null' then raise exception 'TikTok became coordinates';end if;
 perform public.trip_poll_action(tok,'delete');
 if not exists(select 1 from public.trip_stops where id=first_id and source_poll_option_id=opts[1]) then raise exception 'Poll deletion removed itinerary';end if;
 -- Location visibility depends on explicit, unexpired consent, not historical coordinates.
 insert into public.location_consents(trip_id,user_id,consented_at,auto_stop_at,revoked_at) values(tid,mem,now()-interval '1 hour',now()+interval '1 hour',null) on conflict(trip_id,user_id) do update set consented_at=excluded.consented_at,auto_stop_at=excluded.auto_stop_at,revoked_at=null;
 insert into public.live_locations(trip_id,user_id,latitude,longitude,updated_at,sharing_enabled) values(tid,mem,14,100,now(),true) on conflict(trip_id,user_id) do update set latitude=14,longitude=100,updated_at=now(),sharing_enabled=true;
 ll:=public.trip_live_locations(tid);if not exists(select 1 from jsonb_array_elements(ll)x where x->>'user_id'=mem::text and (x->>'latitude')::numeric=14) then raise exception 'Consented location missing';end if;
 update public.live_locations set updated_at=now()-interval '40 minutes' where trip_id=tid and user_id=mem;
 ll:=public.trip_live_locations(tid);if exists(select 1 from jsonb_array_elements(ll)x where x->>'user_id'=mem::text and x->'latitude'<>'null') then raise exception 'Historical position exposed';end if;
 update public.location_consents set auto_stop_at=now()-interval '1 second' where trip_id=tid and user_id=mem;
 ll:=public.trip_live_locations(tid);if exists(select 1 from jsonb_array_elements(ll)x where x->>'user_id'=mem::text) then raise exception 'Expired sharing exposed';end if;
 if (select sharing_enabled from public.live_locations where trip_id=tid and user_id=mem) then raise exception 'Expired sharing not stopped';end if;
 update public.location_consents set auto_stop_at=now()+interval '1 hour' where trip_id=tid and user_id=mem;
 update public.live_locations set updated_at=now(),sharing_enabled=true where trip_id=tid and user_id=mem;
 perform set_config('tripmate.qa_trip',tid::text,true);perform set_config('tripmate.qa_member',mem::text,true);
end $$;
set local role authenticated;
do $$begin
 if not exists(select 1 from public.live_locations where trip_id=current_setting('tripmate.qa_trip')::uuid and user_id=current_setting('tripmate.qa_member')::uuid) then raise exception 'RLS failed to show consented member location';end if;
end $$;
reset role;
do $$declare tid uuid:=current_setting('tripmate.qa_trip')::uuid;mem uuid:=current_setting('tripmate.qa_member')::uuid;begin
 update public.location_consents set revoked_at=now() where trip_id=tid and user_id=mem;
end $$;
set local role authenticated;
do $$begin
 if exists(select 1 from public.live_locations where trip_id=current_setting('tripmate.qa_trip')::uuid and user_id=current_setting('tripmate.qa_member')::uuid) then raise exception 'RLS exposed revoked location';end if;
end $$;
reset role;
do $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('tripmate.qa_member'),'role','authenticated')::text,true);end $$;
set local role authenticated;
do $$begin
 begin update public.live_locations set sharing_enabled=true where trip_id=current_setting('tripmate.qa_trip')::uuid and user_id=auth.uid();raise exception 'UNCONSENTED WRITE';exception when insufficient_privilege then null;end;
 update public.live_locations set sharing_enabled=false where trip_id=current_setting('tripmate.qa_trip')::uuid and user_id=auth.uid();
end $$;
reset role;
select 'passed' as trip_mode_poll_plan_regression;
rollback;
