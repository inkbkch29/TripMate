-- Add per-member bank QR details to an existing TripMate project.
alter table public.profiles add column if not exists bank_name text;
alter table public.profiles add column if not exists account_name text;
alter table public.profiles add column if not exists payment_qr_path text;

drop policy if exists "users upload own trip files" on storage.objects;
create policy "users upload own trip files" on storage.objects
for insert to authenticated
with check (bucket_id='trip-files' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "users update own trip files" on storage.objects;
create policy "users update own trip files" on storage.objects
for update to authenticated
using (bucket_id='trip-files' and owner_id=auth.uid()::text);
