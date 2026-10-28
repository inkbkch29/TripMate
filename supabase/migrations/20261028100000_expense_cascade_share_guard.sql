-- Parent DELETE guards validate fund history before FK cascades remove shares.
create or replace function public.trip_fund_protect_shares()
returns trigger language plpgsql security definer set search_path=public as $$
declare tid uuid;eid uuid;
begin
 eid:=coalesce(new.expense_id,old.expense_id);
 select trip_id into tid from public.expenses where id=eid;
 -- A cascading DELETE runs after the parent is removed. No share remains to edit.
 if not found and tg_op='DELETE' then return old;end if;
 perform public.trip_fund_lock(tid);
 if exists(select 1 from public.expenses where id=eid and fund_paid_satang>0) and current_setting('tripmate.fund_write',true) is distinct from 'yes' then raise exception 'บิลนี้ใช้เงินกองกลางแล้ว ไม่สามารถเปลี่ยนส่วนแบ่ง';end if;
 return coalesce(new,old);
end $$;
