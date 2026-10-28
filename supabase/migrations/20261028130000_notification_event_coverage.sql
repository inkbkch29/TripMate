begin;
create or replace function public.notify_trip_activity()
returns trigger language plpgsql security definer set search_path=public as $$
declare category text;typ text;
begin
 typ:=coalesce(new.entity_type,new.kind);
 category:=case when typ in('expense','expenses','trip_fund_transactions','vendor_payment')then 'expenses' when typ in('collection','collections','payment','collection_payments')then 'collections' when typ in('stop','trip_stops','plan')then 'trip_stops' else typ end;
 insert into public.user_notifications(recipient_id,trip_id,type,title,body,target,dedupe_key)
 select m.user_id,new.trip_id,typ,'TripMate',new.message,
 jsonb_build_object('entityType',typ,'entityId',new.entity_id,'actorName',coalesce(new.actor_name,(select display_name from public.profiles where id=new.actor_id)),'event',new.kind),'activity:'||new.id
 from public.trip_members m
 where m.trip_id=new.trip_id and m.user_id is distinct from new.actor_id
 and coalesce((select p.enabled from public.notification_preferences p where p.user_id=m.user_id and p.type=category),true)
 and (new.kind not in('payment_submitted','payment_confirmed') or
  new.kind='payment_submitted' and exists(select 1 from public.collections c where c.id=new.entity_id and(c.receiver_id=m.user_id or m.trip_role in('owner','treasurer')or m.can_confirm_payments)) or
  new.kind='payment_confirmed' and m.user_id=(new.details->>'member_id')::uuid)
 on conflict(recipient_id,dedupe_key)do nothing;
 return new;
end$$;
create function public.log_missing_financial_activity()returns trigger language plpgsql security definer set search_path=public as $$
declare tid uuid;entity uuid;typ text;event_name text;msg text;actor uuid;details jsonb:='{}';c public.collections;
begin
 if tg_table_name='trip_fund_transactions' then
  tid:=new.trip_id;entity:=new.id;typ:='trip_fund_transactions';event_name:='fund';actor:=new.recorded_by;
  msg:=case new.type when 'deposit'then 'รับเงินสมทบกองกลาง' when 'rounding'then 'นำส่วนเกินเข้ากองกลาง' when 'expense'then 'บันทึกจ่ายจากกองกลาง' when 'reversal'then 'กลับรายการกองกลาง' else 'อัปเดตกองกลาง' end||' · '||new.description;
 elsif tg_table_name='expense_installment_vendor_payments' then
  tid:=new.trip_id;actor:=new.recorded_by;typ:='expenses';event_name:='vendor_payment';
  select parent_expense_id into entity from public.expense_installments where id=new.installment_id;
  msg:=case when new.reversal_of is null then 'บันทึกจ่ายให้ร้าน'else 'กลับรายการจ่ายให้ร้าน'end;
 else
  if new.status not in('pending','paid')or tg_op='UPDATE' and new.status is not distinct from old.status then return new;end if;
  select * into c from public.collections where id=new.collection_id;if c.id is null then return new;end if;
  tid:=c.trip_id;entity:=c.id;actor:=auth.uid();typ:='collections';details:=jsonb_build_object('member_id',new.user_id);
  event_name:=case new.status when 'pending'then 'payment_submitted'else 'payment_confirmed'end;
  msg:=case new.status when 'pending'then 'มีสลิปรอตรวจ'else 'ยืนยันรับเงินแล้ว'end||' · '||c.title;
 end if;
 insert into public.trip_activity_log(trip_id,actor_id,actor_name,kind,message,entity_type,entity_id,details)
 values(tid,actor,(select display_name from public.profiles where id=actor),event_name,msg,typ,entity,details);
 return new;
end$$;
revoke all on function public.log_missing_financial_activity()from public,anon,authenticated;
create trigger log_fund_notification after insert on public.trip_fund_transactions for each row execute function public.log_missing_financial_activity();
create trigger log_vendor_notification after insert on public.expense_installment_vendor_payments for each row execute function public.log_missing_financial_activity();
create trigger log_payment_notification after insert or update on public.collection_payments for each row execute function public.log_missing_financial_activity();
commit;
