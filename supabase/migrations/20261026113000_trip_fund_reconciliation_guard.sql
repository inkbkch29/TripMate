begin;
create or replace function public.trip_fund_snapshot(target_trip uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.is_trip_member(target_trip) then raise insufficient_privilege;end if;
 return jsonb_build_object('can_manage',public.trip_fund_manager(target_trip),'balance_satang',public.trip_fund_balance(target_trip),
 'transactions',coalesce((select jsonb_agg(t order by created_at desc) from public.trip_fund_transactions t where trip_id=target_trip),'[]'),
 'rounding',coalesce((select jsonb_agg(r) from public.trip_fund_rounding(target_trip)r where available_satang>0),'[]'),
 'settlements',coalesce((select jsonb_agg(s order by created_at desc) from public.trip_fund_settlements s where trip_id=target_trip),'[]'),
 'refunds',coalesce((select jsonb_agg(r) from public.trip_fund_refunds r where trip_id=target_trip),'[]'),
 'custodians',coalesce((select jsonb_agg(x) from (select custodian_id,sum(amount_satang) as balance_satang from public.trip_fund_transactions where trip_id=target_trip group by custodian_id)x),'[]'),
 'unresolved_count',(select count(*) from public.collection_payments p join public.collections c on c.id=p.collection_id where c.trip_id=target_trip and c.is_fund and (p.status<>'paid' or p.received_amount is null or not exists(select 1 from public.trip_fund_transactions dep where dep.trip_id=target_trip and dep.source_key='receipt:'||c.id||':'||p.user_id and not exists(select 1 from public.trip_fund_transactions rev where rev.reversal_of=dep.id))))+(select count(*) from public.trip_fund_rounding(target_trip)r where available_satang>0));
end $$;

commit;
