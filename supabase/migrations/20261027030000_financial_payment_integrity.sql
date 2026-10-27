begin;
-- Check a new file reference against its trip before it can grant legacy storage access.
create function public.valid_trip_financial_attachment(tid uuid,file_path text,owned_upload boolean default false)returns boolean language plpgsql stable security definer set search_path=public as $$
declare object_owner text;begin
 if auth.uid() is null or not public.is_trip_member(tid) or nullif(trim(file_path),'') is null then return false;end if;
 select owner_id into object_owner from storage.objects where bucket_id='trip-files' and name=file_path;
 if not found or (owned_upload and object_owner is distinct from auth.uid()::text)then return false;end if;
 if split_part(file_path,'/',1)=tid::text then return true;end if;
 if exists(select 1 from public.trips where id::text=split_part(file_path,'/',1))then return false;end if;
 -- Existing legacy references and archived sources remain restorable, without guessing a new trip.
 return exists(select 1 from public.expenses where trip_id=tid and receipt_path=file_path)
 or exists(select 1 from public.collections c join public.collection_payments p on p.collection_id=c.id where c.trip_id=tid and p.slip_url=file_path)
 or exists(select 1 from public.trip_settlements where trip_id=tid and slip_path=file_path)
 or exists(select 1 from public.trip_trash t where t.trip_id=tid and (t.payload->'record'->>'receipt_path'=file_path or exists(select 1 from jsonb_array_elements(coalesce(t.payload->'children','[]'))p where p->>'slip_url'=file_path) or exists(select 1 from jsonb_array_elements(coalesce(t.payload->'record'->'_receipt_collection'->'_payments','[]'))p where p->>'slip_url'=file_path)));
end$$;
revoke all on function public.valid_trip_financial_attachment(uuid,text,boolean) from public,anon,authenticated;
create function public.validate_financial_attachment_reference()returns trigger language plpgsql security definer set search_path=public as $$
declare tid uuid;path text;previous_path text;begin
 if tg_table_name='expenses' then tid:=new.trip_id;path:=new.receipt_path;if tg_op='UPDATE'then previous_path:=old.receipt_path;end if;
 elsif tg_table_name='trip_settlements' then tid:=new.trip_id;path:=new.slip_path;if tg_op='UPDATE'then previous_path:=old.slip_path;end if;
 else select trip_id into tid from public.collections where id=new.collection_id;path:=new.slip_url;if tg_op='UPDATE'then previous_path:=old.slip_url;end if;end if;
 if path is null or (tg_op='UPDATE' and path is not distinct from previous_path)then return new;end if;
 if not public.valid_trip_financial_attachment(tid,path,false)then raise insufficient_privilege using message='ไฟล์แนบต้องเป็นไฟล์ที่อัปโหลดในทริปนี้';end if;return new;
end$$;
create trigger validate_expense_attachment before insert or update of receipt_path on public.expenses for each row execute function public.validate_financial_attachment_reference();
create trigger validate_collection_attachment before insert or update of slip_url on public.collection_payments for each row execute function public.validate_financial_attachment_reference();
create trigger validate_settlement_attachment before insert or update of slip_path on public.trip_settlements for each row execute function public.validate_financial_attachment_reference();
create function public.validate_profile_receiving_file()returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.payment_qr_path is null or (tg_op='UPDATE' and new.payment_qr_path is not distinct from old.payment_qr_path)then return new;end if;
 if new.id is distinct from auth.uid() or not exists(select 1 from storage.objects where bucket_id='trip-files' and name=new.payment_qr_path and owner_id=auth.uid()::text and (split_part(name,'/',1)=auth.uid()::text or (split_part(name,'/',2)=auth.uid()::text and exists(select 1 from public.trip_members where user_id=auth.uid() and trip_id::text=split_part(name,'/',1)))))then raise insufficient_privilege using message='ใช้รูป QR รับเงินที่คุณอัปโหลดเอง';end if;
 return new;
end$$;
create trigger validate_receiving_file before insert or update of payment_qr_path on public.profiles for each row execute function public.validate_profile_receiving_file();
-- Restrictive boundary also covers the old QR/profile/reference-based permissive policies.
create function public.trip_file_folder_readable(file_path text)returns boolean language sql stable security definer set search_path=public as $$select auth.uid() is not null and not exists(select 1 from public.trips where id::text=split_part(file_path,'/',1) and not public.is_trip_member(id))$$;
revoke all on function public.trip_file_folder_readable(text)from public,anon;grant execute on function public.trip_file_folder_readable(text)to authenticated;
create policy "financial files stay inside trip folder" on storage.objects as restrictive for select to authenticated using(bucket_id<>'trip-files' or public.trip_file_folder_readable(name));
-- A signed receipt must keep the same bytes after it becomes payment history.
create function public.trip_financial_file_locked(file_path text)returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.expenses where receipt_path=file_path)
 or exists(select 1 from public.collection_payments p join public.collections c on c.id=p.collection_id where p.slip_url=file_path and (split_part(file_path,'/',1)=c.trip_id::text or not exists(select 1 from public.trips where id::text=split_part(file_path,'/',1))))
 or exists(select 1 from public.trip_settlements where slip_path=file_path)
 or exists(select 1 from public.collections where receiving_account_snapshot->>'payment_qr_path'=file_path)
 or exists(select 1 from public.trip_trash t where t.payload->'record'->>'receipt_path'=file_path or exists(select 1 from jsonb_array_elements(coalesce(t.payload->'children','[]'))p where p->>'slip_url'=file_path) or exists(select 1 from jsonb_array_elements(coalesce(t.payload->'record'->'_receipt_collection'->'_payments','[]'))p where p->>'slip_url'=file_path));
$$;
revoke all on function public.trip_financial_file_locked(text)from public,anon;grant execute on function public.trip_financial_file_locked(text)to authenticated;
create policy "preserve referenced financial file bytes" on storage.objects as restrictive for update to authenticated using(bucket_id<>'trip-files' or not public.trip_financial_file_locked(name)) with check(bucket_id<>'trip-files' or not public.trip_financial_file_locked(name));
create policy "preserve referenced financial files" on storage.objects as restrictive for delete to authenticated using(bucket_id<>'trip-files' or not public.trip_financial_file_locked(name));
create or replace function public.submit_collection_payment(target_collection uuid,target_slip text,target_user uuid default null)returns void language plpgsql security definer set search_path=public as $$
declare paid_for uuid:=coalesce(target_user,auth.uid());item public.collection_payments;tid uuid;begin
 if auth.uid() is null then raise insufficient_privilege using message='กรุณาเข้าสู่ระบบก่อนแจ้งชำระ';end if;
 select trip_id into tid from public.collections where id=target_collection;
 if tid is null or not public.is_trip_member(tid)then raise insufficient_privilege using message='ไม่พบรายการชำระ หรือคุณไม่ได้อยู่ในทริปนี้';end if;
 select * into item from public.collection_payments where collection_id=target_collection and user_id=paid_for for update;
 if not found then raise exception 'ไม่พบรายชื่อผู้ชำระ';end if;
 if item.status='paid' then
  if item.slip_url is not distinct from target_slip then return;end if;
  raise exception 'ยืนยันรับเงินแล้ว ไม่สามารถส่งสลิปทับประวัติเดิม';
 end if;
 if item.status='pending' and item.submitted_by is distinct from auth.uid() then raise insufficient_privilege using message='มีสลิปรอตรวจจากสมาชิกอื่นแล้ว';end if;
 if not public.valid_trip_financial_attachment(tid,target_slip,true)then raise insufficient_privilege using message='ใช้สลิปที่คุณอัปโหลดในทริปนี้';end if;
 if item.status='pending' and item.slip_url is not distinct from target_slip and item.submitted_by=auth.uid()then return;end if;
 update public.collection_payments set status='pending',slip_url=target_slip,submitted_by=auth.uid(),confirmed_at=null where collection_id=target_collection and user_id=paid_for;
end$$;
-- Also protect direct payment writes: paid history cannot be downgraded or replaced.
create function public.preserve_confirmed_collection_payment()returns trigger language plpgsql as $$begin
 if current_setting('tripmate.installment_write',true)='yes' then return new;end if;
 if old.status='paid' and old.received_amount is not null and old.confirmed_at is not null and (new.status is distinct from old.status or new.slip_url is distinct from old.slip_url or new.submitted_by is distinct from old.submitted_by or new.received_amount is distinct from old.received_amount or new.confirmed_at is distinct from old.confirmed_at or new.amount is distinct from old.amount)then raise exception 'ยืนยันรับเงินแล้ว กรุณาใช้การกลับบัญชีหรือรายการใหม่เพื่อรักษาประวัติ';end if;return new;
end$$;
create trigger preserve_confirmed_payment before update on public.collection_payments for each row execute function public.preserve_confirmed_collection_payment();

-- Confirmation permission is independent from fund spending permission.
CREATE OR REPLACE FUNCTION public.trip_fund_receipt()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.collections;posted public.trip_fund_transactions;
begin
 select * into c from public.collections where id=coalesce(new.collection_id,old.collection_id);
 if c.id is null then return coalesce(new,old);end if;
 perform public.trip_fund_lock(c.trip_id);
 if not c.is_fund then
  if exists(select 1 from public.trip_fund_transactions where collection_id=c.id and type='rounding') and (tg_op='DELETE' or new.received_amount is distinct from old.received_amount or new.status is distinct from old.status or new.amount is distinct from old.amount) then raise exception 'จัดสรรส่วนเกินแล้ว ไม่สามารถแก้ประวัติรับเงิน';end if;
  return coalesce(new,old);end if;
 perform public.trip_fund_lock(c.trip_id);
 select * into posted from public.trip_fund_transactions where trip_id=c.trip_id and source_key='receipt:'||c.id||':'||coalesce(new.user_id,old.user_id);
 if posted.id is not null then
  if exists(select 1 from public.trip_fund_transactions where reversal_of=posted.id) then raise exception 'รายการรับนี้กลับบัญชีแล้ว กรุณาสร้างคำขอใหม่';end if;
  if tg_op='DELETE' or new.status<>'paid' or new.received_amount*100<>posted.amount_satang or new.received_amount is null or new.amount<>old.amount then raise exception 'มีบัญชีรับเงินแล้ว กรุณาใช้รายการกลับบัญชี';end if;
  return new;
 end if;
 if tg_op<>'DELETE' and new.status='paid' and new.received_amount>0 and new.confirmed_at is not null then
  if exists(select 1 from public.trip_fund_settlements where trip_id=c.trip_id and status<>'cancelled') then raise exception 'กองกลางกำลังปิดยอด กรุณายกเลิกแผนคืนเงินก่อน';end if;
  if not public.trip_finance_permission(c.trip_id,'confirm') and auth.uid()<>c.receiver_id then raise insufficient_privilege;end if;
  insert into public.trip_fund_transactions(trip_id,type,amount_satang,description,recorded_by,custodian_id,member_id,collection_id,source_key)
  values(c.trip_id,'deposit',(new.received_amount*100)::bigint,c.title,auth.uid(),c.receiver_id,new.user_id,c.id,'receipt:'||c.id||':'||new.user_id);
 end if;return coalesce(new,old);
end $function$;

revoke all on function public.validate_financial_attachment_reference(),public.validate_profile_receiving_file(),public.preserve_confirmed_collection_payment() from public,anon,authenticated;
commit;
