begin;
alter table public.expenses add column if not exists receipt_breakdown jsonb;
-- Keep the expense and its shares in one transaction; normal expense RLS still applies.
create or replace function public.save_expense_with_shares(payload jsonb, participant_ids uuid[], share_amounts numeric[], expected_revision integer default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  saved public.expenses;
  target_trip uuid := (payload->>'trip_id')::uuid;
  total numeric := (payload->>'amount')::numeric;
begin
  if auth.uid() is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  if coalesce(cardinality(participant_ids),0)=0 or cardinality(participant_ids)<>cardinality(share_amounts)
    or (select count(distinct id) from unnest(participant_ids) id)<>cardinality(participant_ids)
    or exists(select 1 from unnest(share_amounts) v where v is null or v<0 or v::text in ('NaN','Infinity','-Infinity') or v<>round(v,2))
    or total is null or total<=0 or total::text in ('NaN','Infinity','-Infinity') or total<>round(total,2)
    or total<>(select sum(v) from unnest(share_amounts) v)
    then raise exception 'ยอดส่วนแบ่งต้องตรงกับยอดรวมและไม่ติดลบ'; end if;
  if exists(select 1 from unnest(participant_ids||array[(payload->>'paid_by')::uuid]) id where id is null or not exists(select 1 from public.trip_members m where m.trip_id=target_trip and m.user_id=id))
    then raise exception 'เลือกผู้จ่ายและผู้ร่วมจากสมาชิกในทริป'; end if;
  if expected_revision is null then
    insert into public.expenses(id,trip_id,title,amount,paid_by,category,expense_date,meal_period,created_by,split_method,approval_status,receipt_path,receipt_breakdown)
    values((payload->>'id')::uuid,target_trip,payload->>'title',total,(payload->>'paid_by')::uuid,payload->>'category',(payload->>'expense_date')::date,payload->>'meal_period',auth.uid(),payload->>'split_method',payload->>'approval_status',payload->>'receipt_path',nullif(payload->'receipt_breakdown','null'::jsonb)) returning * into saved;
  else
    update public.expenses set title=payload->>'title',amount=total,paid_by=(payload->>'paid_by')::uuid,category=payload->>'category',expense_date=(payload->>'expense_date')::date,meal_period=payload->>'meal_period',split_method=payload->>'split_method',receipt_path=payload->>'receipt_path',receipt_breakdown=nullif(payload->'receipt_breakdown','null'::jsonb)
    where id=(payload->>'id')::uuid and trip_id=target_trip and revision=expected_revision returning * into saved;
    if saved.id is null then return null; end if;
  end if;
  perform public.replace_expense_participants(saved.id,participant_ids,share_amounts);
  return jsonb_build_object('revision',saved.revision,'updated_at',saved.updated_at);
end $$;
revoke all on function public.save_expense_with_shares(jsonb,uuid[],numeric[],integer) from public;
grant execute on function public.save_expense_with_shares(jsonb,uuid[],numeric[],integer) to authenticated;
commit;
