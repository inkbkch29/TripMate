-- Trip fund collections and automatic rounding remainder.
alter table public.collections
  add column if not exists is_fund boolean not null default false,
  add column if not exists original_amount numeric(12,2),
  add column if not exists fund_remainder numeric(12,2) not null default 0
    check (fund_remainder >= 0);

update public.collections
set original_amount = amount
where original_amount is null;

alter table public.collections
  alter column original_amount set default 0,
  alter column original_amount set not null;
