begin;
-- Add permissions and edit/delete permissions stay separate and scoped to the row's trip.
create function public.trip_plan_manager(tid uuid) returns boolean language sql stable security definer set search_path=public as $$select auth.uid() is not null and exists(select 1 from public.trips t join public.trip_members m on m.trip_id=t.id and m.user_id=auth.uid() where t.id=tid and (t.owner_id=auth.uid() or m.trip_role='planner'))$$;
revoke all on function public.trip_plan_manager(uuid) from public,anon;
grant execute on function public.trip_plan_manager(uuid),public.can_add_trip_stop(uuid) to authenticated;
drop policy if exists "allowed members manage stops" on public.trip_stops;
drop policy if exists "allowed members add stops" on public.trip_stops;
drop policy if exists "owner edits stops" on public.trip_stops;
drop policy if exists "owner deletes stops" on public.trip_stops;
create policy "allowed members add stops" on public.trip_stops for insert to authenticated with check(public.can_add_trip_stop(trip_stops.trip_id) and created_by=auth.uid());
create policy "planners edit stops" on public.trip_stops for update to authenticated using(public.trip_plan_manager(trip_stops.trip_id)) with check(public.trip_plan_manager(trip_stops.trip_id));
create policy "planners delete stops" on public.trip_stops for delete to authenticated using(public.trip_plan_manager(trip_stops.trip_id));
-- An explicit approver can record an approved expense even when member approval is enabled.
drop policy if exists "members create expenses" on public.expenses;
create policy "members create expenses" on public.expenses for insert to authenticated with check(public.is_trip_member(expenses.trip_id) and created_by=auth.uid() and (approval_status='pending' or public.trip_finance_permission(expenses.trip_id,'approve') or exists(select 1 from public.trips t where t.id=expenses.trip_id and not t.require_expense_approval)));
commit;
