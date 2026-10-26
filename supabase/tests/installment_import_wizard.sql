do $test$
declare tid uuid;own uuid;users uuid[];cid1 uuid;cid2 uuid;cid3 uuid;req uuid;parent uuid;payload jsonb;bad jsonb;js jsonb;shares jsonb;alloc1 jsonb;alloc2 jsonb;oldhash text;source_review jsonb;
begin
 select owner_id into own from public.trips where name='ทดสอบ' limit 1;
 select array_agg(id order by id) into users from(select id from public.profiles where id<>own order by id limit 14)x;users:=array_prepend(own,users);
 if array_length(users,1)<>15 then raise exception 'Requires authorized test owner and 15 existing profiles';end if;
 begin
 insert into public.trips(owner_id,name,start_date,end_date,status)values(own,'ทดสอบ · รวมบิล 3 ขั้นตอน',current_date-3,current_date-1,'completed')returning id into tid;
 insert into public.trip_members(trip_id,user_id,trip_role)select tid,u,case when u=own then 'owner' else 'member' end from unnest(users)u;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',own,'role','authenticated')::text,true);
 insert into public.collections(trip_id,title,amount,original_amount,receiver_id,due_date,created_by)values(tid,'มัดจำ',8456,8450,own,current_date,own)returning id into cid1;
 insert into public.collections(trip_id,title,amount,original_amount,receiver_id,due_date,created_by)values(tid,'ส่วนที่เหลือเดิม',7322,7317.33,own,current_date,own)returning id into cid2;
 insert into public.collections(trip_id,title,amount,original_amount,receiver_id,due_date,created_by)values(tid,'สมาชิกใหม่',1127,1126.67,own,current_date,own)returning id into cid3;
 insert into public.collection_payments(collection_id,user_id,amount,status,received_amount,confirmed_at)select cid1,u,604,'paid',case when u=own then 604 else null end,now() from unnest(users[1:14])u;
 insert into public.collection_payments(collection_id,user_id,amount,status)select cid2,u,523,'unpaid' from unnest(users[1:14])u;
 insert into public.collection_payments(collection_id,user_id,amount,status)values(cid3,users[15],1127,'unpaid');
 select md5(string_agg(to_jsonb(p)::text,'' order by collection_id,user_id))into oldhash from public.collection_payments p where collection_id in(cid1,cid2,cid3);
 select jsonb_object_agg(u,case when u=users[15] then 112700 when u=own then 52400 else 52300 end)into shares from unnest(users)u;
 alloc1:=jsonb_build_object('mode','equal','member_ids',to_jsonb(users[1:14]));alloc2:=jsonb_build_object('mode','custom','member_ids',to_jsonb(users),'shares_satang',shares);
 payload:=jsonb_build_object('title','ค่าที่พัก','total_satang',1690000,'note','ตรวจบิลต้นฉบับและคงประวัติเดิม','approved',true,'members',(select jsonb_agg(jsonb_build_object('user_id',u))from unnest(users)u),'installments',jsonb_build_array(
 jsonb_build_object('title','มัดจำ','bill_satang',845000,'allocation',alloc1,'sources',jsonb_build_array(jsonb_build_object('collection_id',cid1,'bill_satang',845000,'review',public.installment_source_review(cid1)))),
 jsonb_build_object('title','คงเหลือ','bill_satang',845000,'allocation',alloc2,'sources',jsonb_build_array(jsonb_build_object('collection_id',cid2,'bill_satang',732300,'review',public.installment_source_review(cid2)),jsonb_build_object('collection_id',cid3,'bill_satang',112700,'review',public.installment_source_review(cid3))))));
 bad:=jsonb_set(payload,'{installments,0,sources,0,review,amount_satang}','1');
 begin perform public.installment_expense_action(tid,'import',bad,gen_random_uuid());raise exception 'Accepted stale source review';exception when others then if sqlerrm='Accepted stale source review' then raise;end if;end;
 bad:=jsonb_set(payload,'{installments,1,allocation,shares_satang}',shares||jsonb_build_object(own,52300));
 begin perform public.installment_expense_action(tid,'import',bad,gen_random_uuid());raise exception 'Accepted mismatched manual amounts';exception when others then if sqlerrm='Accepted mismatched manual amounts' then raise;end if;end;
 req:=gen_random_uuid();js:=public.installment_expense_action(tid,'import',payload,req);parent:=(js->>'expense_id')::uuid;
 perform public.installment_expense_action(tid,'import',payload,req);
 if(select count(*) from public.expenses where trip_id=tid and is_installment_parent)<>1 then raise exception 'Retry duplicated parent';end if;
 if(select amount from public.expenses where id=parent)<>16900 or(select sum(bill_satang)from public.expense_installments where parent_expense_id=parent)<>1690000 then raise exception 'Wrong actual bill';end if;
 if(select jsonb_array_length(allocation->'member_ids')from public.expense_installments where parent_expense_id=parent and number=1)<>14 or(select allocation->'shares_satang'from public.expense_installments where parent_expense_id=parent and number=2)<>shares then raise exception 'Per-part membership/manual allocation lost';end if;
 if oldhash<>(select md5(string_agg(to_jsonb(p)::text,'' order by collection_id,user_id))from public.collection_payments p where collection_id in(cid1,cid2,cid3)) or(select original_amount from public.collections where id=cid2)<>7317.33 then raise exception 'Historical payment or original cost changed';end if;
 js:=public.installment_expense_preview(parent,2,'[]',1,null,'balanced');if(js->'cash'->>'unknown')::int<>13 then raise exception 'Paid flags inferred as cash';end if;
 if public.trip_fund_balance(tid)<>0 then raise exception 'Import allocated cash/fund automatically';end if;
 if not exists(select 1 from public.expense_installment_audit a where a.parent_expense_id=parent and a.action='import' and a.payload->'installments'->1->'allocation'->'shares_satang'=shares) then raise exception 'Missing approved allocation audit';end if;
 raise exception using errcode='PT004',message='rollback import wizard fixtures';
 exception when sqlstate 'PT004' then null;end;
 raise notice 'Three-step import allocation passed; fixtures rolled back';
end $test$;
