do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime' and not puballtables)
 and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='trip_settlements') then
  alter publication supabase_realtime add table public.trip_settlements;
 end if;
end $$;
