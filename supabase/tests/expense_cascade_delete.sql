begin;
do $$declare tid uuid;uid uuid;eid uuid:=gen_random_uuid();cid uuid:=gen_random_uuid();begin
 select owner_id into uid from public.trips where name='ทดสอบ' limit 1;
 insert into public.trips(owner_id,name,start_date,end_date,status)values(uid,'QA financial delete rollback',current_date,current_date+1,'planning')returning id into tid;
 insert into public.trip_members(trip_id,user_id,trip_role)values(tid,uid,'owner');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
 insert into public.expenses(id,trip_id,title,amount,paid_by,created_by,approval_status)values(eid,tid,'QA pending expense',10,uid,uid,'pending');
 insert into public.expense_participants(expense_id,user_id,share_amount)values(eid,uid,10);
 insert into public.collections(id,trip_id,title,amount,receiver_id,created_by)values(cid,tid,'QA pending collection',10,uid,uid);
 perform set_config('qa.delete.trip',tid::text,true);perform set_config('qa.delete.expense',eid::text,true);perform set_config('qa.delete.collection',cid::text,true);
end$$;
set local role authenticated;
do $$declare tid uuid:=current_setting('qa.delete.trip')::uuid;eid uuid:=current_setting('qa.delete.expense')::uuid;cid uuid:=current_setting('qa.delete.collection')::uuid;trash uuid;begin
 begin delete from public.expenses where id=eid;raise exception 'Expense delete bypassed audit RPC';exception when insufficient_privilege then null;end;
 begin delete from public.collections where id=cid;raise exception 'Collection delete bypassed audit RPC';exception when insufficient_privilege then null;end;
 perform public.delete_trip_item(tid,'expense',eid);perform public.delete_trip_item(tid,'collection',cid);
 if(select count(*) from public.trip_trash where trip_id=tid)<>2 then raise exception 'Financial deletion not recoverable';end if;
 select id into trash from public.trip_trash where trip_id=tid and item_id=eid;perform public.restore_trip_item(trash);
 select id into trash from public.trip_trash where trip_id=tid and item_id=cid;perform public.restore_trip_item(trash);
 if not exists(select 1 from public.expense_participants where expense_id=eid and share_amount=10) then raise exception 'Restore lost shares';end if;
 if not exists(select 1 from public.expenses where id=eid) or not exists(select 1 from public.collections where id=cid) then raise exception 'Restore lost source record';end if;
end$$;
reset role;

do $$declare tid uuid:=current_setting('qa.delete.trip')::uuid;uid uuid:=auth.uid();cid uuid:=gen_random_uuid();snap jsonb;trash uuid;begin
 insert into storage.objects(bucket_id,name,owner_id)values('trip-files',tid||'/'||uid||'/restore-qr.png',uid::text);
 update public.profiles set account_name='QA old snapshot',payment_qr_path=tid||'/'||uid||'/restore-qr.png' where id=uid;
 perform public.trip_fund_action(tid,'contribution',jsonb_build_object('collection_id',cid,'title','QA restore fund','custodian_id',uid,'amounts',jsonb_build_object(uid,1000)),gen_random_uuid());
 select receiving_account_snapshot into snap from public.collections where id=cid;
 perform public.delete_trip_item(tid,'collection',cid);
 update public.profiles set account_name='QA changed account' where id=uid;
 select id into trash from public.trip_trash where trip_id=tid and item_id=cid;
 perform public.restore_trip_item(trash);
 if (select receiving_account_snapshot from public.collections where id=cid) is distinct from snap then raise exception 'Restored historical snapshot changed';end if;
end$$;
rollback;
