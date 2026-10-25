-- Qualify the storage object's name: unqualified name inside the subquery
-- resolves to trips.name and rejects legitimate uploads by the trip owner.
begin;
alter policy "owners upload trip covers" on storage.objects
with check (
  bucket_id = 'trip-covers'
  and exists (
    select 1 from public.trips t
    where t.id::text = (storage.foldername(storage.objects.name))[1]
      and t.owner_id = auth.uid()
  )
);
alter policy "owners update trip covers" on storage.objects
using (
  bucket_id = 'trip-covers'
  and exists (
    select 1 from public.trips t
    where t.id::text = (storage.foldername(storage.objects.name))[1]
      and t.owner_id = auth.uid()
  )
)
with check (
  bucket_id = 'trip-covers'
  and exists (
    select 1 from public.trips t
    where t.id::text = (storage.foldername(storage.objects.name))[1]
      and t.owner_id = auth.uid()
  )
);
alter policy "owners delete trip covers" on storage.objects
using (
  bucket_id = 'trip-covers'
  and exists (
    select 1 from public.trips t
    where t.id::text = (storage.foldername(storage.objects.name))[1]
      and t.owner_id = auth.uid()
  )
);
commit;
