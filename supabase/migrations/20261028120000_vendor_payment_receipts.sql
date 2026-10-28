begin;
alter table public.expense_installment_vendor_payments add column receipt_attachments jsonb not null default '[]';
create function public.validate_vendor_receipts()returns trigger language plpgsql security definer set search_path=public as $$
declare item jsonb;seen text[]:='{}';p text;
begin
 if jsonb_typeof(new.receipt_attachments)<>'array' or jsonb_array_length(new.receipt_attachments)>10 then raise exception 'แนบได้สูงสุด 10 รูป';end if;
 for item in select value from jsonb_array_elements(new.receipt_attachments)loop
  p:=item->>'path';
  if p is null or p=any(seen) or item->>'type' not in('image/jpeg','image/png','image/webp') or item->>'type' is null or not public.valid_trip_financial_attachment(new.trip_id,p,false) then raise exception 'หลักฐานต้องเป็นรูปที่อัปโหลดในทริปนี้';end if;
  seen:=array_append(seen,p);
 end loop;return new;
end$$;
create trigger validate_vendor_receipts before insert on public.expense_installment_vendor_payments for each row execute function public.validate_vendor_receipts();
revoke all on function public.validate_vendor_receipts()from public,anon,authenticated;
do $$declare d text;old text;begin
 select pg_get_functiondef('public.installment_expense_action(uuid,text,jsonb,uuid)'::regprocedure)into d;
 old:=$old$insert into public.expense_installment_vendor_payments(trip_id,installment_id,amount_satang,paid_on,recorded_by,note)values(target_trip,i.id,value,coalesce(nullif(payload->>'date','')::date,current_date),auth.uid(),note);$old$;
 if position(old in d)=0 then raise exception 'Unexpected vendor payment function';end if;
 d:=replace(d,old,$new$insert into public.expense_installment_vendor_payments(trip_id,installment_id,amount_satang,paid_on,recorded_by,note,receipt_attachments)values(target_trip,i.id,value,coalesce(nullif(payload->>'date','')::date,current_date),auth.uid(),note,coalesce(payload->'receipt_attachments','[]'::jsonb));$new$);execute d;
 select pg_get_functiondef('public.trip_financial_file_locked(text)'::regprocedure)into d;
 d:=replace(d,'select exists(select 1 from public.expenses', 'select exists(select 1 from public.expense_installment_vendor_payments where receipt_attachments @> jsonb_build_array(jsonb_build_object(''path'',file_path))) or exists(select 1 from public.expenses');
 execute d;
end$$;
notify pgrst,'reload schema';
commit;
