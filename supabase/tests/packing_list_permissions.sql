begin;
-- Fixtures reuse existing profile IDs only; all new trips/items are rolled back.
do $$declare a uuid;b uuid;c uuid;tid uuid;begin
 select owner_id into a from public.trips where name='ทดสอบ' limit 1;
 select id into b from public.profiles where id<>a limit 1;
 select id into c from public.profiles where id not in(a,b) limit 1;
 if a is null or b is null or c is null then raise exception 'ต้องมีบัญชีทดสอบอย่างน้อยสามบัญชี';end if;
 insert into public.trips(name,owner_id,status,start_date,end_date)values('QA packing rollback',a,'planning',current_date+1,current_date+3)returning id into tid;
 insert into public.trip_members(trip_id,user_id,trip_role)values(tid,a,'owner'),(tid,b,'member'),(tid,c,'planner');
 perform set_config('packing.trip',tid::text,true);perform set_config('packing.a',a::text,true);perform set_config('packing.b',b::text,true);perform set_config('packing.c',c::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 perform public.manage_trip_packing(tid,'00000000-0000-4000-8000-000000000101','create','{"title":"Private fixture","visibility":"personal","note":"private note"}');
 perform public.manage_trip_packing(tid,'00000000-0000-4000-8000-000000000102','create','{"title":"Shared fixture","visibility":"shared"}');
end$$;
set local role authenticated;
do $$declare tid uuid:=current_setting('packing.trip')::uuid;a uuid:=current_setting('packing.a')::uuid;b uuid:=current_setting('packing.b')::uuid;c uuid:=current_setting('packing.c')::uuid;r jsonb;rev integer;begin
 -- Owner and planner cannot SELECT another user's private item or mutate via RPC.
 foreach a in array array[a,c]loop
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 if exists(select 1 from public.trip_checklist_items where id='00000000-0000-4000-8000-000000000101')then raise exception 'Private SELECT leaked';end if;
 begin perform public.manage_trip_packing(tid,'00000000-0000-4000-8000-000000000101','delete','{}',1);raise exception 'Private delete allowed';exception when insufficient_privilege then null;end;
 end loop;
 a:=current_setting('packing.a')::uuid;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 if (select count(*) from public.trip_checklist_items where trip_id=tid)<>2 then raise exception 'Owner cannot see own private row';end if;
 -- Creator has no right to tick an unassigned shared item.
 begin perform public.manage_trip_packing(tid,'00000000-0000-4000-8000-000000000102','toggle','{"done":true}',1);raise exception 'Unassigned toggle allowed';exception when insufficient_privilege then null;end;
 r:=public.manage_trip_packing(tid,'00000000-0000-4000-8000-000000000102','claim','{}',1);
 if (r->>'is_done')::boolean then raise exception 'Claim counted as prepared';end if;
 -- Stale revision / competing claim fails after row lock; must not overwrite first assignee.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 begin perform public.manage_trip_packing(tid,'00000000-0000-4000-8000-000000000102','claim','{}',1);raise exception 'Stale claim allowed';exception when raise_exception then if sqlerrm='Stale claim allowed'then raise;end if;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 r:=public.manage_trip_packing(tid,'00000000-0000-4000-8000-000000000102','toggle','{"done":true}',2);
 if not (r->>'is_done')::boolean or r->>'completed_by'<>b::text then raise exception 'Completion not recorded';end if;
 r:=public.manage_trip_packing(tid,'00000000-0000-4000-8000-000000000102','release','{}',3);
 if (r->>'is_done')::boolean or r->>'assigned_to' is not null then raise exception 'Release failed';end if;
 r:=public.manage_trip_packing(tid,'00000000-0000-4000-8000-000000000101','update','{"title":"Edited private","visibility":"shared","note":"edited"}',1);
 if r->>'owner_user_id' is not null then raise exception 'Conversion retained private owner';end if;
 -- Permitted deletion and forbidden edits are enforced by the RPC, not only UI buttons.
 perform public.manage_trip_packing(tid,'00000000-0000-4000-8000-000000000104','create','{"title":"Own disposable","visibility":"personal"}');
 perform public.manage_trip_packing(tid,'00000000-0000-4000-8000-000000000104','delete','{}',1);
 if exists(select 1 from public.trip_checklist_items where id='00000000-0000-4000-8000-000000000104')then raise exception 'Own delete failed';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 perform public.manage_trip_packing(tid,'00000000-0000-4000-8000-000000000103','create','{"title":"Another creator","visibility":"shared"}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 begin perform public.manage_trip_packing(tid,'00000000-0000-4000-8000-000000000103','update','{"title":"Forbidden edit","visibility":"shared"}',1);raise exception 'Other creator edit allowed';exception when insufficient_privilege then null;end;
 begin perform public.manage_trip_packing(tid,'00000000-0000-4000-8000-000000000103','delete','{}',1);raise exception 'Other creator delete allowed';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 perform public.manage_trip_packing(tid,'00000000-0000-4000-8000-000000000103','delete','{}',1);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 -- Idempotent create: same ID does not insert another row.
 perform public.manage_trip_packing(tid,'00000000-0000-4000-8000-000000000102','create','{"title":"Shared fixture","visibility":"shared"}');
 if(select count(*) from public.trip_checklist_items where trip_id=tid)<>2 then raise exception 'Duplicate create';end if;
 -- Direct writes cannot bypass RPC permissions.
 begin update public.trip_checklist_items set is_done=true where trip_id=tid;raise exception 'Direct update allowed';exception when insufficient_privilege then null;end;
 -- Normal member cannot read another trip.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 r:=public.manage_trip_packing(tid,'00000000-0000-4000-8000-000000000102','claim','{}',4);
end$$;
reset role;
-- Removal clears assignments, keeps shared items and logs the former state.
delete from public.trip_members where trip_id=current_setting('packing.trip')::uuid and user_id=current_setting('packing.b')::uuid;
do $$begin
 if not exists(select 1 from public.trip_checklist_items where id='00000000-0000-4000-8000-000000000102' and assigned_to is null and not is_done)then raise exception 'Departure lost shared item or assignment';end if;
 if not exists(select 1 from public.trip_packing_history where item_id='00000000-0000-4000-8000-000000000102' and previous_state->>'assigned'=current_setting('packing.b') and new_state->>'assigned' is null)then raise exception 'Missing departure audit';end if;
end$$;
set local role authenticated;
do $$begin
 if exists(select 1 from public.trip_checklist_items where trip_id=current_setting('packing.trip')::uuid)then raise exception 'Departed user retains read access';end if;
 begin perform public.manage_trip_packing(current_setting('packing.trip')::uuid,'00000000-0000-4000-8000-000000000102','claim','{}',6);raise exception 'Departed user retains write access';exception when insufficient_privilege then null;end;
end$$;
reset role;
-- Parent trip deletion must still cascade cleanly through assignment and audit triggers.
delete from public.trips where id=current_setting('packing.trip')::uuid;
rollback;
