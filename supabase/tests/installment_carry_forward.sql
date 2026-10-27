do $test$
declare tid uuid;own uuid;users uuid[];parent uuid;first uuid;second uuid;plan jsonb;pr jsonb;payhash text;rowsbefore jsonb;key uuid;uid uuid;due numeric;payload jsonb;path text;
begin
 select owner_id into own from public.trips where name='ทดสอบ' limit 1;
 select array_agg(id order by id)into users from(select id from public.profiles where id<>own order by id limit 14)x;users:=array_prepend(own,users);
 if array_length(users,1)<>15 then raise exception 'Requires 15 profiles for rollback carry test';end if;
 begin
 insert into public.trips(owner_id,name,start_date,end_date,status)values(own,'QA carry rollback',current_date,current_date+2,'planning')returning id into tid;
 insert into public.trip_members(trip_id,user_id,trip_role)select tid,u,case when u=own then 'owner'else 'member'end from unnest(users)u;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',own,'role','authenticated')::text,true);
 plan:=public.installment_expense_action(tid,'create',jsonb_build_object('title','QA carry','total_satang',1690000,'members',(select jsonb_agg(jsonb_build_object('user_id',u))from unnest(users[1:14])u),'installments','[{"title":"มัดจำ","bill_satang":845000},{"title":"คงเหลือ","bill_satang":845000}]'::jsonb),gen_random_uuid());parent:=(plan->>'expense_id')::uuid;
 pr:=public.installment_expense_preview(parent,1,'[]',100,null,'ceil');plan:=public.installment_expense_action(tid,'issue',jsonb_build_object('parent_id',parent,'revision',plan->'revision','number',1,'receiver_id',own,'unit',100,'mode','ceil','charges',pr->'charges'),gen_random_uuid());
 first:=(plan->'installments'->0->'collection_ids'->>0)::uuid;
 foreach uid in array users[1:10]loop perform public.confirm_collection_received(first,uid,604);end loop;
 path:=tid||'/'||users[11]||'/carry-slip.png';insert into storage.objects(bucket_id,name,owner_id)values('trip-files',path,users[11]::text);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',users[11],'role','authenticated')::text,true);perform public.submit_collection_payment(first,path,users[11]);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',own,'role','authenticated')::text,true);
 plan:=public.installment_expense_snapshot(parent);pr:=public.installment_expense_preview(parent,2,jsonb_build_array(jsonb_build_object('user_id',users[15],'scope','full')),100,null,'ceil');
 select jsonb_agg(to_jsonb(p)order by user_id)into rowsbefore from public.collection_payments p where collection_id=first;
 begin perform public.installment_expense_action(tid,'issue',jsonb_build_object('parent_id',parent,'revision',plan->'revision','number',2,'receiver_id',own,'unit',100,'mode','ceil','additions',jsonb_build_array(jsonb_build_object('user_id',users[15],'scope','full')),'charges',pr->'charges'),gen_random_uuid());raise exception 'Pending receipt issuance accepted';exception when others then if sqlerrm='Pending receipt issuance accepted'then raise;end if;end;
 if rowsbefore<>(select jsonb_agg(to_jsonb(p)order by user_id)from public.collection_payments p where collection_id=first)then raise exception 'Blocked issue changed history';end if;
 perform public.confirm_collection_received(first,users[11],604);
 select md5(jsonb_agg(to_jsonb(p)order by user_id)::text)into payhash from public.collection_payments p where collection_id=first and status='paid';
 plan:=public.installment_expense_snapshot(parent);pr:=public.installment_expense_preview(parent,2,jsonb_build_array(jsonb_build_object('user_id',users[15],'scope','full')),100,null,'ceil');
 if(pr->>'target_satang')::bigint<>1025600 or(pr->>'charged_satang')::bigint<>1026100 then raise exception 'Wrong carried cash basis';end if;
 key:=gen_random_uuid();payload:=jsonb_build_object('parent_id',parent,'revision',plan->'revision','number',2,'receiver_id',own,'unit',100,'mode','ceil','additions',jsonb_build_array(jsonb_build_object('user_id',users[15],'scope','full')),'charges',pr->'charges');
 plan:=public.installment_expense_action(tid,'issue',payload,key);perform public.installment_expense_action(tid,'issue',payload,key);
 second:=(plan->'installments'->1->'collection_ids'->>0)::uuid;
 if(select count(*)from public.collection_payments where collection_id=first and installment_superseded_at is not null)<>3 or(select count(*)from public.collections where trip_id=tid)<>2 then raise exception 'Carry did not retire exactly three old dues';end if;
 if(select sum(installment_bill_satang)from public.collections where trip_id=tid)<>1690000 or(select original_amount from public.collections where id=first)<>8450 then raise exception 'Cost basis or original bill changed';end if;
 foreach uid in array users[12:14]loop
 begin perform public.confirm_collection_received(first,uid,604);raise exception 'Retired request confirmed twice';exception when others then if sqlerrm='Retired request confirmed twice'then raise;end if;end;
 end loop;
 for uid,due in select user_id,amount from public.collection_payments where collection_id=second and user_id<>users[15]loop perform public.confirm_collection_received(second,uid,due);end loop;
 if public.trip_fund_balance(tid)<>0 or exists(select 1 from public.trip_fund_rounding(tid)where available_satang>0)then raise exception 'Fund credited before receipts complete';end if;
 perform public.confirm_collection_received(second,users[15],1127);
 if(select available_satang from public.trip_fund_rounding(tid)where collection_id=second)<>500 then raise exception 'Final surplus is not five baht';end if;
 key:=gen_random_uuid();payload:=jsonb_build_object('collection_id',second,'custodian_id',own,'amount_satang',500);perform public.trip_fund_action(tid,'rounding',payload,key);perform public.trip_fund_action(tid,'rounding',payload,key);
 if public.trip_fund_balance(tid)<>500 or(select count(*)from public.trip_fund_transactions where trip_id=tid and type='rounding')<>1 then raise exception 'Fund duplicated carry surplus';end if;
 if payhash<>(select md5(jsonb_agg(to_jsonb(p)order by user_id)::text)from public.collection_payments p where collection_id=first and status='paid')then raise exception 'Paid first history changed';end if;
 raise exception using errcode='PT005',message='rollback carry fixture';
 exception when sqlstate 'PT005' then null;end;
end $test$;
