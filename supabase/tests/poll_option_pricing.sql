do $test$
declare tid uuid;own uuid;mem uuid;tok uuid;opts uuid[];snap jsonb;rev integer;before_price jsonb;legacy uuid;
begin
 select owner_id into own from public.trips where name='ทดสอบ' limit 1;
 select id into mem from public.profiles where id<>own limit 1;
 if own is null or mem is null then raise exception 'Requires test profiles';end if;
 begin
 insert into public.trips(owner_id,name,start_date,end_date,status)values(own,'ทดสอบ · ราคาโหวต',current_date+1,current_date+3,'planning')returning id into tid;
 insert into public.trip_members(trip_id,user_id,trip_role)values(tid,own,'owner'),(tid,mem,'member');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',own,'role','authenticated')::text,true);
 tok:=public.trip_poll_save(tid,null,'เลือกที่พัก','{}','[{"name":"A","priceType":"range","priceMin":15000,"priceMax":18000,"priceUnit":"total"},{"name":"B","priceType":"fixed","priceMin":1500,"priceUnit":"person"},{"name":"C","priceType":"none"},{"name":"เดิม","price":777}]','open');
 snap:=public.trip_poll_snapshot(tok);
 if snap#>>'{options,0,priceType}'<>'range' or snap#>>'{options,0,priceMin}'<>'15000.00' or snap#>>'{options,0,priceMax}'<>'18000.00' or snap#>>'{options,0,priceUnit}'<>'total' or snap#>>'{options,0,price}' is not null then raise exception 'Range lost or converted into fixed price';end if;
 if snap#>>'{options,1,priceUnit}'<>'person' or snap#>>'{options,1,price}'<>'1500.00' or snap#>>'{options,2,price}' is not null then raise exception 'Fixed/none failed';end if;
 select array_agg((x->>'id')::uuid order by n) into opts from jsonb_array_elements(snap->'options')with ordinality a(x,n);
 legacy:=opts[4];select to_jsonb(o) into before_price from public.stay_poll_options o where id=legacy;
 perform public.trip_poll_option_save(tok,jsonb_build_object('id',legacy,'name','เดิม','price',777));
 if (select to_jsonb(o) from public.stay_poll_options o where id=legacy)<>before_price then raise exception 'Legacy option rewritten';end if;
 begin perform public.trip_poll_option_save(tok,jsonb_build_object('id',opts[1],'name','A','priceType','range','priceMin',100,'priceMax',99,'priceUnit','total'));raise exception 'Accepted reversed range';exception when others then if sqlerrm='Accepted reversed range' then raise;end if;end;
 begin perform public.trip_poll_option_save(tok,jsonb_build_object('id',opts[1],'name','A','priceType','fixed','priceMin',-1,'priceUnit','person'));raise exception 'Accepted negative price';exception when others then if sqlerrm='Accepted negative price' then raise;end if;end;
 begin perform public.trip_poll_option_save(tok,jsonb_build_object('id',opts[1],'name','A','priceType','fixed','priceMin',1.001,'priceUnit','person'));raise exception 'Accepted fractional satang';exception when others then if sqlerrm='Accepted fractional satang' then raise;end if;end;
 perform public.trip_poll_vote(tok,array[opts[1]]);
 select to_jsonb(o) into before_price from public.stay_poll_options o where id=opts[1];
 begin perform public.trip_poll_option_save(tok,jsonb_build_object('id',opts[1],'name','A','priceType','range','priceMin',15000,'priceMax',18000,'priceUnit','person'));raise exception 'Changed price unit after vote';exception when others then if sqlerrm='Changed price unit after vote' then raise;end if;end;
 if (select to_jsonb(o) from public.stay_poll_options o where id=opts[1])<>before_price then raise exception 'Voted option changed';end if;
 if exists(select 1 from public.expenses where trip_id=tid) or exists(select 1 from public.collections where trip_id=tid) or exists(select 1 from public.trip_fund_transactions where trip_id=tid) then raise exception 'Poll created financial entries';end if;
 raise exception using errcode='PT006',message='rollback poll price fixtures';
 exception when sqlstate 'PT006' then null;end;
 raise notice 'Poll pricing assertions passed; fixtures rolled back';
end $test$;
