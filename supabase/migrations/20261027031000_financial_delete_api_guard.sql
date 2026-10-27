begin;
-- All app deletion already uses delete_trip_item (permission check + seven-day trash).
-- Direct table deletion would bypass the recovery/audit workflow.
revoke delete on public.expenses,public.collections from authenticated;

-- Generated columns are recomputed, while the original receiving account snapshot is restored exactly.
CREATE OR REPLACE FUNCTION public.restore_trip_item(target_trash uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare saved public.trip_trash%rowtype;collection_columns text;
begin
  select q.* into saved from public.trip_trash q join public.trips t on t.id=q.trip_id
  where q.id=target_trash and q.expires_at>now() and t.owner_id=auth.uid();
  if not found then raise exception 'ไม่พบรายการกู้คืนหรือหมดอายุแล้ว'; end if;
  select string_agg(quote_ident(attname),',' order by attnum) into collection_columns from pg_attribute where attrelid='public.collections'::regclass and attnum>0 and not attisdropped and attgenerated='';
  perform set_config('tripmate.restore_collection_id',coalesce(case when saved.item_type='collection' then saved.payload->'record'->>'id' else saved.payload->'record'->'_receipt_collection'->>'id' end,''),true);
  if saved.item_type='stop' then
    insert into public.trip_stops select * from jsonb_populate_record(null::public.trip_stops,saved.payload->'record') on conflict(id) do nothing;
  elsif saved.item_type='expense' then
    insert into public.expenses select * from jsonb_populate_record(null::public.expenses,saved.payload->'record') on conflict(id) do nothing;
    insert into public.expense_participants select * from jsonb_populate_recordset(null::public.expense_participants,saved.payload->'children') on conflict do nothing;
  if saved.payload->'record'->'_receipt_collection' is not null and saved.payload->'record'->'_receipt_collection'<>'null'::jsonb then execute format('insert into public.collections(%1$s) select %1$s from jsonb_populate_record(null::public.collections,$1) on conflict(id) do nothing',collection_columns) using saved.payload->'record'->'_receipt_collection'; insert into public.collection_payments select * from jsonb_populate_recordset(null::public.collection_payments,saved.payload->'record'->'_receipt_collection'->'_payments') on conflict do nothing; end if; elsif saved.item_type='collection' then
    execute format('insert into public.collections(%1$s) select %1$s from jsonb_populate_record(null::public.collections,$1) on conflict(id) do nothing',collection_columns) using saved.payload->'record';
    insert into public.collection_payments select * from jsonb_populate_recordset(null::public.collection_payments,saved.payload->'children') on conflict do nothing;
  end if;
  insert into public.trip_activity_log(trip_id,actor_id,kind,message,entity_type,entity_id)
  values(saved.trip_id,auth.uid(),'restore','กู้คืน “'||saved.label||'”',saved.item_type,saved.item_id);
  delete from public.trip_trash where id=target_trash;
end; $function$;

CREATE OR REPLACE FUNCTION public.capture_collection_receiving_account()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.profiles;
begin
 if tg_op='INSERT' and current_setting('tripmate.restore_collection_id',true)=new.id::text then
  if not exists(select 1 from public.trips where id=new.trip_id and owner_id=auth.uid()) or not exists(
   select 1 from public.trip_trash q cross join lateral(values(q.payload->'record'),(q.payload->'record'->'_receipt_collection')) x(source)
   where q.trip_id=new.trip_id and q.expires_at>now() and x.source->>'id'=new.id::text and x.source->>'receiver_id'=new.receiver_id::text
   and (x.source->>'amount')::numeric=new.amount and nullif(x.source->'receiving_account_snapshot','null'::jsonb) is not distinct from new.receiving_account_snapshot
  )then raise exception 'ไม่พบ snapshot ต้นฉบับที่อนุญาตให้กู้คืน';end if;
  return new;
 end if;
 if tg_op='UPDATE' and new.is_fund is distinct from old.is_fund then raise exception 'ไม่สามารถเปลี่ยนประเภทรายการย้อนหลัง';end if;
 if not new.is_fund then
  if new.receiving_account_snapshot is not null then raise exception 'ไม่สามารถกำหนดบัญชีรับเงินเอง';end if;return new;
 end if;
 if tg_op='UPDATE' and new.receiver_id=old.receiver_id then
  if new.receiving_account_snapshot is distinct from old.receiving_account_snapshot or new.fund_account_label is distinct from old.fund_account_label then raise exception 'บัญชีรับเงินใช้ snapshot เดิมของรายการ';end if;return new;
 end if;
 if tg_op='UPDATE' and exists(select 1 from public.collection_payments where collection_id=old.id and (status<>'unpaid' or received_amount is not null or slip_url is not null)) then raise exception 'มีประวัติชำระแล้ว ไม่สามารถเปลี่ยนบัญชีรับเงิน';end if;
 select * into p from public.profiles where id=new.receiver_id;
 new.receiving_account_snapshot:=jsonb_build_object('receiver_id',p.id,'display_name',p.display_name,'account_name',p.account_name,'bank_name',p.bank_name,'promptpay_id',p.promptpay_id,'payment_qr_path',p.payment_qr_path,'captured_at',now());
 new.fund_account_label:=nullif(trim(coalesce(p.account_name,'')),'');
 -- Keep the referenced QR available to the existing retention process.
 update public.trip_file_retention set retain_until=greatest(retain_until,'9999-12-31'::timestamptz) where path=p.payment_qr_path;
 return new;
end $function$;

commit;
