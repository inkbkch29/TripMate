-- Publish live location changes so trip members receive updates immediately.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='live_locations'
  ) then
    alter publication supabase_realtime add table public.live_locations;
  end if;
end $$;

-- Remove stale rows periodically from a scheduled job if the project later enables pg_cron.
create index if not exists live_locations_updated_at_idx on public.live_locations(updated_at);
