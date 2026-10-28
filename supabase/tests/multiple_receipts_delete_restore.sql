begin;
do $$
declare tid uuid;a uuid;b uuid;eid uuid:=gen_random_uuid();trash uuid;p1 text;p2 text;p3 text;payload jsonb;before_exp jsonb;before_shares jsonb;after_shares jsonb;paths text[];p text;cycle integer;
begin
 select owner_id into a from public.trips where name='ทดสอบ' limit 1;
 select id into b from public.profiles where id<>a limit 1;
 if a is null or b is null then raise exception 'Need two fixture members';end if;
 insert into public.trips(name,owner_id,start_date,end_date,status) values('QA multi receipt restore rollback',a,current_date,current_date+1,'planning') returning id into tid;
 insert into public.trip_members(trip_id,user_id,trip_role)values(tid,a,'owner'),(tid,b,'member');
 p1:=tid||'/'||a||'/one.png';p2:=tid||'/'||a||'/two.jpg';p3:=tid||'/'||a||'/three.png';paths:=array[p1,p2,p3];
 insert into storage.objects(bucket_id,name,owner_id)select 'trip-files',x,a::text from unnest(paths)x;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 payload:=jsonb_build_object('id',eid,'trip_id',tid,'title','QA three receipts','amount',123.45,'paid_by',a,'category','อาหาร','expense_date',current_date,'meal_period','lunch','split_method','equal','approval_status','approved','receipt_path',p1,'receipt_attachments',jsonb_build_array(jsonb_build_object('path',p1,'name','one.png','type','image/png'),jsonb_build_object('path',p2,'name','two.jpg','type','image/jpeg'),jsonb_build_object('path',p3,'name','three.png','type','image/png')));
 perform public.save_expense_with_shares(payload,array[a,b],array[61.73,61.72],null);
 select to_jsonb(e)into before_exp from public.expenses e where id=eid;
 select jsonb_agg(to_jsonb(s)order by user_id)into before_shares from public.expense_participants s where expense_id=eid;
 for cycle in 1..2 loop
  perform public.delete_trip_item(tid,'expense',eid);
  if exists(select 1 from public.expenses where id=eid)or exists(select 1 from public.expense_participants where expense_id=eid)then raise exception 'Delete left live financial rows';end if;
  if coalesce((select sum(amount)from public.expenses where trip_id=tid),0)<>0 then raise exception 'Deleted expense still counted';end if;
  select id into trash from public.trip_trash where trip_id=tid and item_id=eid;
  if trash is null or (select count(*)from public.trip_trash where trip_id=tid and item_id=eid)<>1 then raise exception 'Trash missing or duplicated';end if;
  if (select t.payload->'record'->'receipt_attachments'from public.trip_trash t where t.id=trash)is distinct from before_exp->'receipt_attachments' then raise exception 'Trash lost receipt metadata';end if;
  foreach p in array paths loop
   if not exists(select 1 from storage.objects where bucket_id='trip-files'and name=p)or not public.trip_financial_file_locked(p)then raise exception 'Trashed receipt missing or unprotected';end if;
  end loop;
  -- Another member cannot restore the owner's archived expense.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
  begin perform public.restore_trip_item(trash);raise exception 'Unauthorized restore accepted';exception when raise_exception then if sqlerrm='Unauthorized restore accepted'then raise;end if;end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  perform public.restore_trip_item(trash);
  if (select to_jsonb(e)from public.expenses e where id=eid)is distinct from before_exp then raise exception 'Restored expense differs from original';end if;
  select jsonb_agg(to_jsonb(s)order by user_id)into after_shares from public.expense_participants s where expense_id=eid;
  if after_shares is distinct from before_shares then raise exception 'Restored individual shares differ';end if;
  if (select count(*)from public.expenses where trip_id=tid)<>1 or(select sum(amount)from public.expenses where trip_id=tid)<>123.45 or(select sum(share_amount)from public.expense_participants where expense_id=eid)<>123.45 then raise exception 'Expense total or shares duplicated';end if;
  foreach p in array paths loop
   if not exists(select 1 from storage.objects where bucket_id='trip-files'and name=p)or not public.trip_financial_file_locked(p)then raise exception 'Restored receipt missing or unprotected';end if;
  end loop;
  begin perform public.restore_trip_item(trash);raise exception 'Repeated restore accepted';exception when raise_exception then if sqlerrm='Repeated restore accepted'then raise;end if;end;
  if (select count(*)from public.expenses where trip_id=tid)<>1 or(select count(*)from public.expense_participants where expense_id=eid)<>2 or exists(select 1 from public.trip_trash where id=trash)then raise exception 'Repeated restore duplicated rows';end if;
 end loop;
 if public.trip_fund_balance(tid)<>0 then raise exception 'Delete/restore created fund money';end if;
end$$;
rollback;
