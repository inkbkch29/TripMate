-- Admin management for existing accommodation polls.
create or replace function public.create_stay_poll(target_trip uuid,poll_title text,poll_options jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_poll uuid;
begin
  if not exists(select 1 from public.trips where id=target_trip and owner_id=auth.uid()) then raise exception 'เฉพาะแอดมินทริปเท่านั้น'; end if;
  insert into public.stay_polls(trip_id,title,created_by) values(target_trip,trim(poll_title),auth.uid()) returning token into new_poll;
  insert into public.stay_poll_options(poll_id,name,details,pros,cons,price,image_url,sort_order)
  select p.id,trim(value->>'name'),nullif(value->>'details',''),nullif(value->>'pros',''),nullif(value->>'cons',''),
    nullif(value->>'price','')::numeric,nullif(value->>'image_url',''),coalesce((value->>'sort_order')::int,0)
  from public.stay_polls p cross join jsonb_array_elements(poll_options) value where p.token=new_poll;
  return new_poll;
end; $$;

create or replace function public.list_stay_polls(target_trip uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare result jsonb;
begin
  if not exists(select 1 from public.trips where id=target_trip and owner_id=auth.uid()) then
    raise exception 'เฉพาะแอดมินทริปเท่านั้น';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,
    'token',p.token,
    'title',p.title,
    'status',p.status,
    'created_at',p.created_at,
    'options',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',o.id,
        'name',o.name,
        'details',o.details,
        'pros',o.pros,
        'cons',o.cons,
        'price',o.price,
        'image_url',o.image_url,
        'votes',(select count(*) from public.stay_poll_votes v where v.option_id=o.id)
      ) order by o.sort_order,o.id)
      from public.stay_poll_options o where o.poll_id=p.id
    ),'[]'::jsonb)
  ) order by p.created_at desc),'[]'::jsonb)
  into result
  from public.stay_polls p
  where p.trip_id=target_trip;

  return result;
end;
$$;

create or replace function public.update_stay_poll(
  poll_token uuid,
  poll_title text,
  poll_status text,
  poll_options jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  target_poll uuid;
  item jsonb;
  option_id uuid;
  retained_ids uuid[] := '{}';
begin
  select p.id into target_poll
  from public.stay_polls p
  join public.trips t on t.id=p.trip_id
  where p.token=poll_token and t.owner_id=auth.uid();

  if target_poll is null then raise exception 'ไม่พบโพลหรือไม่มีสิทธิ์แก้ไข'; end if;
  if length(trim(poll_title))<1 then raise exception 'กรุณาใส่หัวข้อโหวต'; end if;
  if poll_status not in ('open','closed') then raise exception 'สถานะโพลไม่ถูกต้อง'; end if;
  if jsonb_array_length(poll_options)<2 then raise exception 'ต้องมีอย่างน้อย 2 ตัวเลือก'; end if;

  update public.stay_polls set title=trim(poll_title),status=poll_status where id=target_poll;

  for item in select value from jsonb_array_elements(poll_options)
  loop
    option_id := nullif(item->>'id','')::uuid;
    if option_id is not null and exists(select 1 from public.stay_poll_options where id=option_id and poll_id=target_poll) then
      update public.stay_poll_options set
        name=trim(item->>'name'),details=nullif(item->>'details',''),pros=nullif(item->>'pros',''),
        cons=nullif(item->>'cons',''),price=nullif(item->>'price','')::numeric,
        image_url=nullif(item->>'image_url',''),sort_order=coalesce((item->>'sort_order')::int,0)
      where id=option_id and poll_id=target_poll;
    else
      insert into public.stay_poll_options(poll_id,name,details,pros,cons,price,image_url,sort_order)
      values(target_poll,trim(item->>'name'),nullif(item->>'details',''),nullif(item->>'pros',''),
        nullif(item->>'cons',''),nullif(item->>'price','')::numeric,nullif(item->>'image_url',''),
        coalesce((item->>'sort_order')::int,0)) returning id into option_id;
    end if;
    retained_ids := array_append(retained_ids,option_id);
  end loop;

  delete from public.stay_poll_options where poll_id=target_poll and not(id=any(retained_ids));
end;
$$;

revoke all on function public.list_stay_polls(uuid) from public;
revoke all on function public.update_stay_poll(uuid,text,text,jsonb) from public;
grant execute on function public.list_stay_polls(uuid) to authenticated;
grant execute on function public.update_stay_poll(uuid,text,text,jsonb) to authenticated;
