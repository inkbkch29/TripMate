"""Emit a focused, disposable PostgreSQL test schema using repository SQL definitions.
Not a complete Supabase installation; auth JWT and storage metadata are local shims.
"""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
def source(name):return (root/'supabase'/name).read_text()
def table(text,name):
 m=re.search(r'create table (?:if not exists )?public\.'+name+r'\s*\(',text,re.I)
 return text[m.start():text.index(');',m.start())+2]
def fn(text,name):
 m=re.search(r'create(?: or replace)? function public\.'+name+r'\b',text,re.I)
 d=re.search(r'\$[a-zA-Z_]*\$',text[m.start():]);start=m.start()+d.start();tag=d.group()
 return text[m.start():text.index(tag+';',start+len(tag))+len(tag)+1]
base=source('schema.sql');workflow=source('migrations/20260820_complete_workflows.sql');fund=source('migrations/20261026110000_hybrid_trip_fund.sql');integrity=source('migrations/20261027030000_financial_payment_integrity.sql');permissions=source('migrations/20261026220000_settings_member_access.sql');request=source('migrations/20261026200000_collection_request_intent.sql')
parts=['''create role anon; create role authenticated;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create schema storage; create table storage.objects(bucket_id text,name text,owner_id text,unique(bucket_id,name));
''']
for name in ['profiles','trips','trip_members','collections','collection_payments','expenses']:parts.append(table(base,name))
parts+=['''alter table public.trips add members_can_add_collections boolean default true;
alter table public.trip_members add can_confirm_payments boolean,add can_manage_fund boolean,add can_approve_expenses boolean;
alter table public.collections alter due_date drop not null;
alter table public.collections add original_amount numeric,add fund_remainder numeric default 0,add is_fund boolean default false,add collection_only boolean default false,add expense_id uuid,add installment_id uuid;
alter table public.collection_payments add submitted_by uuid,add installment_superseded_at timestamptz;
alter table public.expenses add receipt_path text;
create table public.trip_trash(trip_id uuid,payload jsonb);
''',table(workflow,'trip_settlements'),"alter table public.trip_settlements drop constraint trip_settlements_trip_id_from_user_to_user_key; create unique index trip_settlements_active_pair_idx on public.trip_settlements(trip_id,from_user,to_user) where status<>'confirmed';",fn(base,'is_trip_member'),fn(permissions,'trip_finance_permission')]
for name in ['trip_fund_transactions','trip_fund_settlements']:parts.append(table(fund,name))
for name in ['trip_fund_lock','trip_fund_balance']:parts.append(fn(fund,name))
parts.append(source('migrations/20261024120000_received_collection_amounts.sql').replace("m.trip_role='treasurer'","public.trip_finance_permission(t.id,'confirm')"))
for name in ['valid_trip_financial_attachment','validate_financial_attachment_reference','preserve_confirmed_collection_payment','trip_fund_receipt']:parts.append(fn(integrity,name))
for name in ['protect_collection_request_intent','guard_request_payment_history','save_collection_request']:parts.append(fn(request,name).replace("m.trip_role='treasurer'","public.trip_finance_permission(t.id,'confirm')"))
parts+=['''create trigger preserve_confirmed_payment before update on public.collection_payments for each row execute function public.preserve_confirmed_collection_payment();
create trigger guard_request_payment_history before update or delete on public.collection_payments for each row execute function public.guard_request_payment_history();
create trigger trip_fund_receipt after insert or update or delete on public.collection_payments for each row execute function public.trip_fund_receipt();
create trigger validate_collection_attachment before insert or update of slip_url on public.collection_payments for each row execute function public.validate_financial_attachment_reference();
create trigger validate_settlement_attachment before insert or update of slip_path on public.trip_settlements for each row execute function public.validate_financial_attachment_reference();
''',fn(workflow,'submit_collection_payment'),source('migrations/20261101160000_settlement_pay_for_member.sql'),source('migrations/20261101170000_payment_review_integrity.sql')]
print('\n'.join(parts))
