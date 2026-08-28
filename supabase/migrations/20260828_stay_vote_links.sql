-- Public accommodation voting links. Votes are identified by a normalized voter name,
-- allowing guests to vote without creating an account while preventing duplicate votes.
create table if not exists public.stay_polls (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique, title text not null check (length(trim(title)) between 1 and 180),
  status text not null default 'open' check (status in ('open','closed')), created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.stay_poll_options (
  id uuid primary key default gen_random_uuid(), poll_id uuid not null references public.stay_polls(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160), details text, pros text, cons text, price numeric(12,2) check (price is null or price>=0), image_url text, sort_order integer not null default 0
);
create table if not exists public.stay_poll_votes (
  poll_id uuid not null references public.stay_polls(id) on delete cascade, option_id uuid not null references public.stay_poll_options(id) on delete cascade,
  voter_key text not null, voter_name text not null, created_at timestamptz not null default now(), primary key (poll_id,option_id,voter_key)
);
alter table public.stay_polls enable row level security; alter table public.stay_poll_options enable row level security; alter table public.stay_poll_votes enable row level security;
create or replace function public.create_stay_poll(target_trip uuid,poll_title text,poll_options jsonb)
returns uuid language plpgsql security definer set search_path=public as $$ declare new_poll uuid; begin
  if not exists(select 1 from public.trips where id=target_trip and owner_id=auth.uid()) then raise exception 'เฉพาะแอดมินทริปเท่านั้น'; end if;
  insert into public.stay_polls(trip_id,title,created_by) values(target_trip,trim(poll_title),auth.uid()) returning token into new_poll;
  insert into public.stay_poll_options(poll_id,name,details,pros,cons,price,image_url,sort_order) select id,trim(value->>'name'),nullif(value->>'details',''),nullif(value->>'pros',''),nullif(value->>'cons',''),nullif(value->>'price','')::numeric,nullif(value->>'image_url',''),coalesce((value->>'sort_order')::int,0) from public.stay_polls p cross join jsonb_array_elements(poll_options) value where p.token=new_poll;
  return new_poll;
end; $$;
create or replace function public.stay_poll_snapshot(poll_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$ declare result jsonb; begin
  select jsonb_build_object('id',p.id,'token',p.token,'title',p.title,'status',p.status,'trip',jsonb_build_object('name',t.name,'start_date',t.start_date,'end_date',t.end_date),'options',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'details',o.details,'pros',o.pros,'cons',o.cons,'price',o.price,'image_url',o.image_url,'votes',(select count(*) from public.stay_poll_votes v where v.option_id=o.id)) order by o.sort_order,o.id) from public.stay_poll_options o where o.poll_id=p.id),'[]'::jsonb)) into result from public.stay_polls p join public.trips t on t.id=p.trip_id where p.token=poll_token; if result is null then raise exception 'ไม่พบลิงก์โหวตหรือหมดอายุ'; end if; return result; end; $$;
create or replace function public.cast_stay_vote(poll_token uuid,voter text,option_ids uuid[])
returns void language plpgsql security definer set search_path=public as $$ declare poll_id_value uuid; key text; begin
  if length(trim(voter))<1 or cardinality(option_ids)<1 then raise exception 'กรุณาใส่ชื่อและเลือกอย่างน้อย 1 ที่พัก'; end if;
  select id into poll_id_value from public.stay_polls where token=poll_token and status='open'; if poll_id_value is null then raise exception 'โพลนี้ปิดแล้ว'; end if; key:=md5(lower(trim(voter)));
  delete from public.stay_poll_votes where poll_id=poll_id_value and voter_key=key;
  insert into public.stay_poll_votes(poll_id,option_id,voter_key,voter_name) select poll_id_value,option_id,key,trim(voter) from unnest(option_ids) option_id where exists(select 1 from public.stay_poll_options where id=option_id and poll_id=poll_id_value);
end; $$;
revoke all on function public.create_stay_poll(uuid,text,jsonb) from public; revoke all on function public.stay_poll_snapshot(uuid) from public; revoke all on function public.cast_stay_vote(uuid,text,uuid[]) from public;
grant execute on function public.create_stay_poll(uuid,text,jsonb) to authenticated; grant execute on function public.stay_poll_snapshot(uuid) to anon,authenticated; grant execute on function public.cast_stay_vote(uuid,text,uuid[]) to anon,authenticated;
create index if not exists stay_poll_options_poll_idx on public.stay_poll_options(poll_id,sort_order); create index if not exists stay_poll_votes_poll_idx on public.stay_poll_votes(poll_id);
