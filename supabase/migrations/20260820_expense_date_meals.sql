-- Expense reporting dimensions for all/day/meal views.
alter table public.expenses
  add column if not exists expense_date date not null default current_date,
  add column if not exists meal_period text not null default 'other'
    check (meal_period in ('breakfast','lunch','dinner','snack','other'));

-- Preserve the best available date for expenses created before this migration.
update public.expenses
set expense_date = (created_at at time zone 'Asia/Bangkok')::date;

create index if not exists expenses_trip_date_idx
  on public.expenses(trip_id,expense_date desc);

create index if not exists expenses_trip_meal_idx
  on public.expenses(trip_id,meal_period);
