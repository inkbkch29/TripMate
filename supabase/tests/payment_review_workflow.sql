-- Isolated workflow fixture. Requires the financial migrations through 20261101170000.
-- Uses synthetic identities; everything, including helpers, rolls back.
begin;
create function pg_temp.check_ok(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end$$;
create function pg_temp.denied(statement text,fragment text) returns void language plpgsql as $$
begin
 begin execute statement;exception when others then
  if position(fragment in sqlerrm)>0 then raise notice 'PASS: blocked %',fragment;return;end if;
  raise;
 end;
 raise exception 'FAIL: unexpectedly accepted %',statement;
end$$;
create function pg_temp.actor(id uuid)returns void language plpgsql as $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated')::text,true);end$$;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();tid uuid;cid uuid:=gen_random_uuid();fund uuid:=gen_random_uuid();sid uuid;s2 uuid;slip1 text;slip2 text;own_slip text;before_row jsonb;
begin
 insert into auth.users(id)values(a),(b),(c),(outsider);
 insert into public.profiles(id,display_name)values(a,'QA receiver'),(b,'QA debtor'),(c,'QA proxy'),(outsider,'QA outsider');
 insert into public.trips(name,owner_id,start_date,end_date,status)values('QA money lifecycle rollback',a,current_date,current_date+1,'planning')returning id into tid;
 insert into public.trip_members(trip_id,user_id,trip_role,can_confirm_payments)values(tid,a,'owner',true),(tid,b,'member',false),(tid,c,'member',false);
 slip1:=tid||'/'||c||'/wrong.png';slip2:=tid||'/'||c||'/correct.png';own_slip:=tid||'/'||b||'/own.png';
 insert into storage.objects(bucket_id,name,owner_id)values('trip-files',slip1,c::text),('trip-files',slip2,c::text),('trip-files',own_slip,b::text);
 perform pg_temp.check_ok(not has_function_privilege('anon','public.reject_collection_payment(uuid,uuid,text,text)','execute'),'anonymous cannot reject collection payments');
 perform pg_temp.check_ok(not has_function_privilege('anon','public.submit_settlement_for_member(uuid,uuid,numeric,text,uuid)','execute'),'anonymous cannot submit proxy settlements');
 perform pg_temp.actor(c);
 perform public.save_collection_request(tid,cid,jsonb_build_object('title','Request only','receiver_id',a,'amounts',jsonb_build_object(b,10000)));
 perform public.save_collection_request(tid,cid,jsonb_build_object('title','Creator edit','receiver_id',a,'amounts',jsonb_build_object(b,12000)));
 perform pg_temp.check_ok((select amount=120 and collection_only and not is_fund from public.collections where id=cid),'creator edits unpaid request, not an expense');
 perform pg_temp.actor(b);
 perform pg_temp.denied(format('select public.save_collection_request(%L,%L,%L::jsonb)',tid,cid,jsonb_build_object('title','unauthorized','receiver_id',a,'amounts',jsonb_build_object(b,12000))),'ไม่มีสิทธิ์แก้');
 perform public.submit_collection_payment(cid,own_slip);
 perform pg_temp.actor(c);
 perform pg_temp.denied(format('select public.submit_collection_payment(%L,%L,%L)',cid,slip1,b),'มีสลิปรอตรวจ');
 perform pg_temp.denied(format('select public.reject_collection_payment(%L,%L,%L,%L)',cid,b,own_slip,'wrong'),'เฉพาะผู้รับเงิน');
 perform pg_temp.actor(a);
 perform public.reject_collection_payment(cid,b,own_slip,'wrong amount');
 perform public.reject_collection_payment(cid,b,own_slip,'wrong amount');
 perform pg_temp.check_ok((select status='unpaid' and rejection_reason='wrong amount' and slip_url=own_slip from public.collection_payments where collection_id=cid and user_id=b),'reject preserves slip, reason and debt; retry is harmless');
 perform pg_temp.actor(c);
 perform public.submit_collection_payment(cid,slip2,b);
 perform public.submit_collection_payment(cid,slip2,b);
 perform pg_temp.check_ok((select status='pending' and submitted_by=c and rejection_reason is null and rejected_at is null from public.collection_payments where collection_id=cid and user_id=b),'proxy resubmits corrected slip for original debtor, clears rejection');
 perform pg_temp.check_ok(public.trip_fund_balance(tid)=0,'pending request is not fund cash');
 perform pg_temp.actor(a);
 perform pg_temp.denied(format('select public.reject_collection_payment(%L,%L,%L,%L)',cid,b,own_slip,'stale tab'),'สถานะหรือสลิปเปลี่ยนแล้ว');
 perform public.confirm_collection_received(cid,b,120);
 perform public.confirm_collection_received(cid,b,120);
 perform pg_temp.check_ok((select status='paid' and received_amount=120 and submitted_by=c from public.collection_payments where collection_id=cid and user_id=b),'receiver confirms original debtor exactly once');
 perform pg_temp.check_ok(public.trip_fund_balance(tid)=0,'request-only receipt does not credit fund');
 perform pg_temp.denied(format('select public.reject_collection_payment(%L,%L,%L,%L)',cid,b,slip2,'late reject'),'สถานะหรือสลิปเปลี่ยนแล้ว');
 perform pg_temp.actor(b);
 perform pg_temp.denied(format('select public.submit_collection_payment(%L::uuid,%L::text)',cid,own_slip),'ยืนยันรับเงินแล้ว');
 perform pg_temp.actor(c);
 perform pg_temp.denied(format('select public.submit_collection_payment(%L,%L,%L)',cid,slip1,b),'ยืนยันรับเงินแล้ว');
 perform pg_temp.denied(format('select public.save_collection_request(%L,%L,%L::jsonb)',tid,cid,jsonb_build_object('title','change paid','receiver_id',a,'amounts',jsonb_build_object(b,13000))),'รายการนี้มีการชำระ');
 -- Real fund receipt trigger: pending/rejected never become cash, confirmed retry posts once.
 insert into public.collections(id,trip_id,title,amount,original_amount,is_fund,fund_remainder,receiver_id,created_by)values(fund,tid,'QA fund',100,100,true,100,a,a);
 insert into public.collection_payments(collection_id,user_id,amount)values(fund,b,100);
 perform public.submit_collection_payment(fund,slip1,b);
 perform pg_temp.actor(a);perform public.reject_collection_payment(fund,b,slip1,'wrong slip');
 perform pg_temp.check_ok(public.trip_fund_balance(tid)=0,'rejected fund slip does not credit cash');
 perform pg_temp.actor(c);perform public.submit_collection_payment(fund,slip2,b);
 perform pg_temp.actor(a);perform public.confirm_collection_received(fund,b,100);perform public.confirm_collection_received(fund,b,100);
 perform pg_temp.check_ok(public.trip_fund_balance(tid)=10000 and (select count(*)=1 from public.trip_fund_transactions where collection_id=fund),'fund receipt credited once after confirmation');
 -- Settlement lifecycle: reject -> resubmit by friend -> confirm -> immutable.
 perform pg_temp.actor(c);sid:=public.submit_settlement_for_member(tid,a,75,slip1,b);
 perform pg_temp.check_ok(public.submit_settlement_for_member(tid,a,75,slip1,b)=sid,'settlement retry idempotent');
 perform pg_temp.actor(b);
 perform pg_temp.denied(format('select public.review_settlement(%L,%L)',sid,'confirmed'),'ไม่มีสิทธิ์');
 perform pg_temp.actor(a);perform public.review_settlement(sid,'rejected');
 perform pg_temp.denied(format('select public.review_settlement(%L,%L)',sid,'confirmed'),'ส่งสลิปใหม่');
 perform pg_temp.actor(c);s2:=public.submit_settlement_for_member(tid,a,75,slip2,b);
 perform pg_temp.check_ok(s2=sid,'rejected settlement retry reuses only active record');
 perform pg_temp.actor(a);perform public.review_settlement(sid,'confirmed');select to_jsonb(s) into before_row from public.trip_settlements s where id=sid;
 perform public.review_settlement(sid,'confirmed');
 perform pg_temp.check_ok((select to_jsonb(s)=before_row from public.trip_settlements s where id=sid),'repeated confirmation keeps original timestamp and reviewer');
 perform pg_temp.denied(format('select public.review_settlement(%L,%L)',sid,'rejected'),'ยืนยันรับเงินแล้ว');
 perform pg_temp.denied(format('update public.trip_settlements set amount=76 where id=%L',sid),'ยืนยันรับเงินแล้ว');
 perform pg_temp.denied(format('update public.trip_settlements set from_user=%L where id=%L',c,sid),'ยืนยันรับเงินแล้ว');
 perform pg_temp.actor(c);s2:=public.submit_settlement_for_member(tid,a,20,slip1,b);
 perform pg_temp.check_ok(s2<>sid and (select status='confirmed' and from_user=b and submitted_by=c from public.trip_settlements where id=sid),'later settlement preserves confirmed history and actor');
 perform pg_temp.denied(format('select public.submit_settlement_for_member(%L,%L,21,%L,%L)',tid,a,slip2,b),'มีสลิปรอตรวจ');
 perform pg_temp.actor(outsider);
 perform pg_temp.denied(format('select public.submit_settlement_for_member(%L,%L,1,%L,%L)',tid,a,slip2,b),'สมาชิกทริป');
 perform pg_temp.denied(format('select public.reject_collection_payment(%L,%L,%L,%L)',cid,b,slip2,'outside'),'เฉพาะผู้รับเงิน');
 perform pg_temp.actor(b);
 perform pg_temp.denied(format('select public.submit_settlement_for_member(%L,%L,1,%L,%L)',tid,a,slip2,b),'คุณอัปโหลด');
 -- Independent confirm permission, not only owner/receiver.
 update public.trip_members set can_confirm_payments=true where trip_id=tid and user_id=c;
 perform pg_temp.actor(c);perform public.review_settlement(s2,'confirmed');
 perform pg_temp.check_ok((select confirmed_by=c from public.trip_settlements where id=s2),'explicit confirmation permission works');
end$$;
rollback;
