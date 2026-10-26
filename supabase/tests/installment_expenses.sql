do $test$
declare tid uuid;own uuid;mem uuid;users uuid[];parent uuid;cid uuid;sid uuid;req uuid;rev integer;js jsonb;pr jsonb;payload jsonb;uid uuid;value numeric;oldhash text;newhash text;legacy uuid[];legacyparent uuid;k integer;imported jsonb;fund_before bigint;guest_token uuid;guest jsonb;
begin
 select owner_id into own from public.trips where name='ทดสอบ' limit 1;
 select array_agg(id order by id) into users from(select id from public.profiles where id<>own order by id limit 14)x;
 if array_length(users,1)<>14 then raise exception 'Requires 15 existing profiles for the authorized rollback example';end if;users:=array_prepend(own,users);mem:=users[15];
 begin
 insert into public.trips(owner_id,name,start_date,end_date,status)values(own,'ทดสอบ · หลายงวดชั่วคราว',current_date-3,current_date-1,'completed') returning id into tid;
 insert into public.trip_members(trip_id,user_id,trip_role) select tid,u,case when u=own then 'owner' else 'member' end from unnest(users)u;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',own,'role','authenticated')::text,true);
 payload:=jsonb_build_object('title','ค่าที่พัก','total_satang',1690000,'members',(select jsonb_agg(jsonb_build_object('user_id',u)) from unnest(users[1:14])u),'installments','[{"title":"มัดจำ","bill_satang":845000},{"title":"ยอดคงเหลือ","bill_satang":845000}]'::jsonb);
 req:=gen_random_uuid();js:=public.installment_expense_action(tid,'create',payload,req);parent:=(js->>'expense_id')::uuid;
 perform public.installment_expense_action(tid,'create',payload,req);
 if (select count(*) from public.expenses where trip_id=tid)<>1 then raise exception 'Parent duplicated';end if;
 pr:=public.installment_expense_preview(parent,1,'[]',100,null,'ceil');
 if (pr->>'charged_satang')::bigint<>845600 or exists(select 1 from jsonb_each_text(pr->'charges')x where x.value::bigint<>60400) then raise exception 'First installment not 14 x 604';end if;
 js:=public.installment_expense_action(tid,'issue',jsonb_build_object('parent_id',parent,'revision',js->'revision','number',1,'receiver_id',own,'unit',100,'mode','ceil','charges',pr->'charges'),gen_random_uuid());
 select c.id into cid from public.collections c join public.expense_installments i on i.id=c.installment_id where i.parent_expense_id=parent and i.number=1;
 foreach uid in array users[1:14] loop perform public.confirm_collection_received(cid,uid,604);end loop;
 select md5(jsonb_agg(to_jsonb(p) order by user_id)::text) into oldhash from public.collection_payments p where collection_id=cid;
 if public.trip_fund_balance(tid)<>0 then raise exception 'Rounding transferred automatically';end if;
 if (select available_satang from public.trip_fund_rounding(tid) where collection_id=cid)<>600 then raise exception 'First rounding not six baht';end if;
 js:=public.installment_expense_snapshot(parent);
 pr:=public.installment_expense_preview(parent,2,jsonb_build_array(jsonb_build_object('user_id',mem,'scope','future')),1,null,'balanced');
 if (pr->'charges'->>mem::text)::bigint not in (56333,56334) then raise exception 'Future-only newcomer charged for old installment';end if;
 pr:=public.installment_expense_preview(parent,2,jsonb_build_array(jsonb_build_object('user_id',mem,'scope','full')),100,own,'balanced');
 if (pr->'charges'->>mem::text)::bigint<>112700 or (pr->'charges'->>own::text)::bigint<>52400 or (select count(*) from jsonb_each_text(pr->'charges')x where x.value::bigint=52300)<>13 or (pr->>'charged_satang')::bigint<>845000 then raise exception 'Second installment example mismatch: %',pr;end if;
 payload:=jsonb_build_object('parent_id',parent,'revision',js->'revision','number',2,'receiver_id',own,'unit',100,'mode','balanced','remainder_member',own,'charges',pr->'charges','additions',jsonb_build_array(jsonb_build_object('user_id',mem,'scope','full')));
 req:=gen_random_uuid();js:=public.installment_expense_action(tid,'issue',payload,req);perform public.installment_expense_action(tid,'issue',payload,req);
 select md5(jsonb_agg(to_jsonb(p) order by user_id)::text) into newhash from public.collection_payments p where collection_id=cid;
 if newhash<>oldhash then raise exception 'First payment history rewritten';end if;
 if (select sum(amount) from public.collections where trip_id=tid)<>16906 or (select amount from public.expenses where id=parent)<>16900 then raise exception 'Real bill or collected total wrong';end if;
 begin perform public.installment_expense_action(tid,'issue',payload,gen_random_uuid());raise exception 'Stale revision accepted';exception when raise_exception then if sqlerrm='Stale revision accepted' then raise;end if;end;
 perform public.trip_fund_action(tid,'rounding',jsonb_build_object('collection_id',cid,'custodian_id',own,'amount_satang',600),gen_random_uuid());
 if public.trip_fund_balance(tid)<>600 or not exists(select 1 from public.trip_fund_transactions where trip_id=tid and type='rounding' and expense_id=parent) then raise exception 'Confirmed surplus not posted with parent reference';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',mem,'role','authenticated')::text,true);
 begin perform public.installment_expense_action(tid,'create',payload,gen_random_uuid());raise exception 'Member changed expense';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',own,'role','authenticated')::text,true);
 select id into sid from public.expense_installments where parent_expense_id=parent and number=1;
 js:=public.installment_expense_action(tid,'vendor',jsonb_build_object('parent_id',parent,'revision',js->'revision','installment_id',sid,'amount_satang',845000,'note','ตรวจยอดโอนที่พักจริง'),gen_random_uuid());
 begin perform public.installment_expense_action(tid,'vendor',jsonb_build_object('parent_id',parent,'revision',js->'revision','installment_id',sid,'amount_satang',1,'note','ต้องปฏิเสธยอดจ่ายซ้ำ'),gen_random_uuid());raise exception 'Vendor double payment accepted';exception when raise_exception then if sqlerrm='Vendor double payment accepted' then raise;end if;end;
 -- Finish the second installment and reconcile actual cash, supplier payments and fund surplus.
 select c.id into cid from public.collections c join public.expense_installments i on i.id=c.installment_id where i.parent_expense_id=parent and i.number=2;
 for uid,value in select cp.user_id,cp.amount from public.collection_payments cp where cp.collection_id=cid loop perform public.confirm_collection_received(cid,uid,value);end loop;
 js:=public.installment_expense_snapshot(parent);select id into sid from public.expense_installments where parent_expense_id=parent and number=2;
 js:=public.installment_expense_action(tid,'vendor',jsonb_build_object('parent_id',parent,'revision',js->'revision','installment_id',sid,'amount_satang',845000,'note','ชำระยอดที่พักส่วนที่เหลือจริง'),gen_random_uuid());
 if (select sum(p.received_amount)*100 from public.collection_payments p join public.collections c on c.id=p.collection_id join public.expense_installments i on i.id=c.installment_id where i.parent_expense_id=parent)<>1690600 then raise exception 'Total received not 16906';end if;
 if (select sum(v.amount_satang) from public.expense_installment_vendor_payments v join public.expense_installments i on i.id=v.installment_id where i.parent_expense_id=parent)<>1690000 or public.trip_fund_balance(tid)<>600 or exists(select 1 from public.trip_fund_rounding(tid) where available_satang>0) then raise exception 'Final bill/fund cash did not reconcile';end if;
 insert into public.trip_invites(trip_id,label,invited_by,expires_at)values(tid,'QA guest installment summary',own,now()+interval '1 day')returning token into guest_token;
 guest:=public.guest_trip_snapshot(guest_token);if (guest->'expense_summary'->>'total')::numeric<>16900 or jsonb_array_length(guest->'collections')<>1 then raise exception 'Guest view double counted parent/child expenses';end if;
 -- Review/approval can correct an old cost basis without changing any old amount or receipt.
 legacy:=array[]::uuid[];
 for k in 1..3 loop
  insert into public.collections(trip_id,title,amount,original_amount,fund_remainder,is_fund,receiver_id,due_date,created_by)
  values(tid,'QA legacy source '||k,case k when 1 then 8456 when 2 then 7322 else 1127 end,case k when 1 then 8450 when 2 then 7317.33 else 1126.67 end,case k when 1 then 6 when 2 then 4.67 else .33 end,false,own,current_date,own) returning id into cid;
  legacy:=array_append(legacy,cid);
  if k=1 then insert into public.collection_payments(collection_id,user_id,amount,status)select cid,u,604,'paid' from unnest(users[1:14])u;
  elsif k=2 then insert into public.collection_payments(collection_id,user_id,amount,status)select cid,u,523,case when u=own then 'paid' else 'unpaid' end from unnest(users[1:14])u;
  else insert into public.collection_payments(collection_id,user_id,amount,status)values(cid,mem,1127,'unpaid');end if;
 end loop;
 payload:=jsonb_build_object('title','QA approved legacy parent','total_satang',1690000,'members',(select jsonb_agg(jsonb_build_object('user_id',u)) from unnest(users)u),'approved',true,'note','ตรวจบิลจริง 16900 ยอดอ้างอิงผิดต่าง6บาท','installments',jsonb_build_array(
 jsonb_build_object('title','มัดจำ','bill_satang',845000,'sources',jsonb_build_array(jsonb_build_object('collection_id',legacy[1],'bill_satang',845000))),
 jsonb_build_object('title','ยอดคงเหลือ','bill_satang',845000,'sources',jsonb_build_array(jsonb_build_object('collection_id',legacy[2],'bill_satang',732300),jsonb_build_object('collection_id',legacy[3],'bill_satang',112700)))));
 begin perform public.installment_expense_action(tid,'import',payload||'{"approved":false}',gen_random_uuid());raise exception 'Unapproved merge accepted';exception when raise_exception then if sqlerrm='Unapproved merge accepted' then raise;end if;end;
 imported:=public.installment_expense_action(tid,'import',payload,gen_random_uuid());legacyparent:=(imported->>'expense_id')::uuid;
 if (select sum(original_amount) from public.collections where id=any(legacy))<>16894 then raise exception 'Historical bill amounts rewritten';end if;
 if (select sum(amount) from public.collections where id=any(legacy))<>16905 then raise exception 'Historical charged amounts rewritten';end if;
 if (select amount from public.expenses where id=legacyparent)<>16900 then raise exception 'Approved parent bill not 16900';end if;
 pr:=public.installment_expense_preview(legacyparent,2,'[]',100,own,'balanced');if (pr->'cash'->>'unknown')::integer<>14 then raise exception 'Old paid flags inferred as actual cash';end if;
 foreach uid in array users[1:14] loop
  imported:=public.installment_expense_action(tid,'attest',jsonb_build_object('parent_id',legacyparent,'revision',imported->'revision','collection_id',legacy[1],'member_id',uid,'cash_satang',60400,'note','ตรวจหลักฐานรับจริง604บาท'),gen_random_uuid());
 end loop;
 imported:=public.installment_expense_action(tid,'attest',jsonb_build_object('parent_id',legacyparent,'revision',imported->'revision','collection_id',legacy[2],'member_id',own,'cash_satang',0,'note','สถานะผู้รับอัตโนมัติ ยังไม่มีเงินรับจริง'),gen_random_uuid());
 pr:=public.installment_expense_preview(legacyparent,2,'[]',100,own,'balanced');
 if (pr->'charges'->>mem::text)::bigint<>112700 or (pr->'charges'->>own::text)::bigint<>52400 then raise exception 'Legacy adjustment not matching example';end if;
 imported:=public.installment_expense_action(tid,'issue',jsonb_build_object('parent_id',legacyparent,'revision',imported->'revision','number',2,'receiver_id',own,'unit',100,'mode','balanced','remainder_member',own,'charges',pr->'charges'),gen_random_uuid());
 if (select count(*) from public.collection_payments where collection_id=any(legacy[2:3]) and installment_superseded_at is not null)<>15 then raise exception 'Old unpaid requests were not retired safely';end if;
 if (select sum(amount) from public.collection_payments where collection_id=any(legacy[2:3]))<>8449 then raise exception 'Retired payment history changed';end if;
 if (select sum(public.collection_bill_satang(x)) from unnest(legacy[2:3])x)<>0 then raise exception 'Retired unpaid requests retained a spendable bill basis';end if;
 begin perform public.trip_fund_action(tid,'expense',jsonb_build_object('collection_id',legacy[2],'custodian_id',own,'amount_satang',100,'title','ห้ามชดเชยซ้ำคำขอที่ยกยอดแล้ว'),gen_random_uuid());raise exception 'Fund paid retired request twice';exception when raise_exception then if sqlerrm='Fund paid retired request twice' then raise;end if;end;

 if (select available_satang from public.trip_fund_rounding(tid) where collection_id=legacy[1])<>600 then raise exception 'Attested old surplus not available';end if;
 if exists(select 1 from public.trip_fund_rounding(tid) where collection_id=any(legacy[2:3])) then raise exception 'Old incorrect cost basis created extra fund income';end if;
 -- A confirmed legacy 8,449 receipt pool can use exactly one baht of fund, despite the erroneous old 8,444 cost basis.
 legacy:=array[]::uuid[];
 for k in 1..3 loop
  insert into public.collections(trip_id,title,amount,original_amount,fund_remainder,is_fund,receiver_id,due_date,created_by)values(tid,'QA paid legacy '||k,case k when 1 then 8456 when 2 then 7322 else 1127 end,case k when 1 then 8450 when 2 then 7317.33 else 1126.67 end,0,false,own,current_date,own) returning id into cid;
  legacy:=array_append(legacy,cid);
  if k=1 then insert into public.collection_payments(collection_id,user_id,amount,status,received_amount,confirmed_at)select cid,u,604,'paid',604,now() from unnest(users[1:14])u;
  elsif k=2 then insert into public.collection_payments(collection_id,user_id,amount,status,received_amount,confirmed_at)select cid,u,523,'paid',523,now() from unnest(users[1:14])u;
  else insert into public.collection_payments(collection_id,user_id,amount,status,received_amount,confirmed_at)values(cid,mem,1127,'paid',1127,now());end if;
 end loop;
 payload:=jsonb_build_object('title','QA paid legacy reviewed','total_satang',1690000,'members',(select jsonb_agg(jsonb_build_object('user_id',u)) from unnest(users)u),'approved',true,'note','ตรวจบิลจริงและเงินรับครบขาดหนึ่งบาท','installments',jsonb_build_array(jsonb_build_object('title','มัดจำ','bill_satang',845000,'sources',jsonb_build_array(jsonb_build_object('collection_id',legacy[1],'bill_satang',845000))),jsonb_build_object('title','ยอดคงเหลือ','bill_satang',845000,'sources',jsonb_build_array(jsonb_build_object('collection_id',legacy[2],'bill_satang',732300),jsonb_build_object('collection_id',legacy[3],'bill_satang',112700)))));
 imported:=public.installment_expense_action(tid,'import',payload,gen_random_uuid());legacyparent:=(imported->>'expense_id')::uuid;
 fund_before:=public.trip_fund_balance(tid);perform public.trip_fund_action(tid,'rounding',jsonb_build_object('collection_id',legacy[1],'custodian_id',own,'amount_satang',600),gen_random_uuid());
 perform public.trip_fund_action(tid,'expense',jsonb_build_object('collection_id',legacy[2],'custodian_id',own,'amount_satang',100,'title','ชดเชยยอดขาดค่าที่พัก'),gen_random_uuid());
 if public.trip_fund_balance(tid)<>fund_before+500 or (select fund_paid_satang from public.expenses where id=legacyparent)<>0 then raise exception 'Fund shortfall duplicated trip cost';end if;
 select id into sid from public.trip_fund_transactions where trip_id=tid and collection_id=legacy[2] and type='expense';
 perform public.trip_fund_action(tid,'reverse',jsonb_build_object('transaction_id',sid,'note','ทดสอบกลับการชดเชยหนึ่งบาท'),gen_random_uuid());
 if public.trip_fund_balance(tid)<>fund_before+600 then raise exception 'Linked parent shortfall reversal failed';end if;
 -- Alternatively charge a chosen original member the missing baht, preserving all paid rows.
 select md5(jsonb_agg(to_jsonb(cp) order by user_id)::text) into oldhash from public.collection_payments cp where cp.collection_id=legacy[2];
 imported:=public.installment_expense_action(tid,'shortfall',jsonb_build_object('parent_id',legacyparent,'revision',imported->'revision','collection_id',legacy[2],'member_id',own,'amount_satang',100,'note','เลือกสมาชิกเดิมรับเศษเพิ่มหนึ่งบาท'),gen_random_uuid());
 select md5(jsonb_agg(to_jsonb(cp) order by user_id)::text) into newhash from public.collection_payments cp where cp.collection_id=legacy[2];
 if oldhash<>newhash or (select original_amount from public.collections where id=legacy[2])<>7317.33 then raise exception 'Supplement rewrote historical payment or cost';end if;
 select co.id into cid from public.collections co where co.installment_id=(select installment_id from public.collections where id=legacy[2]) and not(co.id=any(legacy));
 perform public.confirm_collection_received(cid,own,1);
 if (select sum(cp.received_amount)*100 from public.collection_payments cp join public.collections co on co.id=cp.collection_id join public.expense_installments ei on ei.id=co.installment_id where ei.parent_expense_id=legacyparent)<>1690600 then raise exception 'Supplement not completing 16906 collected';end if;
 if public.trip_fund_balance(tid)<>fund_before+600 then raise exception 'Supplement changed fund cash';end if;

 raise exception using errcode='PT002',message='rollback installment fixtures';
 exception when sqlstate 'PT002' then null;end;
 raise notice 'Installment expense regression passed; fixtures rolled back';
end $test$;
