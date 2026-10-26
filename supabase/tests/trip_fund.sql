-- Executed inside the migration transaction. Fixture changes roll back via private SQLSTATE.
do $test$
declare tid uuid;own uuid;mem uuid;cid uuid;sid uuid;eid uuid;tx uuid;j jsonb;req uuid:=gen_random_uuid();base bigint;payload jsonb;balance bigint;expected bigint;
begin
 select id,owner_id into tid,own from public.trips where name='ทดสอบ' limit 1;
 select user_id into mem from public.trip_members where trip_id=tid and user_id<>own limit 1;
 if tid is null or mem is null then raise exception 'Requires authorized ทดสอบ trip with two members';end if;
 begin
 insert into public.trips(owner_id,name,start_date,end_date,status) values(own,'ทดสอบ · กองกลางชั่วคราว',current_date-3,current_date-1,'completed') returning id into tid;
 insert into public.trip_members(trip_id,user_id,trip_role) values(tid,own,'owner'),(tid,mem,'member');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',own,'role','authenticated')::text,true);
 base:=public.trip_fund_balance(tid);
 if exists(select 1 from public.trip_fund_settlements where trip_id=tid) then raise exception 'Test trip must have no fund settlements';end if;
 -- Exact satang and deterministic allocation, including unequal weights.
 if public.trip_fund_allocate(100,'{"b":1,"a":1,"c":1}')<>'{"a":34,"b":33,"c":33}'::jsonb then raise exception 'Allocation does not conserve satang';end if;
 payload:=jsonb_build_object('title','QA fund contributions','custodian_id',own,'account_label','QA test account','amounts',jsonb_build_object(own,50000,mem,65000));
 j:=public.trip_fund_action(tid,'contribution',payload,req);
 select id into cid from public.collections where trip_id=tid and fund_request_key=req;
 if (select count(*) from public.collection_payments where collection_id=cid and status='paid')<>0 or public.trip_fund_balance(tid)<>base then raise exception 'Request must not create cash or auto-pay receiver';end if;
 perform public.trip_fund_action(tid,'contribution',payload,req);
 if (select count(*) from public.collections where fund_request_key=req)<>1 then raise exception 'Duplicate request';end if;
 perform public.trip_fund_action(tid,'confirm_receipt',jsonb_build_object('collection_id',cid,'member_id',own,'amount_satang',50000),gen_random_uuid());
 perform public.trip_fund_action(tid,'confirm_receipt',jsonb_build_object('collection_id',cid,'member_id',mem,'amount_satang',65000),gen_random_uuid());
 perform public.trip_fund_action(tid,'confirm_receipt',jsonb_build_object('collection_id',cid,'member_id',mem,'amount_satang',65000),gen_random_uuid());
 if public.trip_fund_balance(tid)<>base+115000 then raise exception 'Confirmed contributions counted incorrectly';end if;
 begin perform public.trip_fund_action(tid,'expense',jsonb_build_object('title','too much','custodian_id',own,'amount_satang',999999999),gen_random_uuid());raise exception 'Overdraft accepted';exception when raise_exception then if sqlerrm='Overdraft accepted' then raise;end if;end;
 req:=gen_random_uuid();payload:=jsonb_build_object('title','QA paid meal','custodian_id',own,'amount_satang',112667);
 j:=public.trip_fund_action(tid,'expense',payload,req);perform public.trip_fund_action(tid,'expense',payload,req);
 select id,expense_id into tx,eid from public.trip_fund_transactions where source_key='expense:'||req;
 if public.trip_fund_balance(tid)<>base+2333 or (select fund_paid_satang from public.expenses where id=eid)<>112667 then raise exception 'Expense doubled or unsupported';end if;
 perform public.trip_fund_action(tid,'reverse',jsonb_build_object('transaction_id',tx,'note','QA correction confirmed'),gen_random_uuid());
 if public.trip_fund_balance(tid)<>base+115000 or (select fund_paid_satang from public.expenses where id=eid)<>0 then raise exception 'Reversal failed';end if;
 -- Partial funding of a prior expense reduces only the remaining shared amount.
 insert into public.expenses(trip_id,title,amount,paid_by,created_by,approval_status)values(tid,'QA partial bill',100,own,own,'approved') returning id into eid;
 insert into public.expense_participants(expense_id,user_id,share_amount)values(eid,own,50),(eid,mem,50);
 req:=gen_random_uuid();perform public.trip_fund_action(tid,'expense',jsonb_build_object('title','QA partial support','custodian_id',own,'amount_satang',3000,'expense_id',eid),req);
 if (select fund_paid_satang from public.expenses where id=eid)<>3000 then raise exception 'Partial fund payment not linked';end if;
 begin update public.expense_participants set share_amount=40 where expense_id=eid and user_id=mem;raise exception 'Funded shares editable';exception when raise_exception then if sqlerrm='Funded shares editable' then raise;end if;end;
 select id into tx from public.trip_fund_transactions where source_key='expense:'||req;
 perform public.trip_fund_action(tid,'reverse',jsonb_build_object('transaction_id',tx,'note','QA reverse partial support'),gen_random_uuid());
 -- A paid shortfall can be topped up exactly once without creating another expense.
 insert into public.collections(trip_id,title,amount,original_amount,fund_remainder,is_fund,receiver_id,due_date,created_by)values(tid,'QA shortfall',8449,8450,0,false,own,current_date,own) returning id into cid;
 insert into public.collection_payments(collection_id,user_id,amount,status)values(cid,own,4224.5,'unpaid'),(cid,mem,4224.5,'unpaid');
 perform public.confirm_collection_received(cid,own,4224.5);perform public.confirm_collection_received(cid,mem,4224.5);
 req:=gen_random_uuid();perform public.trip_fund_action(tid,'expense',jsonb_build_object('title','QA support shortfall','custodian_id',own,'amount_satang',100,'collection_id',cid),req);
 begin perform public.trip_fund_action(tid,'expense',jsonb_build_object('title','QA duplicate shortfall','custodian_id',own,'amount_satang',100,'collection_id',cid),gen_random_uuid());raise exception 'Shortfall deducted twice';exception when raise_exception then if sqlerrm='Shortfall deducted twice' then raise;end if;end;
 select id into tx from public.trip_fund_transactions where source_key='expense:'||req;
 perform public.trip_fund_action(tid,'reverse',jsonb_build_object('transaction_id',tx,'note','QA reverse shortfall support'),gen_random_uuid());
 -- A non-fund collection: all receipt cash known, no automatic surplus allocation.
 insert into public.collections(trip_id,title,amount,original_amount,fund_remainder,is_fund,receiver_id,due_date,created_by)values(tid,'QA rounding',1127,1126.67,.33,false,own,current_date,own) returning id into cid;
 insert into public.collection_payments(collection_id,user_id,amount,status) values(cid,own,563.50,'unpaid'),(cid,mem,563.50,'unpaid');
 perform public.confirm_collection_received(cid,own,563.50);
 if exists(select 1 from public.trip_fund_rounding(tid) where collection_id=cid) then raise exception 'Partial receipt produced available rounding';end if;
 perform public.confirm_collection_received(cid,mem,563.50);
 if public.trip_fund_balance(tid)<>base+115000 then raise exception 'Surplus transferred without confirmation';end if;
 perform public.trip_fund_action(tid,'rounding',jsonb_build_object('collection_id',cid,'custodian_id',own,'amount_satang',33),gen_random_uuid());
 if public.trip_fund_balance(tid)<>base+115033 then raise exception 'Wrong confirmed surplus';end if;
 begin perform public.trip_fund_action(tid,'rounding',jsonb_build_object('collection_id',cid,'custodian_id',own,'amount_satang',33),gen_random_uuid());raise exception 'Rounding duplicated';exception when raise_exception then if sqlerrm='Rounding duplicated' then raise;end if;end;
 select id into tx from public.trip_fund_transactions where trip_id=tid and type='rounding' limit 1;
 begin delete from public.trip_fund_transactions where id=tx;raise exception 'Ledger silently deleted';exception when raise_exception then if sqlerrm='Ledger silently deleted' then raise;end if;end;
 begin update public.collections set receiver_id=mem where id=cid;raise exception 'Posted receiver editable';exception when raise_exception then if sqlerrm='Posted receiver editable' then raise;end if;end;
 begin update public.collection_payments set received_amount=500 where collection_id=cid and user_id=mem;raise exception 'Allocated receipt editable';exception when raise_exception then if sqlerrm='Allocated receipt editable' then raise;end if;end;
 -- Ordinary member cannot write, direct-table clients have read-only access.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',mem,'role','authenticated')::text,true);
 begin perform public.trip_fund_action(tid,'expense','{}',gen_random_uuid());raise exception 'Member wrote ledger';exception when insufficient_privilege then null;end;
 if has_table_privilege('authenticated','public.trip_fund_transactions','INSERT') or has_table_privilege('authenticated','public.trip_fund_transactions','UPDATE') or has_table_privilege('authenticated','public.trip_fund_transactions','DELETE') then raise exception 'Ledger writable directly';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',own,'role','authenticated')::text,true);
 -- Move custody without changing income or total cash.
 perform public.trip_fund_action(tid,'transfer',jsonb_build_object('custodian_id',own,'to_custodian',mem,'amount_satang',100,'note','QA actual cash handover'),gen_random_uuid());
 if public.trip_fund_balance(tid)<>base+115033 or public.trip_fund_balance(tid,mem)<>100 then raise exception 'Custody transfer changed money';end if;
 perform public.trip_fund_action(tid,'transfer',jsonb_build_object('custodian_id',mem,'to_custodian',own,'amount_satang',100,'note','QA actual cash returned'),gen_random_uuid());
 update public.trips set status='completed',end_date=current_date-1 where id=tid;
 req:=gen_random_uuid();perform public.trip_fund_action(tid,'contribution',jsonb_build_object('title','QA unresolved historical flag','custodian_id',own,'account_label','QA account','amounts',jsonb_build_object(mem,1)),req);
 select id into cid from public.collections where fund_request_key=req;
 update public.collection_payments set status='paid',confirmed_at=now() where collection_id=cid;
 begin perform public.trip_fund_action(tid,'settlement',jsonb_build_object('custodian_id',own,'policy','equal','surplus_policy','equal','eligible',jsonb_build_object(own,true,mem,true)),gen_random_uuid());raise exception 'Unconfirmed cash silently settled';exception when raise_exception then if sqlerrm='Unconfirmed cash silently settled' then raise;end if;end;

 -- Legacy unresolved contributions require an explicit reconciliation note.
 j:=public.trip_fund_action(tid,'settlement',jsonb_build_object('custodian_id',own,'policy','equal','surplus_policy','equal','note','QA reconciled old test records','eligible',jsonb_build_object(own,true,mem,true)),gen_random_uuid());
 select id into sid from public.trip_fund_settlements where trip_id=tid and status='pending';
 if (select sum(amount_satang) from public.trip_fund_refunds where settlement_id=sid)<>public.trip_fund_balance(tid) then raise exception 'Refunds do not sum to balance';end if;
 for j in select to_jsonb(x) from public.trip_fund_refunds x where settlement_id=sid loop perform public.trip_fund_action(tid,'refund_confirm',jsonb_build_object('refund_id',j->>'id'),gen_random_uuid());end loop;
 if public.trip_fund_balance(tid)<>0 or (select status from public.trip_fund_settlements where id=sid)<>'completed' then raise exception 'Refund finalization failed';end if;
 select transaction_id into tx from public.trip_fund_refunds where settlement_id=sid order by id limit 1;
 perform public.trip_fund_action(tid,'reverse',jsonb_build_object('transaction_id',tx,'note','QA refund returned to custodian'),gen_random_uuid());
 if public.trip_fund_balance(tid)<=0 or (select status from public.trip_fund_settlements where id=sid)<>'pending' then raise exception 'Refund reversal not restored';end if;
 select id into tx from public.trip_fund_refunds where settlement_id=sid and status='pending';
 perform public.trip_fund_action(tid,'refund_confirm',jsonb_build_object('refund_id',tx),gen_random_uuid());
 if public.trip_fund_balance(tid)<>0 then raise exception 'Refund reissue duplicated';end if;
 -- Cancel a fully reversed refund plan and compare proportional surplus ownership.
 for j in select to_jsonb(x) from public.trip_fund_refunds x where settlement_id=sid and status='completed' loop
  perform public.trip_fund_action(tid,'reverse',jsonb_build_object('transaction_id',j->>'transaction_id','note','QA funds returned for policy test'),gen_random_uuid());
 end loop;
 perform public.trip_fund_action(tid,'settlement_cancel',jsonb_build_object('settlement_id',sid),gen_random_uuid());
 perform public.trip_fund_action(tid,'settlement',jsonb_build_object('custodian_id',own,'policy','proportional','surplus_policy','equal','note','QA approved equal surplus ownership'),gen_random_uuid());
 select id into sid from public.trip_fund_settlements where trip_id=tid and status='pending';
 if (select sum(amount_satang) from public.trip_fund_refunds where settlement_id=sid)<>115033 then raise exception 'Proportional refund lost satang';end if;
 if (select amount_satang from public.trip_fund_refunds where settlement_id=sid and member_id=own) not in (50016,50017) then raise exception 'Proportional refund policy ignored';end if;


 raise exception using errcode='PT001',message='rollback test fixtures';
 exception when sqlstate 'PT001' then null;end;
 raise notice 'Hybrid fund regression passed; all fixtures rolled back';
end $test$;
