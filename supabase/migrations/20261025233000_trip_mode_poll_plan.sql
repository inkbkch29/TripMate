begin;
lock table public.stay_polls,public.stay_poll_options,public.stay_poll_votes,public.trip_stops in access exclusive mode;
create temporary table preserved_travel_data on commit drop as select jsonb_build_object(
'polls',(select jsonb_build_array(count(*),md5(string_agg(md5(to_jsonb(p)::text),'' order by id))) from public.stay_polls p),
'options',(select jsonb_build_array(count(*),md5(string_agg(md5(to_jsonb(o)::text),'' order by id))) from public.stay_poll_options o),
'votes',(select jsonb_build_array(count(*),md5(string_agg(md5(to_jsonb(v)::text),'' order by poll_id,option_id,voter_key,round_no))) from public.stay_poll_votes v),
'stops',(select jsonb_build_array(count(*),md5(string_agg(md5(row(id,trip_id,day_number,start_time,title,place_name,latitude,longitude,note,sort_order,is_done,created_by,created_at,google_maps_url,revision,updated_at)::text),'' order by id))) from public.trip_stops)) as signature;
alter table public.trip_stops add column if not exists source_poll_id uuid,
 add column if not exists source_poll_option_id uuid,add column if not exists source_poll_token uuid,
 add column if not exists poll_option_snapshot jsonb,add column if not exists source_request_id uuid,
 add column if not exists price numeric(12,2),add column if not exists images jsonb not null default '[]',add column if not exists links jsonb not null default '[]';
create unique index if not exists poll_stop_option_day_unique on public.trip_stops(trip_id,source_poll_option_id,day_number) where source_poll_option_id is not null;
create unique index if not exists poll_stop_request_unique on public.trip_stops(source_request_id) where source_request_id is not null;
create or replace function public.can_add_trip_stop(target_trip uuid) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from public.trips t join public.trip_members m on m.trip_id=t.id and m.user_id=auth.uid() where t.id=target_trip and (t.owner_id=auth.uid() or m.trip_role='planner' or t.members_can_add_stops));$$;
create or replace function public.trip_poll_snapshot_base(poll_token uuid,requested_round integer default null) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare p public.stay_polls;r integer;manager boolean;visible boolean;closed_view boolean;voters integer;eligible integer;submitted integer;legacy_count integer;opts jsonb;my_ids jsonb;leaders jsonb;
begin
 p:=public.trip_poll_require(poll_token);r:=coalesce(requested_round,p.current_round);
 if r<1 or r>p.current_round then raise exception 'ไม่พบรอบโหวต';end if;
 manager:=public.trip_poll_manager(p);closed_view:=p.status='closed' or r<p.current_round or not public.trip_poll_active(p.trip_id);
 visible:=manager or p.result_visibility='live' or closed_view or (p.result_visibility='after_vote' and exists(select 1 from public.trip_poll_ballots where poll_id=p.id and round_no=r and user_id=auth.uid()));
 select count(distinct voter_key) into voters from public.stay_poll_votes where poll_id=p.id and round_no=r;
 select count(*) into eligible from public.trip_poll_eligible where poll_id=p.id;
 select count(*) into submitted from public.trip_poll_ballots b join public.trip_poll_eligible e on e.poll_id=b.poll_id and e.user_id=b.user_id where b.poll_id=p.id and b.round_no=r;
 select count(distinct voter_key) into legacy_count from public.stay_poll_votes where poll_id=p.id and round_no=r and voter_key not like 'user:%';
 select coalesce(jsonb_agg(option_id),'[]') into my_ids from public.stay_poll_votes where poll_id=p.id and round_no=r and voter_key='user:'||auth.uid()::text;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'details',o.details,'pros',o.pros,'cons',o.cons,'price',o.price,'image_url',o.image_url,'images',o.images,'links',o.links,'creator_id',o.created_by,
  'can_edit',not closed_view and (manager or o.created_by=auth.uid()) and not exists(select 1 from public.stay_poll_votes where option_id=o.id),
  'votes',case when visible then (select count(*) from public.stay_poll_votes v where v.option_id=o.id and v.round_no=r) else null end,
  'voters',case when visible then coalesce((select jsonb_agg(jsonb_build_object('id',v.voter_key,'name',coalesce(pr.display_name,v.voter_name),'avatar',pr.avatar_url)) from public.stay_poll_votes v left join public.profiles pr on v.voter_key='user:'||pr.id::text where v.option_id=o.id and v.round_no=r),'[]') else '[]'::jsonb end) order by o.sort_order,o.id),'[]') into opts from public.stay_poll_options o where o.poll_id=p.id and (o.removed_at is null or exists(select 1 from public.stay_poll_votes v where v.option_id=o.id and v.round_no=r));
 if visible and voters>0 then select coalesce(jsonb_agg(x->'id'),'[]') into leaders from jsonb_array_elements(opts) x where (x->>'votes')::int=(select max((y->>'votes')::int) from jsonb_array_elements(opts)y);else leaders:='[]';end if;
 return jsonb_build_object('id',p.id,'token',p.token,'trip_id',p.trip_id,'title',p.title,'status',p.status,'poll_type',p.poll_type,'created_at',p.created_at,'creator_id',p.created_by,'creator_name',coalesce(p.creator_name,(select display_name from public.profiles where id=p.created_by)),'revision',p.revision,'vote_mode',p.vote_mode,'allow_options',p.allow_options,'auto_close',p.auto_close,'result_visibility',p.result_visibility,'current_round',p.current_round,'round',r,'results_visible',visible,'read_only',closed_view,'can_manage',manager,'can_vote',not closed_view and p.status='open' and exists(select 1 from public.trip_poll_eligible where poll_id=p.id and user_id=auth.uid()),'can_add_options',not closed_view and (manager or p.allow_options),'member_count',eligible,'voter_count',submitted,'total_ballots',case when visible then voters else null end,'legacy_count',legacy_count,'my_votes',my_ids,'leader_ids',leaders,'winner_option_id',case when r<p.current_round then (select winner_option_id from public.trip_poll_round_history where poll_id=p.id and round_no=r) else p.winner_option_id end,'options',opts,'trip',(select jsonb_build_object('id',id,'name',name,'start_date',start_date,'end_date',end_date,'status',status) from public.trips where id=p.trip_id));
end $$;
create or replace function public.trip_poll_snapshot(poll_token uuid,requested_round integer default null) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare s jsonb;opts jsonb;
begin
 s:=public.trip_poll_snapshot_base(poll_token,requested_round);
 select coalesce(jsonb_agg(o||jsonb_build_object('planned_stops',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'tripId',t.trip_id,'day',t.day_number,'time',to_char(t.start_time,'HH24:MI'),'title',t.title) order by t.day_number) from public.trip_stops t where t.trip_id=(s->>'trip_id')::uuid and t.source_poll_option_id=(o->>'id')::uuid),'[]'))),'[]') into opts from jsonb_array_elements(s->'options')o;
 return s||jsonb_build_object('options',opts,'can_add_to_plan',public.can_add_trip_stop((s->>'trip_id')::uuid) and (s->>'results_visible')::boolean and (s->>'read_only')::boolean and s->>'status'<>'draft');
end $$;
create or replace function public.poll_option_to_plan(poll_token uuid,source_option uuid,plan_data jsonb,allow_another_day boolean default false,request_key uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.stay_polls;o public.stay_poll_options;t public.trips;s public.trip_stops;snap jsonb;d integer;tm time;ttl text;pl text;nt text;pr numeric;lnks jsonb;imgs jsonb;url text;lat double precision;lng double precision;point text[];
begin
 p:=public.trip_poll_require(poll_token);
 select * into t from public.trips where id=p.trip_id for update;
 if not public.can_add_trip_stop(t.id) then raise exception 'คุณไม่มีสิทธิ์เพิ่มแพลนในทริปนี้' using errcode='42501';end if;
 -- Same lock order as poll mutation: a poll lock protects its snapshot while creating the stop.
 select * into p from public.stay_polls where id=p.id for update;
 if p.deleted_at is not null then raise exception 'โพลนี้ไม่พร้อมใช้งาน';end if;
 snap:=public.trip_poll_snapshot(poll_token,coalesce((plan_data->>'round')::int,p.current_round));
 if not(snap->>'can_add_to_plan')::boolean then raise exception 'เพิ่มลงแพลนได้จากผลโหวตที่ปิดแล้วเท่านั้น' using errcode='42501';end if;
 select * into o from public.stay_poll_options where id=source_option and poll_id=p.id;
 if o.id is null or not exists(select 1 from jsonb_array_elements(snap->'options')x where x->>'id'=o.id::text) then raise exception 'ไม่พบตัวเลือกในผลโหวตนี้';end if;
 if request_key is null then raise exception 'ไม่พบรหัสคำขอบันทึก';end if;
 select * into s from public.trip_stops where source_request_id=request_key;
 if s.id is not null then
  if s.trip_id<>t.id or s.source_poll_option_id<>o.id then raise exception 'รหัสคำขอบันทึกถูกใช้แล้ว';end if;
  return jsonb_build_object('already_exists',false,'stop',to_jsonb(s));
 end if;
 d:=(plan_data->>'day')::int;tm:=nullif(plan_data->>'time','')::time;ttl:=trim(plan_data->>'title');pl:=coalesce(trim(plan_data->>'place'),'');nt:=nullif(trim(plan_data->>'note'),'');pr:=nullif(plan_data->>'price','')::numeric;
 if d is null or d<1 or d>t.end_date-t.start_date+1 or tm is null or ttl is null or length(ttl) not between 1 and 180 or length(pl)>200 or length(coalesce(nt,''))>3000 or pr<0 or pr>9999999999.99 then raise exception 'ตรวจวันที่ เวลา ชื่อกิจกรรม และรายละเอียด';end if;
 select * into s from public.trip_stops where trip_id=t.id and source_poll_option_id=o.id and (not allow_another_day or day_number=d) order by day_number limit 1;
 if s.id is not null then return jsonb_build_object('already_exists',true,'stop',to_jsonb(s));end if;
 lnks:=coalesce(plan_data->'links',o.links,'[]');imgs:=coalesce(plan_data->'images',o.images,'[]');
 if jsonb_typeof(lnks)<>'array' or jsonb_array_length(lnks)>6 or jsonb_typeof(imgs)<>'array' or jsonb_array_length(imgs)>12 then raise exception 'ตรวจลิงก์และรูปภาพ';end if;
 for url in select jsonb_array_elements_text(lnks) loop if url is null or not public.trip_poll_safe_link(url) then raise exception 'ลิงก์ต้องเป็น HTTPS ที่ปลอดภัย';end if;end loop;
 for url in select jsonb_array_elements_text(imgs) loop if url is null or not(coalesce(o.images,'[]')?url or url=any(string_to_array(replace(coalesce(o.image_url,''),E'\\n',E'\n'),E'\n'))) then raise exception 'ใช้รูปจากตัวเลือกโหวตเดิมเท่านั้น';end if;end loop;
 -- Accept reliable explicit coordinates only from the Maps URL, never from arbitrary numbers in TikTok URLs.
 url:=nullif(plan_data->>'googleMapsUrl','');
 if url is not null and (not public.trip_poll_safe_link(url) or not(lnks?url) or url !~ '^https://(maps\.app\.goo\.gl([/?#]|$)|maps\.google\.com([/?#]|$)|(www\.)?google\.(com|co\.th)/maps([/?#]|$))') then raise exception 'ตรวจลิงก์ Google Maps';end if;
 -- Derive only explicit place pins or coordinate queries; never camera centers, directions or TikTok IDs.
 if url is not null and url !~ '/dir/' and (select count(*) from regexp_matches(url,'!3d[-0-9.]+!4d[-0-9.]+','g'))<=1 then
  point:=regexp_match(url,'!3d(-?[0-9]+(?:\.[0-9]+)?)!4d(-?[0-9]+(?:\.[0-9]+)?)');
  if point is null then point:=regexp_match(url,'[?&](?:query|q)=(-?[0-9]+(?:\.[0-9]+)?)(?:,|%2[Cc])(-?[0-9]+(?:\.[0-9]+)?)(?:&|$)');end if;
  if point is null then point:=regexp_match(url,'/maps/place/(-?[0-9]+(?:\.[0-9]+)?),(-?[0-9]+(?:\.[0-9]+)?)(?:/|$)');end if;
  if point is not null then lat:=point[1]::double precision;lng:=point[2]::double precision;if abs(lat)>90 or abs(lng)>180 then lat:=null;lng:=null;end if;end if;
 end if;
 insert into public.trip_stops(trip_id,day_number,start_time,title,place_name,note,price,images,links,google_maps_url,latitude,longitude,sort_order,created_by,source_poll_id,source_poll_option_id,source_poll_token,poll_option_snapshot,source_request_id)
 values(t.id,d,tm,ttl,pl,nt,pr,imgs,lnks,url,lat,lng,coalesce((select max(sort_order)+1 from public.trip_stops where trip_id=t.id and day_number=d),0),auth.uid(),p.id,o.id,p.token,to_jsonb(o)||jsonb_build_object('poll_title',p.title,'round',(snap->>'round')::int,'captured_at',now()),request_key) returning * into s;
 return jsonb_build_object('already_exists',false,'stop',to_jsonb(s));
end $$;
-- Explicit consent and expiry apply to direct table access as well as the current-location RPC.
create or replace function public.trip_location_is_shared(target_trip uuid,target_user uuid) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and public.is_trip_member(target_trip) and exists(select 1 from public.trips t join public.location_consents c on c.trip_id=t.id and c.user_id=target_user join public.trip_members m on m.trip_id=t.id and m.user_id=target_user where t.id=target_trip and t.status not in ('completed','cancelled') and (now() at time zone 'Asia/Bangkok')::date between t.start_date and t.end_date and c.revoked_at is null and c.auto_stop_at>now());$$;
drop policy if exists "members read locations" on public.live_locations;
drop policy if exists "users manage own location" on public.live_locations;
create or replace function public.trip_location_is_current(target_trip uuid,target_user uuid,changed_at timestamptz) returns boolean language sql stable security definer set search_path=public as $$select public.trip_location_is_shared(target_trip,target_user) and exists(select 1 from public.location_consents where trip_id=target_trip and user_id=target_user and changed_at>=consented_at and changed_at<=now()+interval '1 minute');$$;
create policy "members read consented locations" on public.live_locations for select to authenticated using(public.is_trip_member(trip_id) and (user_id=auth.uid() or (sharing_enabled and updated_at>=now()-interval '30 minutes' and public.trip_location_is_current(trip_id,user_id,updated_at))));
create policy "users insert consented location" on public.live_locations for insert to authenticated with check(user_id=auth.uid() and public.is_trip_member(trip_id) and (not sharing_enabled or public.trip_location_is_shared(trip_id,user_id)));
create policy "users update own consented location" on public.live_locations for update to authenticated using(user_id=auth.uid() and public.is_trip_member(trip_id)) with check(user_id=auth.uid() and public.is_trip_member(trip_id) and (not sharing_enabled or public.trip_location_is_shared(trip_id,user_id)));
create policy "users delete own location" on public.live_locations for delete to authenticated using(user_id=auth.uid() and public.is_trip_member(trip_id));
create or replace function public.trip_live_locations(target_trip uuid) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.is_trip_member(target_trip) then raise exception 'เฉพาะสมาชิกในทริปเท่านั้น' using errcode='42501';end if;
 update public.live_locations l set sharing_enabled=false where l.trip_id=target_trip and l.sharing_enabled and not public.trip_location_is_shared(l.trip_id,l.user_id);
 return coalesce((select jsonb_agg(jsonb_build_object('trip_id',l.trip_id,'user_id',l.user_id,'latitude',case when l.updated_at>=now()-interval '30 minutes' and public.trip_location_is_current(l.trip_id,l.user_id,l.updated_at) then l.latitude else null end,'longitude',case when l.updated_at>=now()-interval '30 minutes' and public.trip_location_is_current(l.trip_id,l.user_id,l.updated_at) then l.longitude else null end,'accuracy_m',l.accuracy_m,'updated_at',l.updated_at,'sharing_enabled',true,'sharing_until',c.auto_stop_at,'consented_at',c.consented_at)) from public.live_locations l join public.location_consents c on c.trip_id=l.trip_id and c.user_id=l.user_id where l.trip_id=target_trip and l.sharing_enabled and public.trip_location_is_shared(l.trip_id,l.user_id)),'[]');
end $$;
revoke all on function public.trip_poll_snapshot_base(uuid,integer),public.can_add_trip_stop(uuid) from public,anon,authenticated;
revoke all on function public.poll_option_to_plan(uuid,uuid,jsonb,boolean,uuid),public.trip_live_locations(uuid),public.trip_location_is_shared(uuid,uuid),public.trip_location_is_current(uuid,uuid,timestamptz) from public,anon;
grant execute on function public.poll_option_to_plan(uuid,uuid,jsonb,boolean,uuid),public.trip_live_locations(uuid),public.trip_location_is_shared(uuid,uuid),public.trip_location_is_current(uuid,uuid,timestamptz) to authenticated;
do $$begin if (select signature from preserved_travel_data) is distinct from (select jsonb_build_object(
'polls',(select jsonb_build_array(count(*),md5(string_agg(md5(to_jsonb(p)::text),'' order by id))) from public.stay_polls p),
'options',(select jsonb_build_array(count(*),md5(string_agg(md5(to_jsonb(o)::text),'' order by id))) from public.stay_poll_options o),
'votes',(select jsonb_build_array(count(*),md5(string_agg(md5(to_jsonb(v)::text),'' order by poll_id,option_id,voter_key,round_no))) from public.stay_poll_votes v),
'stops',(select jsonb_build_array(count(*),md5(string_agg(md5(row(id,trip_id,day_number,start_time,title,place_name,latitude,longitude,note,sort_order,is_done,created_by,created_at,google_maps_url,revision,updated_at)::text),'' order by id))) from public.trip_stops))) then raise exception 'Existing trip data integrity check failed';end if;end $$;
select 'preserved' as existing_trip_data,(select count(*) from public.trip_stops) as stops,(select count(*) from public.stay_polls) as polls,(select count(*) from public.stay_poll_options) as options,(select count(*) from public.stay_poll_votes) as votes;
notify pgrst,'reload schema';
commit;
