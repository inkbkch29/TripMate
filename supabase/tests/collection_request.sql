do $test$
declare tid uuid;own uuid;mem uuid;cid uuid:=gen_random_uuid();payload jsonb;before_payment jsonb;
begin
 select owner_id into own from public.trips where name='ทดสอบ' limit 1;
 select id into mem from public.profiles where id<>own limit 1;
 if own is null or mem is null then raise exception 'Requires test profiles';end if;
 begin
 insert into public.trips(owner_id,name,start_date,end_date,status)values(own,'ทดสอบ · เรียกเก็บแยกค่าใช้จ่าย',current_date,current_date+1,'completed')returning id into tid;
 insert into public.trip_members(trip_id,user_id,trip_role)values(tid,own,'owner'),(tid,mem,'member');
 payload:=jsonb_build_object('title','เรียกเก็บรถ','receiver_id',own,'amounts',jsonb_build_object(own,10025,mem,5025));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',mem,'role','authenticated')::text,true);
 begin perform public.save_collection_request(tid,cid,payload);raise exception 'Member created request';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',own,'role','authenticated')::text,true);
 perform public.save_collection_request(tid,cid,payload);perform public.save_collection_request(tid,cid,payload);
 if (select count(*) from public.collections where trip_id=tid)<>1 or not exists(select 1 from public.collections where id=cid and collection_only and amount=150.50 and fund_remainder=0) then raise exception 'Request total or retry incorrect';end if;
 if exists(select 1 from public.collection_payments where collection_id=cid and status<>'unpaid') or public.trip_fund_balance(tid)<>0 then raise exception 'Created cash or auto-paid receiver';end if;
 perform public.confirm_collection_received(cid,mem,50.25);
 select to_jsonb(p) into before_payment from public.collection_payments p where collection_id=cid and user_id=mem;
 perform public.save_collection_request(tid,cid,payload);
 begin perform public.save_collection_request(tid,cid,jsonb_set(payload,'{amounts}',jsonb_build_object(own,10025,mem,6000)));raise exception 'Rewrote paid history';exception when others then if sqlerrm='Rewrote paid history' then raise;end if;end;
 if (select to_jsonb(p) from public.collection_payments p where collection_id=cid and user_id=mem)<>before_payment then raise exception 'Changed history';end if;
 if exists(select 1 from public.trip_fund_rounding(tid) where collection_id=cid) or public.trip_fund_balance(tid)<>0 then raise exception 'Request created fund surplus';end if;
 begin update public.collections set collection_only=false where id=cid;raise exception 'Changed intent';exception when others then if sqlerrm='Changed intent' then raise;end if;end;
 raise exception using errcode='PT005',message='rollback request fixtures';
 exception when sqlstate 'PT005' then null;end;
 raise notice 'Collection request assertions passed; fixtures rolled back';
end $test$;
