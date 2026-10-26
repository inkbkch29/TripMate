begin;
-- Keep the existing guest token/expiry checks and expose only the same public summary fields.
do $$declare definition text;begin
 definition:=pg_get_functiondef('public.guest_trip_snapshot(uuid)'::regprocedure);
 if position('installment_id' in definition)=0 then
  if position('return result;' in definition)=0 then raise exception 'Unexpected guest snapshot';end if;
  definition:=replace(definition,'coalesce(e.approval_status,''approved'')=''approved''','coalesce(e.approval_status,''approved'')=''approved'' and not exists(select 1 from public.collections source where source.expense_id=e.id and source.installment_id is not null)');
  definition:=replace(definition,'from public.collections c where c.trip_id=t.id','from public.collections c where c.trip_id=t.id and c.installment_id is null');
  definition:=replace(definition,'return result;',$patch$result:=jsonb_set(result,'{collections}',coalesce(result->'collections','[]')||coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'amount',e.amount,'due',null)) from public.expenses e where e.trip_id=selected_invite.trip_id and e.is_installment_parent),'[]'));return result;$patch$);
  execute definition;
 end if;
end $$;
commit;
