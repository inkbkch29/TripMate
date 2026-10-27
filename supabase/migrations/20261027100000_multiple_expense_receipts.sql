begin;
alter table public.expenses add column if not exists receipt_attachments jsonb not null default '[]'::jsonb;

-- Extend the existing atomic save, preserving all financial/concurrency guards.
do $$declare definition text;original text;begin
 select pg_get_functiondef('public.save_expense_with_shares(jsonb,uuid[],numeric[],integer)'::regprocedure) into original;
 definition:=replace(original,'approval_status,receipt_path,receipt_breakdown)','approval_status,receipt_path,receipt_breakdown,receipt_attachments)');
 definition:=replace(definition,$old$nullif(payload->'receipt_breakdown','null'::jsonb)) returning$old$,$new$nullif(payload->'receipt_breakdown','null'::jsonb),coalesce(nullif(payload->'receipt_attachments','null'::jsonb),'[]'::jsonb)) returning$new$);
 definition:=replace(definition,$old$receipt_breakdown=nullif(payload->'receipt_breakdown','null'::jsonb)$old$,$new$receipt_breakdown=nullif(payload->'receipt_breakdown','null'::jsonb),receipt_attachments=coalesce(nullif(payload->'receipt_attachments','null'::jsonb),receipt_attachments)$new$);
 if definition=original or position('receipt_attachments=coalesce' in definition)=0 or position('receipt_breakdown,receipt_attachments)' in definition)=0 then raise exception 'Unexpected expense save definition';end if;
 execute definition;
end$$;

create function public.validate_expense_receipts() returns trigger language plpgsql security definer set search_path=public as $$
declare item jsonb;file_path text;seen text[]:='{}';previous jsonb:='[]';begin
 new.receipt_attachments:=coalesce(new.receipt_attachments,'[]'::jsonb);
 if jsonb_typeof(new.receipt_attachments)<>'array' then raise exception 'รายการบิลแนบไม่ถูกต้อง';end if;
 if jsonb_array_length(new.receipt_attachments)>10 then raise exception 'แนบได้สูงสุด 10 ไฟล์ต่อรายจ่าย';end if;
 if tg_op='UPDATE' then previous:=coalesce(old.receipt_attachments,'[]');end if;
 for item in select value from jsonb_array_elements(new.receipt_attachments) loop
  file_path:=item->>'path';
  if jsonb_typeof(item)<>'object' or nullif(file_path,'') is null or length(coalesce(item->>'name',''))>160 or item?'url'
    or coalesce(item->>'type','') not in ('image/jpeg','image/png','image/webp','application/pdf')
    or file_path=any(seen) then raise exception 'รายการบิลแนบไม่ถูกต้อง';end if;
  seen:=array_append(seen,file_path);
  if not(previous @> jsonb_build_array(jsonb_build_object('path',file_path)))
    and not public.valid_trip_financial_attachment(new.trip_id,file_path,false)then raise insufficient_privilege using message='บิลต้องเป็นไฟล์ที่อัปโหลดในทริปนี้';end if;
 end loop;
 if new.receipt_path is not null and not(new.receipt_path=any(seen))and cardinality(seen)>=10 then raise exception 'แนบได้สูงสุด 10 ไฟล์ต่อรายจ่าย';end if;
 return new;
end$$;
create trigger validate_expense_receipts before insert or update of receipt_attachments,receipt_path on public.expenses for each row execute function public.validate_expense_receipts();

-- Existing storage policies now protect every receipt, including recoverable trash.
create or replace function public.trip_financial_file_locked(file_path text)returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.expenses where receipt_path=file_path or receipt_attachments @> jsonb_build_array(jsonb_build_object('path',file_path)))
 or exists(select 1 from public.collection_payments p join public.collections c on c.id=p.collection_id where p.slip_url=file_path and (split_part(file_path,'/',1)=c.trip_id::text or not exists(select 1 from public.trips where id::text=split_part(file_path,'/',1))))
 or exists(select 1 from public.trip_settlements where slip_path=file_path)
 or exists(select 1 from public.collections where receiving_account_snapshot->>'payment_qr_path'=file_path)
 or exists(select 1 from public.trip_trash t where t.payload->'record'->>'receipt_path'=file_path
  or t.payload->'record'->'receipt_attachments' @> jsonb_build_array(jsonb_build_object('path',file_path))
  or exists(select 1 from jsonb_array_elements(coalesce(t.payload->'children','[]'))p where p->>'slip_url'=file_path)
  or exists(select 1 from jsonb_array_elements(coalesce(t.payload->'record'->'_receipt_collection'->'_payments','[]'))p where p->>'slip_url'=file_path));
$$;
-- Recognize already-linked legacy files when restoring an expense from trash.
do $$declare definition text;begin
 select pg_get_functiondef('public.valid_trip_financial_attachment(uuid,text,boolean)'::regprocedure) into definition;
 definition:=replace(definition,'trip_id=tid and receipt_path=file_path','trip_id=tid and (receipt_path=file_path or receipt_attachments @> jsonb_build_array(jsonb_build_object(''path'',file_path)))');
 definition:=replace(definition,$old$t.payload->'record'->>'receipt_path'=file_path or exists$old$,$new$t.payload->'record'->>'receipt_path'=file_path or t.payload->'record'->'receipt_attachments' @> jsonb_build_array(jsonb_build_object('path',file_path)) or exists$new$);
 execute definition;
end$$;
notify pgrst,'reload schema';
commit;
