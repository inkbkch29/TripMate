-- Expense approval, flexible splitting, receipts, and owner-managed trip settings.
alter table public.trips
  add column if not exists budget numeric(12,2) check (budget >= 0),
  add column if not exists require_expense_approval boolean not null default true,
  add column if not exists members_can_add_stops boolean not null default true,
  add column if not exists members_can_add_collections boolean not null default false,
  add column if not exists receipt_required_over numeric(12,2) not null default 0 check (receipt_required_over >= 0);

alter table public.expenses
  add column if not exists approval_status text not null default 'pending'
    check (approval_status in ('pending','approved','rejected')),
  add column if not exists split_method text not null default 'equal'
    check (split_method in ('equal','custom','percentage')),
  add column if not exists receipt_path text,
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

-- Existing expenses were already accepted by the group before this workflow existed.
update public.expenses set approval_status = 'approved' where reviewed_at is null;

drop policy if exists "members manage expenses" on public.expenses;
drop policy if exists "members read expenses" on public.expenses;
drop policy if exists "members create expenses" on public.expenses;
drop policy if exists "owners review expenses" on public.expenses;
drop policy if exists "creators update pending expenses" on public.expenses;
drop policy if exists "owners or creators delete expenses" on public.expenses;

create policy "members read expenses" on public.expenses
for select to authenticated using (public.is_trip_member(trip_id));

create policy "members create expenses" on public.expenses
for insert to authenticated with check (
  public.is_trip_member(trip_id)
  and created_by = auth.uid()
  and (
    approval_status = 'pending'
    or exists(select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
    or exists(select 1 from public.trips t where t.id = trip_id and not t.require_expense_approval)
  )
);

create policy "owners review expenses" on public.expenses
for update to authenticated
using (exists(select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()))
with check (exists(select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

create policy "creators update pending expenses" on public.expenses
for update to authenticated
using (created_by = auth.uid() and approval_status = 'pending')
with check (created_by = auth.uid() and approval_status = 'pending');

create policy "owners or creators delete expenses" on public.expenses
for delete to authenticated using (
  created_by = auth.uid()
  or exists(select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
);

drop policy if exists "members add expense shares" on public.expense_participants;
drop policy if exists "members update expense shares" on public.expense_participants;
create policy "expense owners add shares" on public.expense_participants
for insert to authenticated with check (
  exists(select 1 from public.expenses e join public.trips t on t.id=e.trip_id
    where e.id=expense_id and (e.created_by=auth.uid() or t.owner_id=auth.uid()))
);
create policy "expense owners update shares" on public.expense_participants
for update to authenticated
using (exists(select 1 from public.expenses e join public.trips t on t.id=e.trip_id
  where e.id=expense_id and (e.created_by=auth.uid() or t.owner_id=auth.uid())))
with check (exists(select 1 from public.expenses e join public.trips t on t.id=e.trip_id
  where e.id=expense_id and (e.created_by=auth.uid() or t.owner_id=auth.uid())));

create or replace function public.review_expense(
  target_expense uuid,
  target_status text,
  review_comment text default null
) returns void language plpgsql security definer set search_path = public
as $$
begin
  if target_status not in ('approved','rejected') then
    raise exception 'สถานะอนุมัติไม่ถูกต้อง';
  end if;
  if not exists(
    select 1 from public.expenses e join public.trips t on t.id=e.trip_id
    where e.id=target_expense and t.owner_id=auth.uid()
  ) then
    raise exception 'เฉพาะเจ้าของทริปเท่านั้นที่ตรวจรายจ่ายได้';
  end if;
  update public.expenses
  set approval_status=target_status, reviewed_by=auth.uid(), reviewed_at=now(), review_note=review_comment
  where id=target_expense;
end;
$$;

revoke all on function public.review_expense(uuid,text,text) from public;
grant execute on function public.review_expense(uuid,text,text) to authenticated;

create index if not exists expenses_trip_approval_idx on public.expenses(trip_id,approval_status);
