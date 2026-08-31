-- Generalize accommodation voting into reusable trip polls while preserving old data.
alter table public.stay_polls
  add column if not exists poll_type text not null default 'stay'
    check (poll_type in ('stay','place','activity','other')),
  add column if not exists auto_close boolean not null default true;

create or replace function public.configure_trip_poll(poll_token uuid, target_type text, should_auto_close boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if target_type not in ('stay','place','activity','other') then raise exception 'ประเภทโหวตไม่ถูกต้อง'; end if;
  update public.stay_polls p set poll_type=target_type,auto_close=coalesce(should_auto_close,true)
  from public.trips t where p.token=poll_token and t.id=p.trip_id and t.owner_id=auth.uid();
  if not found then raise exception 'ไม่พบโพลหรือไม่มีสิทธิ์แก้ไข'; end if;
end; $$;

create or replace function public.cast_stay_vote(poll_token uuid,voter text,option_ids uuid[])
returns void language plpgsql security definer set search_path=public as $$
declare poll_id_value uuid; selected_option_id uuid; voter_key_value text; legacy_name_key text;
begin
  if length(trim(coalesce(voter,'')))<1 then raise exception 'กรุณาใส่ชื่อก่อนโหวต'; end if;
  if coalesce(cardinality(option_ids),0)<>1 then raise exception 'เลือกได้เพียง 1 ตัวเลือก'; end if;
  select id into poll_id_value from public.stay_polls where token=poll_token and status='open';
  if poll_id_value is null then raise exception 'โพลนี้ปิดแล้ว'; end if;
  selected_option_id:=option_ids[1];
  if not exists(select 1 from public.stay_poll_options where id=selected_option_id and poll_id=poll_id_value) then raise exception 'ไม่พบตัวเลือกนี้'; end if;
  legacy_name_key:=md5(lower(trim(voter)));
  voter_key_value:=case when auth.uid() is not null then 'user:'||auth.uid()::text else legacy_name_key end;
  if auth.uid() is not null then delete from public.stay_poll_votes where poll_id=poll_id_value and voter_key=legacy_name_key; end if;
  insert into public.stay_poll_votes(poll_id,option_id,voter_key,voter_name,created_at)
  values(poll_id_value,selected_option_id,voter_key_value,trim(voter),now())
  on conflict(poll_id,voter_key) do update set option_id=excluded.option_id,voter_name=excluded.voter_name,created_at=excluded.created_at;
  update public.stay_polls p set status='closed',closed_at=now()
  where p.id=poll_id_value and p.auto_close and
    (select count(distinct v.voter_key) from public.stay_poll_votes v where v.poll_id=p.id)>=
    (select count(*) from public.trip_members m where m.trip_id=p.trip_id);
end; $$;

create or replace function public.stay_poll_snapshot(poll_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'id',p.id,'token',p.token,'title',p.title,'status',p.status,'poll_type',p.poll_type,'auto_close',p.auto_close,
    'winner_option_id',p.winner_option_id,'closed_at',p.closed_at,
    'member_count',(select count(*) from public.trip_members m where m.trip_id=p.trip_id),
    'voter_count',(select count(distinct v.voter_key) from public.stay_poll_votes v where v.poll_id=p.id),
    'trip',jsonb_build_object('name',t.name,'start_date',t.start_date,'end_date',t.end_date),
    'options',coalesce((select jsonb_agg(jsonb_build_object(
      'id',o.id,'name',o.name,'details',o.details,'pros',o.pros,'cons',o.cons,'price',o.price,'image_url',o.image_url,
      'votes',(select count(*) from public.stay_poll_votes v where v.option_id=o.id),
      'voters',coalesce((select jsonb_agg(v.voter_name order by v.created_at) from public.stay_poll_votes v where v.option_id=o.id),'[]'::jsonb)
    ) order by o.sort_order,o.id) from public.stay_poll_options o where o.poll_id=p.id),'[]'::jsonb)
  ) into result from public.stay_polls p join public.trips t on t.id=p.trip_id where p.token=poll_token;
  if result is null then raise exception 'ไม่พบลิงก์โหวตหรือหมดอายุ'; end if; return result;
end; $$;

create or replace function public.list_stay_polls(target_trip uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if not exists(select 1 from public.trips where id=target_trip and owner_id=auth.uid()) then raise exception 'เฉพาะแอดมินทริปเท่านั้น'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'token',p.token,'title',p.title,'status',p.status,'poll_type',p.poll_type,'auto_close',p.auto_close,
    'winner_option_id',p.winner_option_id,'closed_at',p.closed_at,'created_at',p.created_at,
    'voter_count',(select count(distinct v.voter_key) from public.stay_poll_votes v where v.poll_id=p.id),
    'member_count',(select count(*) from public.trip_members m where m.trip_id=p.trip_id),
    'options',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'details',o.details,'pros',o.pros,'cons',o.cons,'price',o.price,'image_url',o.image_url,'votes',(select count(*) from public.stay_poll_votes v where v.option_id=o.id)) order by o.sort_order,o.id) from public.stay_poll_options o where o.poll_id=p.id),'[]'::jsonb)
  ) order by (p.status='open') desc,p.created_at desc),'[]'::jsonb) into result from public.stay_polls p where p.trip_id=target_trip;
  return result;
end; $$;

create or replace function public.list_trip_vote_links(target_trip uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.is_trip_member(target_trip) then raise exception 'ไม่มีสิทธิ์เข้าถึงโหวตของทริปนี้'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'token',p.token,'title',p.title,'status',p.status,'poll_type',p.poll_type,'auto_close',p.auto_close,
    'winner_option_id',p.winner_option_id,'option_count',(select count(*) from public.stay_poll_options o where o.poll_id=p.id),
    'voter_count',(select count(distinct v.voter_key) from public.stay_poll_votes v where v.poll_id=p.id),
    'member_count',(select count(*) from public.trip_members m where m.trip_id=p.trip_id)
  ) order by (p.status='open') desc,p.created_at desc),'[]'::jsonb) into result from public.stay_polls p where p.trip_id=target_trip;
  return result;
end; $$;

revoke all on function public.configure_trip_poll(uuid,text,boolean) from public;
grant execute on function public.configure_trip_poll(uuid,text,boolean) to authenticated;
grant execute on function public.cast_stay_vote(uuid,text,uuid[]) to anon,authenticated;
grant execute on function public.stay_poll_snapshot(uuid) to anon,authenticated;
grant execute on function public.list_stay_polls(uuid) to authenticated;
grant execute on function public.list_trip_vote_links(uuid) to authenticated;
