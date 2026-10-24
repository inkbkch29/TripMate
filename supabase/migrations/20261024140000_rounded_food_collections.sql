begin;
alter table public.collections add column if not exists expense_id uuid unique references public.expenses(id) on delete cascade;
alter table public.collections add column if not exists fund_shares jsonb;

create or replace function public.sync_receipt_collection(target_expense uuid)
returns void language plpgsql security definer set search_path=public as $$
declare e public.expenses; previous public.collections; due_total numeric; cost_total numeric; charges jsonb; funds jsonb; p record;
begin
 select * into e from public.expenses where id=target_expense for update;
 if e.id is null then return; end if;
 if not public.is_trip_member(e.trip_id) or not exists(select 1 from public.trips t left join public.trip_members m on m.trip_id=t.id and m.user_id=auth.uid() where t.id=e.trip_id and (e.created_by=auth.uid() or t.owner_id=auth.uid() or m.trip_role='treasurer')) then raise exception 'Not allowed to manage this receipt'; end if;
 select * into previous from public.collections where expense_id=e.id for update;
 if e.receipt_breakdown->>'roundUp' is distinct from 'true' or e.approval_status<>'approved' then
  if previous.id is not null then
   if exists(select 1 from public.collection_payments where collection_id=previous.id and (slip_url is not null or (user_id<>previous.receiver_id and status in ('pending','paid')))) then raise exception 'มีการชำระบิลนี้แล้ว ไม่สามารถเปลี่ยนวิธีหารหรือยกเลิกการอนุมัติ'; end if;
   delete from public.collections where id=previous.id;
  end if;
  return;
 end if;
 select sum(share_amount),sum(ceil(share_amount)),jsonb_object_agg(user_id::text,ceil(share_amount)),jsonb_object_agg(user_id::text,ceil(share_amount)-share_amount) into cost_total,due_total,charges,funds from public.expense_participants where expense_id=e.id;
 if cost_total is null or cost_total<>e.amount then raise exception 'Receipt shares do not match the actual bill'; end if;
 if previous.id is null then
  insert into public.collections(id,trip_id,title,amount,original_amount,fund_remainder,is_fund,receiver_id,due_date,created_by,expense_id,fund_shares)
  values(e.id,e.trip_id,e.title,due_total,e.amount,due_total-e.amount,false,e.paid_by,e.expense_date,e.created_by,e.id,funds) returning * into previous;
 else
  if previous.receiver_id<>e.paid_by then raise exception 'บิลนี้มีรายการเรียกเก็บแล้ว ไม่สามารถเปลี่ยนผู้รับเงิน'; end if;
  if exists(select 1 from public.collection_payments where collection_id=previous.id and (slip_url is not null or (user_id<>previous.receiver_id and status in ('pending','paid')))) and (previous.original_amount<>e.amount or previous.fund_shares is distinct from funds or charges is distinct from (select jsonb_object_agg(user_id::text,amount) from public.collection_payments where collection_id=previous.id)) then raise exception 'มีการชำระหรือส่งสลิปแล้ว ไม่สามารถแก้ยอดหรือเปลี่ยนคนหาร'; end if;
  update public.collections set title=e.title,amount=due_total,original_amount=e.amount,fund_remainder=due_total-e.amount,fund_shares=funds,due_date=e.expense_date where id=previous.id;
 end if;
 delete from public.collection_payments where collection_id=previous.id and user_id not in(select user_id from public.expense_participants where expense_id=e.id);
 for p in select user_id,ceil(share_amount) as amount from public.expense_participants where expense_id=e.id loop
  insert into public.collection_payments(collection_id,user_id,amount,status,confirmed_at)
  values(previous.id,p.user_id,p.amount,case when p.user_id=e.paid_by or p.amount=0 then 'paid' else 'unpaid' end,case when p.user_id=e.paid_by or p.amount=0 then now() else null end)
  on conflict(collection_id,user_id) do update set amount=excluded.amount;
 end loop;
end $$;
revoke all on function public.sync_receipt_collection(uuid) from public;
grant execute on function public.sync_receipt_collection(uuid) to authenticated;

create or replace function public.sync_receipt_after_review()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform public.sync_receipt_collection(new.id);return new;
end $$;
revoke all on function public.sync_receipt_after_review() from public;
drop trigger if exists sync_receipt_review on public.expenses;
create trigger sync_receipt_review after update of approval_status on public.expenses for each row when(old.approval_status is distinct from new.approval_status) execute function public.sync_receipt_after_review();

do $$
declare definition text;
begin
 definition=pg_get_functiondef('public.save_expense_with_shares(jsonb,uuid[],numeric[],integer)'::regprocedure);
 if position('perform public.sync_receipt_collection' in definition)=0 then
  if position('perform public.replace_expense_participants(saved.id,participant_ids,share_amounts);' in definition)=0 then raise exception 'Unexpected expense save function'; end if;
  definition=replace(definition,'perform public.replace_expense_participants(saved.id,participant_ids,share_amounts);','perform public.replace_expense_participants(saved.id,participant_ids,share_amounts); perform public.sync_receipt_collection(saved.id);');
  -- A bill previously settled through the general balance must not be charged again.
  definition=replace(definition,'if expected_revision is null then', $guard$if expected_revision is not null and payload->'receipt_breakdown'->>'roundUp'='true' and exists(select 1 from public.expenses x where x.id=(payload->>'id')::uuid and x.approval_status='approved' and x.receipt_breakdown->>'roundUp' is distinct from 'true') and exists(select 1 from public.trip_settlements where trip_id=target_trip and status='confirmed') then raise exception 'มีประวัติปิดยอดแล้ว ไม่สามารถเปลี่ยนบิลเก่าเป็นวิธีเรียกเก็บใหม่'; end if; if expected_revision is null then$guard$);
  execute definition;
 end if;
end $$;

-- Trash keeps the expense, its rounding collection and every original slip together.
do $$
declare definition text;
begin
 definition=pg_get_functiondef('public.delete_trip_item(uuid,text,uuid)'::regprocedure);
 if position('_receipt_collection' in definition)=0 then
  if position('delete from public.trip_trash where expires_at<now();' in definition)=0 then raise exception 'Unexpected trash function'; end if;
  definition=replace(definition,'delete from public.trip_trash where expires_at<now();',$snapshot$if target_type='expense' then item=item||jsonb_build_object('_receipt_collection',(select to_jsonb(c)||jsonb_build_object('_payments',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.collection_payments p where p.collection_id=c.id)) from public.collections c where c.expense_id=target_id)); elsif target_type='collection' and exists(select 1 from public.collections where id=target_id and expense_id is not null) then perform public.delete_trip_item(target_trip,'expense',(select expense_id from public.collections where id=target_id)); return; end if; delete from public.trip_trash where expires_at<now();$snapshot$);
  execute definition;
 end if;
 definition=pg_get_functiondef('public.restore_trip_item(uuid)'::regprocedure);
 if position('_receipt_collection' in definition)=0 then
  if position('elsif saved.item_type=''collection'' then' in definition)=0 then raise exception 'Unexpected restore function'; end if;
  definition=replace(definition,'elsif saved.item_type=''collection'' then',$restore$if saved.payload->'record'->'_receipt_collection' is not null and saved.payload->'record'->'_receipt_collection'<>'null'::jsonb then insert into public.collections select * from jsonb_populate_record(null::public.collections,saved.payload->'record'->'_receipt_collection') on conflict(id) do nothing; insert into public.collection_payments select * from jsonb_populate_recordset(null::public.collection_payments,saved.payload->'record'->'_receipt_collection'->'_payments') on conflict do nothing; end if; elsif saved.item_type='collection' then$restore$);
  execute definition;
 end if;
end $$;
commit;
