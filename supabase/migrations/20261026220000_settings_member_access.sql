begin;
alter table public.trip_members add column can_manage_fund boolean,add column can_approve_expenses boolean,add column can_confirm_payments boolean;
alter table public.trips add column members_can_create_polls boolean not null default true;
alter table public.trip_activity_log add column details jsonb,add column request_key uuid,add column actor_name text;
create unique index trip_activity_request_once on public.trip_activity_log(trip_id,request_key) where request_key is not null;
-- NULL preserves historical treasurer rights without changing existing membership rows.
create function public.trip_finance_permission(tid uuid,permission text) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from public.trips t join public.trip_members m on m.trip_id=t.id and m.user_id=auth.uid() where t.id=tid and (t.owner_id=auth.uid() or case permission when 'fund' then coalesce(m.can_manage_fund,m.trip_role='treasurer') when 'approve' then coalesce(m.can_approve_expenses,m.trip_role='treasurer') when 'confirm' then coalesce(m.can_confirm_payments,m.trip_role='treasurer') else false end));
$$;
revoke all on function public.trip_finance_permission(uuid,text) from public,anon;
grant execute on function public.trip_finance_permission(uuid,text) to authenticated;
create or replace function public.trip_fund_manager(tid uuid) returns boolean language sql stable security definer set search_path=public as $$select public.trip_finance_permission(tid,'fund')$$;
create or replace function public.trip_poll_manager(p public.stay_polls) returns boolean language sql stable security definer set search_path=public as $$
 select public.is_trip_member(p.trip_id) and (p.created_by=auth.uid() or exists(select 1 from public.trips t join public.trip_members m on m.trip_id=t.id and m.user_id=auth.uid() where t.id=p.trip_id and (t.owner_id=auth.uid() or m.trip_role='planner')));
$$;
-- Replace only the financial role clauses inside the existing protected workflows.
do $$declare fn record;definition text;permission text;begin
 for fn in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('review_expense','replace_expense_participants','sync_receipt_collection','review_settlement','confirm_collection_received','replace_collection_payments','save_collection_request') loop
  permission:=case when fn.proname in ('review_expense','replace_expense_participants','sync_receipt_collection') then 'approve' else 'confirm' end;
  definition:=pg_get_functiondef(fn.oid);
  if definition!~'[a-z]+\.trip_role=''treasurer''' then raise exception 'Unexpected financial permission definition: %',fn.proname;end if;
  definition:=regexp_replace(definition,'[a-z]+\.trip_role=''treasurer''','public.trip_finance_permission(t.id,'||quote_literal(permission)||')','g');
  execute definition;
 end loop;
 definition:=pg_get_functiondef('public.delete_trip_item(uuid,text,uuid)'::regprocedure);
 if position('(target_type in (''expense'',''collection'') and m.trip_role=''treasurer'')' in definition)=0 then raise exception 'Unexpected delete guard';end if;
 execute replace(definition,'(target_type in (''expense'',''collection'') and m.trip_role=''treasurer'')','(target_type=''expense'' and public.trip_finance_permission(target_trip,''approve'')) or (target_type=''collection'' and public.trip_finance_permission(target_trip,''confirm''))');
 definition:=pg_get_functiondef('public.trip_poll_save(uuid,uuid,text,jsonb,jsonb,text,integer)'::regprocedure);
 if position('if is_new then' in definition)=0 then raise exception 'Unexpected poll save';end if;
 execute replace(definition,'if is_new then','if is_new then
 if not exists(select 1 from public.trips t join public.trip_members m on m.trip_id=t.id and m.user_id=auth.uid() where t.id=target_trip and (t.owner_id=auth.uid() or m.trip_role=''planner'' or t.members_can_create_polls)) then raise insufficient_privilege using message=''ยังไม่ได้เปิดสิทธิ์ให้สมาชิกสร้างโหวต'';end if;');
end $$;
-- Explicit table qualification prevents another trip's membership from granting access.
drop policy if exists "allowed members manage collections" on public.collections;
create policy "allowed members insert collections" on public.collections for insert to authenticated with check(created_by=auth.uid() and exists(select 1 from public.trips t join public.trip_members m on m.trip_id=t.id and m.user_id=auth.uid() where t.id=collections.trip_id and (public.trip_finance_permission(t.id,'confirm') or t.members_can_add_collections)));
create policy "creators or confirmation managers update collections" on public.collections for update to authenticated using(public.is_trip_member(collections.trip_id) and (created_by=auth.uid() or public.trip_finance_permission(collections.trip_id,'confirm'))) with check(public.is_trip_member(collections.trip_id) and (created_by=auth.uid() or public.trip_finance_permission(collections.trip_id,'confirm')));
create policy "creators or confirmation managers delete collections" on public.collections for delete to authenticated using(public.is_trip_member(collections.trip_id) and (created_by=auth.uid() or public.trip_finance_permission(collections.trip_id,'confirm')));
drop policy if exists "owners or treasurers update expenses" on public.expenses;
create policy "expense approvers update expenses" on public.expenses for update to authenticated using(public.trip_finance_permission(expenses.trip_id,'approve')) with check(public.trip_finance_permission(expenses.trip_id,'approve'));
drop policy if exists "finance managers or creators delete expenses" on public.expenses;
create policy "expense approvers or creators delete expenses" on public.expenses for delete to authenticated using(public.is_trip_member(expenses.trip_id) and (created_by=auth.uid() or public.trip_finance_permission(expenses.trip_id,'approve')));
-- Audits reuse the existing timeline, with before/after values for important changes.
create function public.audit_trip_access_change() returns trigger language plpgsql security definer set search_path=public as $$
declare tid uuid;entity uuid;before_data jsonb;after_data jsonb;msg text;
begin
 if current_setting('tripmate.audit_managed',true)='true' then return coalesce(new,old);end if;
 if tg_table_name='trips' then
  if tg_op<>'UPDATE' or to_jsonb(old)=to_jsonb(new) then return new;end if;
  tid:=new.id;entity:=new.id;before_data:=to_jsonb(old);after_data:=to_jsonb(new);msg:='แก้ไขข้อมูลหรือสิทธิ์ของทริป';
 else
  tid:=coalesce(new.trip_id,old.trip_id);entity:=coalesce(new.user_id,old.user_id);
  before_data:=case when tg_op<>'INSERT' then to_jsonb(old) end;after_data:=case when tg_op<>'DELETE' then to_jsonb(new) end;
  if before_data is not distinct from after_data then return coalesce(new,old);end if;
  msg:=case tg_op when 'INSERT' then 'เพิ่มสมาชิกในทริป' when 'DELETE' then 'นำสมาชิกออกจากทริป' else 'เปลี่ยนสิทธิ์สมาชิก' end;
 end if;
 if exists(select 1 from public.trips where id=tid) then
 insert into public.trip_activity_log(trip_id,actor_id,actor_name,kind,message,entity_type,entity_id,details)values(tid,auth.uid(),(select display_name from public.profiles where id=auth.uid()),'settings',msg,tg_table_name,entity,jsonb_build_object('before',before_data,'after',after_data));end if;
 return coalesce(new,old);
end $$;
create trigger audit_trip_settings_change after update on public.trips for each row execute function public.audit_trip_access_change();
create trigger audit_trip_member_access after insert or update or delete on public.trip_members for each row execute function public.audit_trip_access_change();
-- Validate the final transactional state; existing create-trip flow inserts its owner membership separately.
create function public.assert_trip_owner_consistency() returns trigger language plpgsql security definer set search_path=public as $$
declare tid uuid;owner_uid uuid;begin
 if tg_table_name='trips' then tid:=coalesce(new.id,old.id);else tid:=coalesce(new.trip_id,old.trip_id);end if;
 select owner_id into owner_uid from public.trips where id=tid;if not found then return null;end if;
 if not exists(select 1 from public.trip_members where trip_id=tid and user_id=owner_uid and trip_role='owner') or (select count(*) from public.trip_members where trip_id=tid and trip_role='owner')<>1 then raise exception 'ต้องมีเจ้าของทริป 1 คน กรุณาโอนเจ้าของก่อนเปลี่ยนหรือนำออก';end if;
 return null;
end $$;
create constraint trigger member_owner_consistency after insert or update or delete on public.trip_members deferrable initially deferred for each row execute function public.assert_trip_owner_consistency();
create constraint trigger trip_owner_consistency after update of owner_id on public.trips deferrable initially deferred for each row execute function public.assert_trip_owner_consistency();
create function public.set_trip_member_access(target_trip uuid,target_user uuid,target_role text,finance jsonb,request_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare t public.trips;m public.trip_members;after_member public.trip_members;prior public.trip_activity_log;key text;input jsonb;begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 select * into t from public.trips where id=target_trip for update;
 if t.owner_id is distinct from auth.uid() then raise insufficient_privilege using message='เฉพาะเจ้าของทริปเท่านั้นที่เปลี่ยนสิทธิ์ได้';end if;
 if request_id is null or target_role not in ('member','planner') or jsonb_typeof(finance) is distinct from 'object' then raise exception 'ตรวจบทบาทและสิทธิ์สมาชิก';end if;
 for key in select jsonb_object_keys(finance) loop if key not in ('fund','approve','confirm') or jsonb_typeof(finance->key)<>'boolean' then raise exception 'สิทธิ์การเงินไม่ถูกต้อง';end if;end loop;
 input:=jsonb_build_object('user',target_user,'role',target_role,'finance',finance);
 select * into prior from public.trip_activity_log where trip_id=target_trip and request_key=request_id;
 if found then if prior.actor_id=auth.uid() and prior.details->'input'=input then return;else raise exception 'คำขอนี้ถูกใช้แล้ว';end if;end if;
 select * into m from public.trip_members where trip_id=target_trip and user_id=target_user for update;
 if m.user_id is null or target_user=t.owner_id or m.trip_role='owner' then raise exception 'ใช้ขั้นตอนโอนความเป็นเจ้าของสำหรับเจ้าของทริป';end if;
 perform set_config('tripmate.audit_managed','true',true);
 update public.trip_members set trip_role=target_role,can_manage_fund=coalesce((finance->>'fund')::boolean,can_manage_fund,m.trip_role='treasurer'),can_approve_expenses=coalesce((finance->>'approve')::boolean,can_approve_expenses,m.trip_role='treasurer'),can_confirm_payments=coalesce((finance->>'confirm')::boolean,can_confirm_payments,m.trip_role='treasurer') where trip_id=target_trip and user_id=target_user returning * into after_member;
 perform set_config('tripmate.audit_managed','false',true);
 insert into public.trip_activity_log(trip_id,actor_id,actor_name,kind,message,entity_type,entity_id,request_key,details)values(target_trip,auth.uid(),(select display_name from public.profiles where id=auth.uid()),'member_access','เปลี่ยนสิทธิ์ของ '||coalesce((select display_name from public.profiles where id=target_user),'สมาชิก'),'trip_members',target_user,request_id,jsonb_build_object('input',input,'before',to_jsonb(m),'after',to_jsonb(after_member)));
end $$;
create function public.transfer_trip_ownership(target_trip uuid,target_user uuid,confirmation text,request_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare t public.trips;prior public.trip_activity_log;input jsonb;begin
 if auth.uid() is null or request_id is null then raise insufficient_privilege;end if;
 select * into t from public.trips where id=target_trip for update;
 input:=jsonb_build_object('user',target_user,'confirmation',confirmation);
 select * into prior from public.trip_activity_log where trip_id=target_trip and request_key=request_id;
 if found then if prior.actor_id=auth.uid() and prior.details->'input'=input then return;else raise exception 'คำขอนี้ถูกใช้แล้ว';end if;end if;
 if t.owner_id is distinct from auth.uid() then raise insufficient_privilege using message='เฉพาะเจ้าของทริปเท่านั้นที่โอนได้';end if;
 if confirmation is distinct from t.name or target_user=auth.uid() or not exists(select 1 from public.trip_members where trip_id=target_trip and user_id=target_user) then raise exception 'ตรวจชื่อทริปและสมาชิกที่จะรับโอน';end if;
 perform set_config('tripmate.audit_managed','true',true);
 update public.trips set owner_id=target_user where id=target_trip;
 update public.trip_members set trip_role=case when user_id=target_user then 'owner' else 'member' end where trip_id=target_trip and user_id in (t.owner_id,target_user);
 perform set_config('tripmate.audit_managed','false',true);
 insert into public.trip_activity_log(trip_id,actor_id,actor_name,kind,message,entity_type,entity_id,request_key,details)values(target_trip,auth.uid(),(select display_name from public.profiles where id=auth.uid()),'ownership','โอนความเป็นเจ้าของทริปให้ '||coalesce((select display_name from public.profiles where id=target_user),'สมาชิก'),'trips',target_trip,request_id,jsonb_build_object('input',input,'before_owner',t.owner_id,'after_owner',target_user));
end $$;
revoke all on function public.set_trip_member_access(uuid,uuid,text,jsonb,uuid),public.transfer_trip_ownership(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.set_trip_member_access(uuid,uuid,text,jsonb,uuid),public.transfer_trip_ownership(uuid,uuid,text,uuid) to authenticated;
revoke all on function public.audit_trip_access_change(),public.assert_trip_owner_consistency() from public,anon,authenticated;

-- Enforce the receipt threshold and approval requirement at the write boundary too.
create function public.enforce_expense_access_settings() returns trigger language plpgsql security definer set search_path=public as $$
declare t public.trips;begin
 if auth.uid() is null then return new;end if;
 select * into t from public.trips where id=new.trip_id;
 if (new.fund_only or new.is_installment_parent) and public.trip_fund_manager(new.trip_id) then return new;end if;
 if t.receipt_required_over>0 and new.amount>=t.receipt_required_over and nullif(new.receipt_path,'') is null then raise exception 'ยอดนี้ต้องแนบใบเสร็จตามการตั้งค่าทริป';end if;
 if not public.trip_finance_permission(new.trip_id,'approve') then
  if tg_op='INSERT' then new.approval_status:=case when t.require_expense_approval then 'pending' else 'approved' end;
  elsif new.approval_status is distinct from old.approval_status then raise insufficient_privilege using message='ไม่มีสิทธิ์อนุมัติรายจ่าย';end if;
 end if;
 return new;
end $$;
create trigger enforce_expense_access_settings before insert or update on public.expenses for each row execute function public.enforce_expense_access_settings();
revoke all on function public.enforce_expense_access_settings() from public,anon,authenticated;
commit;
