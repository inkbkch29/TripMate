-- Optimistic concurrency metadata for edits replayed from offline devices.
alter table public.trip_stops add column if not exists updated_at timestamptz not null default now();
alter table public.trip_stops add column if not exists revision integer not null default 1;
alter table public.expenses add column if not exists updated_at timestamptz not null default now();
alter table public.expenses add column if not exists revision integer not null default 1;

create or replace function public.bump_tripmate_revision()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at=now();
  new.revision=old.revision+1;
  return new;
end; $$;

drop trigger if exists bump_trip_stop_revision on public.trip_stops;
create trigger bump_trip_stop_revision before update on public.trip_stops
for each row execute function public.bump_tripmate_revision();

drop trigger if exists bump_expense_revision on public.expenses;
create trigger bump_expense_revision before update on public.expenses
for each row execute function public.bump_tripmate_revision();

create index if not exists trip_stops_trip_revision_idx on public.trip_stops(trip_id,id,revision);
create index if not exists expenses_trip_revision_idx on public.expenses(trip_id,id,revision);
