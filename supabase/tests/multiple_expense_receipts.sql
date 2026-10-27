begin;
do $$declare tid uuid;foreign_trip uuid;a uuid;b uuid;eid uuid:=gen_random_uuid();p1 text;p2 text;p3 text;foreign_path text;payload jsonb;r jsonb;trash uuid;begin
 select owner_id into a from public.trips where name='ทดสอบ' limit 1;select id into b from public.profiles where id<>a limit 1;
 insert into public.trips(name,owner_id,start_date,end_date,status)values('QA multiple receipts rollback',a,current_date,current_date+1,'planning')returning id into tid;
 insert into public.trip_members(trip_id,user_id,trip_role)values(tid,a,'owner'),(tid,b,'member');
 insert into public.trips(name,owner_id,start_date,end_date,status)values('QA foreign receipts rollback',b,current_date,current_date+1,'planning')returning id into foreign_trip;
 p1:=tid||'/'||a||'/one.png';p2:=tid||'/'||a||'/two.png';p3:=tid||'/'||a||'/three.png';foreign_path:=foreign_trip||'/'||b||'/foreign.png';
 insert into storage.objects(bucket_id,name,owner_id)values('trip-files',p1,a::text),('trip-files',p2,a::text),('trip-files',p3,a::text),('trip-files',foreign_path,b::text);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 payload:=jsonb_build_object('id',eid,'trip_id',tid,'title','QA multiple','amount',123.45,'paid_by',a,'category','อาหาร','expense_date',current_date,'meal_period','lunch','split_method','equal','approval_status','approved','receipt_path',p1,'receipt_attachments',jsonb_build_array(jsonb_build_object('path',p1,'name','one.png','type','image/png'),jsonb_build_object('path',p2,'name','two.png','type','image/png')));
 r:=public.save_expense_with_shares(payload,array[a,b],array[61.73,61.72],null);
 if(select count(*)from public.expenses where trip_id=tid)<>1 or(select sum(amount)from public.expenses where trip_id=tid)<>123.45 or(select jsonb_array_length(receipt_attachments)from public.expenses where id=eid)<>2 then raise exception 'Initial save duplicated cost or lost receipts';end if;
 if not public.trip_financial_file_locked(p2)then raise exception 'Secondary receipt not protected';end if;
 payload:=jsonb_set(payload,'{receipt_attachments}',jsonb_build_array(jsonb_build_object('path',p1,'name','one.png','type','image/png'),jsonb_build_object('path',p3,'name','three.png','type','image/png')));
 r:=public.save_expense_with_shares(payload,array[a,b],array[61.73,61.72],(r->>'revision')::int);
 if(select receipt_attachments->1->>'path'from public.expenses where id=eid)<>p3 or(select amount from public.expenses where id=eid)<>123.45 then raise exception 'Edit lost receipts or changed amount';end if;
 begin perform public.save_expense_with_shares(jsonb_set(payload,'{receipt_attachments}',jsonb_build_array(jsonb_build_object('path',foreign_path,'type','image/png'))),array[a,b],array[61.73,61.72],(r->>'revision')::int);raise exception 'Cross-trip receipt accepted';exception when insufficient_privilege then null;end;
 if public.save_expense_with_shares(payload,array[a,b],array[61.73,61.72],1)is not null then raise exception 'Stale revision accepted';end if;
 -- Old clients omit the new field; editing must retain all current attachments.
 select public.save_expense_with_shares(payload-'receipt_attachments',array[a,b],array[61.73,61.72],revision) into r from public.expenses where id=eid;
 if(select jsonb_array_length(receipt_attachments)from public.expenses where id=eid)<>2 then raise exception 'Legacy client removed receipts';end if;
end$$;
rollback;
