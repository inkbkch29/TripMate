begin;
-- Reuse collections, their composite payment key and the existing profile receiving settings.
alter table public.collections add column collection_type text generated always as (case when is_fund then 'TRIP_FUND_CONTRIBUTION' else 'EXPENSE' end) stored;
alter table public.collections add column receiving_account_snapshot jsonb;
alter table public.trip_fund_transactions add column receiving_account_snapshot jsonb;
alter table public.trip_fund_transactions add column payment_collection_id uuid;
alter table public.trip_fund_transactions add column payment_user_id uuid;
alter table public.trip_fund_transactions add constraint fund_payment_origin foreign key(payment_collection_id,payment_user_id) references public.collection_payments(collection_id,user_id);

create function public.capture_collection_receiving_account() returns trigger language plpgsql security definer set search_path=public as $$
declare p public.profiles;
begin
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
end $$;
create trigger capture_collection_receiving_account before insert or update on public.collections for each row execute function public.capture_collection_receiving_account();

create function public.capture_fund_payment_origin() returns trigger language plpgsql security definer set search_path=public as $$
declare c public.collections;origin public.trip_fund_transactions;
begin
 if new.reversal_of is not null then
  select * into origin from public.trip_fund_transactions where id=new.reversal_of;
  new.receiving_account_snapshot:=origin.receiving_account_snapshot;new.payment_collection_id:=origin.payment_collection_id;new.payment_user_id:=origin.payment_user_id;
 elsif new.collection_id is not null then
  select * into c from public.collections where id=new.collection_id;
  new.receiving_account_snapshot:=c.receiving_account_snapshot;
  if new.type='deposit' then new.payment_collection_id:=new.collection_id;new.payment_user_id:=new.member_id;end if;
 end if;return new;
end $$;
create trigger capture_fund_payment_origin before insert on public.trip_fund_transactions for each row execute function public.capture_fund_payment_origin();

-- Keep the existing permission, cash receipt, lock, unique-source and idempotency code.
-- Only derive receiving settings server-side and let the shared collection form supply its stable ID.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.trip_fund_action(uuid,text,jsonb,uuid)'::regprocedure);
 if position('if trim(coalesce(payload->>''account_label'',''''))='''' then raise exception ''ระบุบัญชีรับเงินจริง'';end if;' in definition)=0 then raise exception 'Unexpected fund contribution function';end if;
 definition:=replace(definition,'if trim(coalesce(payload->>''account_label'',''''))='''' then raise exception ''ระบุบัญชีรับเงินจริง'';end if;','-- Receiving settings are captured by the collection trigger.');
 definition:=replace(definition,'insert into public.collections(trip_id,title,amount,original_amount,fund_remainder,is_fund,receiver_id,due_date,created_by,fund_request_key,fund_account_label)','insert into public.collections(id,trip_id,title,amount,original_amount,fund_remainder,is_fund,receiver_id,due_date,created_by,fund_request_key,fund_account_label)');
 definition:=replace(definition,'values(target_trip,payload->>''title'',total/100.0,total/100.0,total/100.0,true,holder,','values(coalesce((payload->>''collection_id'')::uuid,gen_random_uuid()),target_trip,payload->>''title'',total/100.0,total/100.0,total/100.0,true,holder,');
 execute definition;
end $$;

-- Old QR paths remain accessible only to members of the trip that references them.
create function public.can_read_collection_qr(file_path text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.collections c where c.receiving_account_snapshot->>'payment_qr_path'=file_path and public.is_trip_member(c.trip_id));
$$;
revoke all on function public.capture_collection_receiving_account(),public.capture_fund_payment_origin(),public.can_read_collection_qr(text) from public,anon,authenticated;
grant execute on function public.can_read_collection_qr(text) to authenticated;
create policy "trip members read collection receiving QR" on storage.objects for select to authenticated using(bucket_id='trip-files' and public.can_read_collection_qr(name));
commit;
