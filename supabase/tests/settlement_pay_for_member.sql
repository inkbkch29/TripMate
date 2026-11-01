-- Run after 20261101160000_settlement_pay_for_member.sql; all data rolls back.
begin;
do $$
declare a uuid;b uuid;c uuid;tid uuid;sid uuid;path text;
begin
 select owner_id into a from public.trips where name='ทดสอบ' limit 1;
 select id into b from public.profiles where id<>a limit 1;
 select id into c from public.profiles where id not in(a,b) limit 1;
 if a is null or b is null or c is null then raise exception 'Requires three existing test profiles';end if;
 insert into public.trips(name,owner_id,start_date,end_date,status) values('QA settlement behalf rollback',a,current_date,current_date+1,'planning') returning id into tid;
 insert into public.trip_members(trip_id,user_id,trip_role) values(tid,a,'owner'),(tid,b,'member'),(tid,c,'member');
 path:=tid||'/'||c||'/behalf.png';
 insert into storage.objects(bucket_id,name,owner_id) values('trip-files',path,c::text);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 sid:=public.submit_settlement_for_member(tid,a,100,path,b);
 if not exists(select 1 from public.trip_settlements where id=sid and from_user=b and submitted_by=c and to_user=a and status='pending')then raise exception 'Debt attribution lost';end if;
 if public.submit_settlement_for_member(tid,a,100,path,b)<>sid then raise exception 'Retry duplicated payment';end if;
 begin
  perform public.submit_settlement_for_member(tid,a,101,path,b);
  raise exception 'Pending payment overwritten';
 exception when raise_exception then if sqlerrm='Pending payment overwritten' then raise;end if;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 begin
  perform public.submit_settlement_for_member(tid,a,100,path,b);
  raise exception 'Another member slip accepted';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 perform public.review_settlement(sid,'confirmed');
 if not exists(select 1 from public.trip_settlements where id=sid and status='confirmed' and from_user=b and submitted_by=c)then raise exception 'Confirmation lost debt attribution';end if;
end $$;
rollback;
