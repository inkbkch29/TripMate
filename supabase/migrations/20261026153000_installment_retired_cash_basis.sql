begin;
create or replace function public.installment_expense_snapshot(parent_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare e public.expenses;
begin
 select * into e from public.expenses where id=parent_id and is_installment_parent;
 if e.id is null or not public.is_trip_member(e.trip_id) then raise insufficient_privilege;end if;
 return jsonb_build_object('expense_id',e.id,'trip_id',e.trip_id,'revision',e.installment_revision,'total_satang',(e.amount*100)::bigint,
 'members',coalesce((select jsonb_agg(m order by user_id) from public.expense_installment_members m where parent_expense_id=e.id),'[]'),
 'installments',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('collection_ids',(select coalesce(jsonb_agg(c.id order by c.created_at,c.id),'[]') from public.collections c where c.installment_id=i.id),
 'vendor_paid_satang',coalesce((select sum(amount_satang) from public.expense_installment_vendor_payments v where v.installment_id=i.id),0),
 'fund_paid_satang',coalesce((select -sum(t.amount_satang) from public.trip_fund_transactions t join public.collections c on c.id=t.collection_id where c.installment_id=i.id and (t.type='expense' or t.type='reversal' and exists(select 1 from public.trip_fund_transactions orig where orig.id=t.reversal_of and orig.type='expense'))),0),
 'vendor_payments',(select coalesce(jsonb_agg(v order by created_at desc),'[]') from public.expense_installment_vendor_payments v where installment_id=i.id)) order by i.number) from public.expense_installments i where parent_expense_id=e.id),'[]'),
 'sources',coalesce((select jsonb_agg(co order by co.created_at,co.id) from public.collections co join public.expense_installments ei on ei.id=co.installment_id where ei.parent_expense_id=e.id),'[]'),
 'receipts',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('fund_paid_satang',coalesce((select -sum(t.amount_satang) from public.trip_fund_transactions t where t.collection_id=c.id and (t.type='expense' or t.type='reversal' and exists(select 1 from public.trip_fund_transactions orig where orig.id=t.reversal_of and orig.type='expense'))),0))) from public.installment_cash_receipts p join public.collections c on c.id=p.collection_id join public.expense_installments i on i.id=c.installment_id where i.parent_expense_id=e.id),'[]'),
 'audit',coalesce((select jsonb_agg(to_jsonb(a)-'source_snapshot' order by created_at desc) from public.expense_installment_audit a where parent_expense_id=e.id),'[]'));
end $$;

do $$declare definition text;begin
 definition:=pg_get_functiondef('public.installment_expense_action(uuid,text,jsonb,uuid)'::regprocedure);
 if position('Retained cash basis' in definition)=0 then
  if position('-- Preserve every old amount/status/slip.' in definition)=0 then raise exception 'Unexpected installment action';end if;
  definition:=replace(definition,'-- Preserve every old amount/status/slip.',$patch$-- Retained cash basis belongs only to already received bill money; unreceived bill is rolled into the new request.
   for c in select co.* from public.collections co join public.expense_installments ei on ei.id=co.installment_id where ei.parent_expense_id=parent and exists(select 1 from public.installment_cash_receipts r where r.collection_id=co.id and r.installment_superseded_at is null and r.slip_url is null and (r.status='unpaid' or r.status='paid' and r.cash_satang=0)) loop
    select least(public.collection_bill_satang(c.id),coalesce(sum(r.cash_satang),0)) into actual from public.installment_cash_receipts r where r.collection_id=c.id and r.installment_superseded_at is null;
    update public.collections set installment_bill_satang=actual where id=c.id;
   end loop;
   -- Preserve every old amount/status/slip.$patch$);execute definition;
 end if;
end $$;
commit;
