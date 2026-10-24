do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime' and not puballtables)
 and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='collection_payments') then
  alter publication supabase_realtime add table public.collection_payments;
 end if;
end $$;
