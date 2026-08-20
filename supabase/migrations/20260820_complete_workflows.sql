-- Complete TripMate workflows: expense dimensions, settlements, stop maps and ordering.
alter table public.expenses
  add column if not exists expense_date date not null default current_date,
  add column if not exists meal_period text not null default 'other'
    check (meal_period in ('breakfast','lunch','dinner','snack','other'));

update public.expenses
set expense_date = (created_at at time zone 'Asia/Bangkok')::date;

alter table public.trip_stops
  add column if not exists google_maps_url text;

create table if not exists public.trip_settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_user uuid not null references public.profiles(id),
  to_user uuid not null references public.profiles(id),
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  slip_path text,
  submitted_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles(id),
  unique(trip_id,from_user,to_user),
  check (from_user <> to_user)
);

alter table public.trip_settlements enable row level security;
drop policy if exists "members read settlements" on public.trip_settlements;
create policy "members read settlements" on public.trip_settlements
for select to authenticated using (public.is_trip_member(trip_id));

-- UI settings and named roles are enforced at database level as well.
drop policy if exists "members manage stops" on public.trip_stops;
drop policy if exists "members read stops" on public.trip_stops;
drop policy if exists "allowed members manage stops" on public.trip_stops;
create policy "members read stops" on public.trip_stops for select to authenticated
using (public.is_trip_member(trip_id));
create policy "allowed members manage stops" on public.trip_stops for all to authenticated
using (exists(select 1 from public.trips t join public.trip_members tm on tm.trip_id=t.id and tm.user_id=auth.uid() where t.id=trip_id and (t.owner_id=auth.uid() or tm.trip_role='planner' or t.members_can_add_stops)))
with check (exists(select 1 from public.trips t join public.trip_members tm on tm.trip_id=t.id and tm.user_id=auth.uid() where t.id=trip_id and (t.owner_id=auth.uid() or tm.trip_role='planner' or t.members_can_add_stops)));

drop policy if exists "members manage collections" on public.collections;
drop policy if exists "members read collections" on public.collections;
drop policy if exists "allowed members manage collections" on public.collections;
create policy "members read collections" on public.collections for select to authenticated
using (public.is_trip_member(trip_id));
create policy "allowed members manage collections" on public.collections for all to authenticated
using (exists(select 1 from public.trips t join public.trip_members tm on tm.trip_id=t.id and tm.user_id=auth.uid() where t.id=trip_id and (t.owner_id=auth.uid() or tm.trip_role='treasurer' or t.members_can_add_collections)))
with check (exists(select 1 from public.trips t join public.trip_members tm on tm.trip_id=t.id and tm.user_id=auth.uid() where t.id=trip_id and (t.owner_id=auth.uid() or tm.trip_role='treasurer' or t.members_can_add_collections)));

drop policy if exists "users update own payments" on public.collection_payments;

create or replace function public.submit_collection_payment(target_collection uuid,target_slip text)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not exists(select 1 from public.collection_payments p join public.collections c on c.id=p.collection_id where p.collection_id=target_collection and p.user_id=auth.uid() and public.is_trip_member(c.trip_id)) then
    raise exception 'ไม่พบรายการชำระของคุณ';
  end if;
  update public.collection_payments set status='pending',slip_url=target_slip,confirmed_at=null where collection_id=target_collection and user_id=auth.uid();
end;
$$;

create or replace function public.review_expense(target_expense uuid,target_status text,review_comment text default null)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if target_status not in ('approved','rejected') then raise exception 'สถานะอนุมัติไม่ถูกต้อง'; end if;
  if not exists(select 1 from public.expenses e join public.trips t on t.id=e.trip_id left join public.trip_members tm on tm.trip_id=t.id and tm.user_id=auth.uid() where e.id=target_expense and (t.owner_id=auth.uid() or tm.trip_role='treasurer')) then
    raise exception 'เฉพาะเจ้าของทริปหรือเหรัญญิกเท่านั้นที่ตรวจรายจ่ายได้';
  end if;
  update public.expenses set approval_status=target_status,reviewed_by=auth.uid(),reviewed_at=now(),review_note=review_comment where id=target_expense;
end;
$$;

create or replace function public.submit_settlement(
  target_trip uuid,
  target_to uuid,
  target_amount numeric,
  target_slip text
) returns uuid language plpgsql security definer set search_path=public
as $$
declare settlement_id uuid;
begin
  if target_amount <= 0 or not public.is_trip_member(target_trip) then
    raise exception 'ข้อมูลการโอนไม่ถูกต้อง';
  end if;
  if not exists(select 1 from public.trip_members where trip_id=target_trip and user_id=target_to) then
    raise exception 'ผู้รับไม่ได้อยู่ในทริปนี้';
  end if;
  insert into public.trip_settlements(trip_id,from_user,to_user,amount,status,slip_path,submitted_at,confirmed_at,confirmed_by)
  values(target_trip,auth.uid(),target_to,target_amount,'pending',target_slip,now(),null,null)
  on conflict(trip_id,from_user,to_user) do update
  set amount=excluded.amount,status='pending',slip_path=excluded.slip_path,submitted_at=now(),confirmed_at=null,confirmed_by=null
  returning id into settlement_id;
  return settlement_id;
end;
$$;

create or replace function public.review_settlement(target_id uuid,target_status text)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if target_status not in ('confirmed','rejected') then raise exception 'สถานะไม่ถูกต้อง'; end if;
  if not exists(
    select 1 from public.trip_settlements s join public.trips t on t.id=s.trip_id
    left join public.trip_members tm on tm.trip_id=t.id and tm.user_id=auth.uid()
    where s.id=target_id and (s.to_user=auth.uid() or t.owner_id=auth.uid() or tm.trip_role='treasurer')
  ) then raise exception 'คุณไม่มีสิทธิ์ยืนยันรายการนี้'; end if;
  update public.trip_settlements set status=target_status,confirmed_at=now(),confirmed_by=auth.uid() where id=target_id;
end;
$$;

create or replace function public.reorder_trip_stops(target_trip uuid,ordered_ids uuid[])
returns void language plpgsql security definer set search_path=public
as $$
declare stop_id uuid; position_index int:=0;
begin
  if not exists(
    select 1 from public.trips t where t.id=target_trip and
    (t.owner_id=auth.uid() or t.members_can_add_stops or exists(select 1 from public.trip_members tm where tm.trip_id=target_trip and tm.user_id=auth.uid() and tm.trip_role='planner'))
  ) then raise exception 'คุณไม่มีสิทธิ์จัดลำดับแพลน'; end if;
  foreach stop_id in array ordered_ids loop
    update public.trip_stops set sort_order=position_index where id=stop_id and trip_id=target_trip;
    position_index:=position_index+1;
  end loop;
end;
$$;

revoke all on function public.submit_settlement(uuid,uuid,numeric,text) from public;
revoke all on function public.review_settlement(uuid,text) from public;
revoke all on function public.reorder_trip_stops(uuid,uuid[]) from public;
revoke all on function public.submit_collection_payment(uuid,text) from public;
grant execute on function public.submit_settlement(uuid,uuid,numeric,text) to authenticated;
grant execute on function public.review_settlement(uuid,text) to authenticated;
grant execute on function public.reorder_trip_stops(uuid,uuid[]) to authenticated;
grant execute on function public.submit_collection_payment(uuid,text) to authenticated;

create index if not exists expenses_trip_date_idx on public.expenses(trip_id,expense_date desc);
create index if not exists expenses_trip_meal_idx on public.expenses(trip_id,meal_period);
create index if not exists settlements_trip_status_idx on public.trip_settlements(trip_id,status);
