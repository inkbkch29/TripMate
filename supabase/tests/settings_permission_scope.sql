begin;
do $test$
declare a uuid;b uuid;own uuid;other_uid uuid;eid uuid:=gen_random_uuid();n integer;
begin
 select owner_id into own from public.trips where name='ทดสอบ' limit 1;
 select id into other_uid from public.profiles where id<>own limit 1;
 insert into public.trips(owner_id,name,start_date,end_date,status,members_can_add_stops)values(own,'QA สิทธิ์ทริป A',current_date+1,current_date+2,'planning',false)returning id into a;
 insert into public.trip_members(trip_id,user_id,trip_role)values(a,own,'owner');
 insert into public.trips(owner_id,name,start_date,end_date,status,members_can_add_stops)values(other_uid,'QA สิทธิ์ทริป B',current_date+1,current_date+2,'planning',false)returning id into b;
 insert into public.trip_members(trip_id,user_id,trip_role)values(b,other_uid,'owner');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_uid,'role','authenticated')::text,true);
 insert into public.expenses(id,trip_id,title,amount,paid_by,category,created_by,approval_status)values(eid,b,'ห้ามแตะจากทริป A',100,other_uid,'other',other_uid,'pending');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',own,'role','authenticated')::text,true);
 perform set_config('tripmate.scope.trip_a',a::text,true);perform set_config('tripmate.scope.trip_b',b::text,true);perform set_config('tripmate.scope.expense',eid::text,true);
end $test$;
set local role authenticated;
do $test$
declare n integer;a uuid:=current_setting('tripmate.scope.trip_a')::uuid;b uuid:=current_setting('tripmate.scope.trip_b')::uuid;eid uuid:=current_setting('tripmate.scope.expense')::uuid;
begin
 update public.expenses set title='ไม่ควรแก้ได้' where id=eid;get diagnostics n=row_count;if n<>0 then raise exception 'Cross-trip expense update allowed';end if;
 begin insert into public.trip_stops(trip_id,day_number,title,place_name,created_by)values(b,1,'ไม่ควรเพิ่ม','ทดสอบ',auth.uid());raise exception 'Cross-trip plan insert allowed';exception when insufficient_privilege then null;end;
 begin insert into public.collections(trip_id,title,amount,original_amount,receiver_id,created_by)values(b,'ไม่ควรเพิ่ม',100,100,auth.uid(),auth.uid());raise exception 'Cross-trip collection insert allowed';exception when insufficient_privilege then null;end;
 insert into public.trip_stops(trip_id,day_number,title,place_name,created_by)values(a,1,'เพิ่มในทริปตัวเอง','ทดสอบ',auth.uid());
end $test$;
reset role;
select 'passed' as settings_cross_trip_scope;
rollback;
