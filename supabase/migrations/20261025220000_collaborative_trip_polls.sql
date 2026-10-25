begin;
-- Lock briefly while checking that every legacy poll, option and vote remains identical.
lock table public.stay_polls,public.stay_poll_options,public.stay_poll_votes in access exclusive mode;
create temporary table preserved_poll_data on commit drop as select jsonb_build_object(
 'polls', (select jsonb_build_array(count(*),md5(string_agg(md5(row(id,trip_id,token,title,status,created_by,created_at,poll_type,auto_close,winner_option_id,closed_at)::text),'' order by id))) from public.stay_polls),
 'options', (select jsonb_build_array(count(*),md5(string_agg(md5(row(id,poll_id,name,details,pros,cons,price,image_url,sort_order)::text),'' order by id))) from public.stay_poll_options),
 'votes', (select jsonb_build_array(count(*),md5(string_agg(md5(row(poll_id,option_id,voter_key,voter_name,created_at)::text),'' order by poll_id,option_id,voter_key))) from public.stay_poll_votes)) as signature;
alter table public.stay_polls drop constraint if exists stay_polls_status_check;
alter table public.stay_polls add constraint stay_polls_status_check check(status in ('draft','open','closed'));
alter table public.stay_polls add column if not exists vote_mode text not null default 'single' check(vote_mode in ('single','multiple')),
 add column if not exists allow_options boolean not null default false,
 add column if not exists result_visibility text not null default 'live' check(result_visibility in ('live','after_vote','closed')),
 add column if not exists current_round integer not null default 1,
 add column if not exists revision integer not null default 1,
 add column if not exists deleted_at timestamptz, add column if not exists creator_name text;
update public.stay_polls p set creator_name=pr.display_name from public.profiles pr where pr.id=p.created_by and p.creator_name is null;
alter table public.stay_poll_options add column if not exists created_by uuid references public.profiles(id),
 add column if not exists images jsonb not null default '[]', add column if not exists links jsonb not null default '[]', add column if not exists removed_at timestamptz;
update public.stay_poll_options o set created_by=p.created_by from public.stay_polls p where p.id=o.poll_id and o.created_by is null;
alter table public.stay_poll_votes add column if not exists round_no integer not null default 1;
drop index if exists public.stay_poll_votes_one_choice_per_voter;
alter table public.stay_poll_votes drop constraint stay_poll_votes_pkey;
alter table public.stay_poll_votes add primary key(poll_id,option_id,voter_key,round_no);
create table if not exists public.trip_poll_eligible(poll_id uuid not null references public.stay_polls(id) on delete cascade,user_id uuid not null references public.profiles(id),primary key(poll_id,user_id));
create table if not exists public.trip_poll_ballots(poll_id uuid not null references public.stay_polls(id) on delete cascade,user_id uuid not null references public.profiles(id),round_no integer not null,submitted_at timestamptz not null default now(),primary key(poll_id,user_id,round_no));
alter table public.trip_poll_eligible enable row level security;
alter table public.trip_poll_ballots enable row level security;
create table if not exists public.trip_poll_round_history(poll_id uuid not null references public.stay_polls(id) on delete cascade,round_no integer not null,winner_option_id uuid,closed_at timestamptz,primary key(poll_id,round_no));
alter table public.trip_poll_round_history enable row level security;
-- Snapshot membership once for historical polls. No existing votes are deleted or renamed.
insert into public.trip_poll_eligible select p.id,m.user_id from public.stay_polls p join public.trip_members m on m.trip_id=p.trip_id on conflict do nothing;
insert into public.trip_poll_ballots(poll_id,user_id,round_no,submitted_at)
 select v.poll_id,p.id,1,max(v.created_at) from public.stay_poll_votes v join public.profiles p on v.voter_key='user:'||p.id::text group by v.poll_id,p.id on conflict do nothing;
create index if not exists poll_votes_round_idx on public.stay_poll_votes(poll_id,round_no);

create or replace function public.trip_poll_manager(p public.stay_polls) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (p.created_by=auth.uid() or exists(select 1 from public.trips t where t.id=p.trip_id and t.owner_id=auth.uid())); $$;
create or replace function public.trip_poll_active(target_trip uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.trips where id=target_trip and status not in ('completed','cancelled') and end_date>=(now() at time zone 'Asia/Bangkok')::date); $$;
create or replace function public.trip_poll_require(poll_token uuid) returns public.stay_polls language plpgsql stable security definer set search_path=public as $$
declare p public.stay_polls;
begin
 select * into p from public.stay_polls where token=poll_token and deleted_at is null;
 if p.id is null or auth.uid() is null or not public.is_trip_member(p.trip_id) then raise exception 'กรุณาเข้าสู่ระบบด้วยบัญชีสมาชิกในทริป' using errcode='42501'; end if;
 if p.status='draft' and not public.trip_poll_manager(p) then raise exception 'ร่างโหวตนี้ยังไม่เปิด' using errcode='42501'; end if;
 return p;
end $$;
create or replace function public.trip_poll_safe_link(value text) returns boolean language sql immutable as $$
 select length(value)<=2048 and value ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}(:443)?([/?#][^[:space:]\\]*)?$'
 and lower(value) !~ '^https://[^/?#]+\.(local|localhost)([/?#]|$)'
 and lower(value) !~ '^https://([^/]*@|localhost[/:]|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.)'; $$;

create or replace function public.trip_poll_option_save(poll_token uuid,option_data jsonb,remove_option boolean default false) returns uuid
language plpgsql security definer set search_path=public as $$
declare p public.stay_polls;o public.stay_poll_options;oid uuid;manager boolean;v text;imgs jsonb;lnks jsonb;nm text;d text;pr numeric;legacy text;
begin
 p:=public.trip_poll_require(poll_token);select * into p from public.stay_polls where id=p.id for update;if p.deleted_at is not null then raise exception 'ไม่พบโหวตนี้';end if;
 manager:=public.trip_poll_manager(p);
 if not public.trip_poll_active(p.trip_id) or p.status='closed' then raise exception 'โหวตนี้อ่านได้อย่างเดียว'; end if;
 oid:=nullif(option_data->>'id','')::uuid;
 if oid is not null then
  if option_data?'expected_revision' and (option_data->>'expected_revision')::int<>p.revision then raise exception 'โหวตมีการอัปเดต กรุณาเปิดตัวเลือกใหม่';end if;
  select * into o from public.stay_poll_options where id=oid and poll_id=p.id and removed_at is null;
  if o.id is null or not(manager or o.created_by=auth.uid()) then raise exception 'แก้ไขได้เฉพาะตัวเลือกของตนเอง' using errcode='42501'; end if;
 else
  if not manager and not(p.status='open' and p.allow_options) then raise exception 'ยังไม่อนุญาตให้เพิ่มตัวเลือก' using errcode='42501'; end if;
  if (select count(*) from public.stay_poll_options where poll_id=p.id and removed_at is null)>=50 then raise exception 'เพิ่มได้ไม่เกิน 50 ตัวเลือก'; end if;
 end if;
 if remove_option then
  if o.id is null then raise exception 'ไม่พบตัวเลือก'; end if;
  if exists(select 1 from public.stay_poll_votes where option_id=o.id) then raise exception 'ตัวเลือกนี้มีคะแนนแล้ว จึงลบไม่ได้'; end if;
  if (select count(*) from public.stay_poll_options where poll_id=p.id and removed_at is null)<=2 then raise exception 'ต้องมีอย่างน้อย 2 ตัวเลือก'; end if;
  update public.stay_poll_options set removed_at=now() where id=o.id;
 else
  nm:=trim(option_data->>'name');d:=nullif(trim(option_data->>'details'),'');pr:=nullif(option_data->>'price','')::numeric;
  imgs:=coalesce(option_data->'images','[]');lnks:=coalesce(option_data->'links','[]');legacy:=case when option_data?'image_url' then nullif(option_data->>'image_url','') else o.image_url end;
  if nm is null or length(nm) not between 1 and 160 or length(coalesce(d,''))>3000 or pr<0 or pr>9999999999.99 then raise exception 'ตรวจชื่อ ราคา และรายละเอียดตัวเลือก'; end if;
  if jsonb_typeof(imgs)<>'array' or jsonb_array_length(imgs)>6 or jsonb_typeof(lnks)<>'array' or jsonb_array_length(lnks)>3 then raise exception 'แนบได้ไม่เกิน 6 รูป และ 3 ลิงก์'; end if;
  if exists(select 1 from jsonb_array_elements(imgs)x where jsonb_typeof(x)<>'string') or exists(select 1 from jsonb_array_elements(lnks)x where jsonb_typeof(x)<>'string') then raise exception 'ตรวจรูปภาพและลิงก์อีกครั้ง';end if;
  for v in select jsonb_array_elements_text(lnks) loop if not public.trip_poll_safe_link(v) then raise exception 'ลิงก์ต้องเป็น HTTPS ที่ปลอดภัย'; end if;end loop;
  for v in select jsonb_array_elements_text(imgs) loop
   if not public.trip_poll_safe_link(v) and not(v like p.trip_id::text||'/'||auth.uid()::text||'/poll-photo-%') and not(coalesce(o.images,'[]')?v) then raise exception 'รูปภาพต้องเป็นไฟล์ของทริปนี้'; end if;
  end loop;
  if o.id is not null and exists(select 1 from public.stay_poll_votes where option_id=o.id) then
   if o.name is distinct from nm or o.details is distinct from d or o.price is distinct from pr or o.images is distinct from imgs or o.links is distinct from lnks or o.image_url is distinct from legacy then raise exception 'ตัวเลือกนี้มีคะแนนแล้ว จึงแก้ไขไม่ได้'; end if;
   return o.id;
  end if;
  if o.id is not null then update public.stay_poll_options set name=nm,details=d,price=pr,images=imgs,links=lnks,image_url=legacy where id=o.id;
  else insert into public.stay_poll_options(poll_id,name,details,price,images,links,created_by,sort_order) values(p.id,nm,d,pr,imgs,lnks,auth.uid(),coalesce((select max(sort_order)+1 from public.stay_poll_options where poll_id=p.id),0)) returning id into oid;end if;
 end if;
 update public.stay_polls set revision=revision+1 where id=p.id;return oid;
end $$;

create or replace function public.trip_poll_save(target_trip uuid,poll_token uuid,poll_title text,poll_settings jsonb,poll_options jsonb,target_status text default 'open',expected_revision integer default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare p public.stay_polls;is_new boolean:=poll_token is null;item jsonb;kept uuid[]:='{}';oid uuid;mode text:=coalesce(poll_settings->>'vote_mode','single');visibility text:=coalesce(poll_settings->>'result_visibility','live');allow_more boolean:=coalesce((poll_settings->>'allow_options')::boolean,false);auto_end boolean:=coalesce((poll_settings->>'auto_close')::boolean,false);kind text:=coalesce(poll_settings->>'poll_type','other');
begin
 if auth.uid() is null or not public.is_trip_member(target_trip) then raise exception 'เฉพาะสมาชิกในทริปเท่านั้น' using errcode='42501'; end if;
 if not public.trip_poll_active(target_trip) then raise exception 'ทริปนี้อ่านโหวตย้อนหลังได้อย่างเดียว'; end if;
 if length(trim(coalesce(poll_title,''))) not between 1 and 180 or target_status not in ('draft','open') or mode not in ('single','multiple') or visibility not in ('live','after_vote','closed') or kind not in ('stay','place','activity','other') or jsonb_typeof(poll_options)<>'array' or jsonb_array_length(poll_options) not between 2 and 50 then raise exception 'ตรวจหัวข้อ การตั้งค่า และตัวเลือกอย่างน้อย 2 ข้อ'; end if;
 if is_new then
  insert into public.stay_polls(trip_id,title,status,created_by,vote_mode,allow_options,result_visibility,poll_type,auto_close,creator_name) values(target_trip,trim(poll_title),'draft',auth.uid(),mode,allow_more,visibility,kind,auto_end,(select display_name from public.profiles where id=auth.uid())) returning * into p;
 else
  p:=public.trip_poll_require(poll_token);select * into p from public.stay_polls where id=p.id for update;if p.deleted_at is not null then raise exception 'ไม่พบโหวตนี้';end if;
  if p.trip_id<>target_trip or not public.trip_poll_manager(p) then raise exception 'ไม่มีสิทธิ์แก้ไขโหวตนี้' using errcode='42501'; end if;
  if expected_revision is null or expected_revision<>p.revision then raise exception 'โหวตมีการอัปเดตจากเพื่อน กรุณาเปิดใหม่ก่อนแก้ไข'; end if;
  if p.status='closed' or (p.status='open' and target_status='draft') then raise exception 'โหวตนี้เปลี่ยนกลับเป็นร่างไม่ได้'; end if;
  if exists(select 1 from public.stay_poll_votes where poll_id=p.id) and (p.vote_mode<>mode or p.result_visibility<>visibility or p.allow_options<>allow_more or p.auto_close<>auto_end) then raise exception 'มีคะแนนแล้ว จึงเปลี่ยนกติกาโหวตไม่ได้'; end if;
  update public.stay_polls set title=trim(poll_title),vote_mode=mode,allow_options=allow_more,result_visibility=visibility,poll_type=kind,auto_close=auto_end where id=p.id;
 end if;
 for item in select jsonb_array_elements(poll_options) loop oid:=public.trip_poll_option_save(p.token,item,false);kept:=array_append(kept,oid);end loop;
 for oid in select id from public.stay_poll_options where poll_id=p.id and removed_at is null and not(id=any(kept)) loop perform public.trip_poll_option_save(p.token,jsonb_build_object('id',oid),true);end loop;
 if target_status='open' and p.status='draft' then insert into public.trip_poll_eligible select p.id,user_id from public.trip_members where trip_id=p.trip_id on conflict do nothing;end if;
 update public.stay_polls set status=target_status,revision=revision+1 where id=p.id;
 return p.token;
end $$;

create or replace function public.trip_poll_vote(poll_token uuid,option_ids uuid[]) returns void language plpgsql security definer set search_path=public as $$
declare p public.stay_polls;ids uuid[];display text;n integer;
begin
 p:=public.trip_poll_require(poll_token);select * into p from public.stay_polls where id=p.id for update;if p.deleted_at is not null then raise exception 'ไม่พบโหวตนี้';end if;
 if p.status<>'open' or not public.trip_poll_active(p.trip_id) then raise exception 'โหวตนี้ปิดแล้ว'; end if;
 if not exists(select 1 from public.trip_poll_eligible where poll_id=p.id and user_id=auth.uid()) then raise exception 'คุณเข้าร่วมหลังเปิดโหวต จึงดูผลและเพิ่มตัวเลือกได้ แต่ไม่มีสิทธิ์โหวตรอบนี้' using errcode='42501'; end if;
 select array_agg(distinct x) into ids from unnest(option_ids) x;
 n:=coalesce(cardinality(ids),0);
 if n<1 or (p.vote_mode='single' and n<>1) or n>50 or (select count(*) from public.stay_poll_options where poll_id=p.id and id=any(ids) and removed_at is null)<>n then raise exception 'เลือกตัวเลือกให้ตรงตามกติกา'; end if;
 select coalesce(nullif(display_name,''),'สมาชิก') into display from public.profiles where id=auth.uid();
 insert into public.trip_poll_ballots(poll_id,user_id,round_no) values(p.id,auth.uid(),p.current_round) on conflict(poll_id,user_id,round_no) do update set submitted_at=now();
 delete from public.stay_poll_votes where poll_id=p.id and voter_key='user:'||auth.uid()::text and round_no=p.current_round;
 insert into public.stay_poll_votes(poll_id,option_id,voter_key,voter_name,round_no) select p.id,x,'user:'||auth.uid()::text,display,p.current_round from unnest(ids) x;
 update public.stay_polls set revision=revision+1 where id=p.id;
 if p.auto_close and not exists(select 1 from public.trip_poll_eligible e where e.poll_id=p.id and not exists(select 1 from public.trip_poll_ballots b where b.poll_id=p.id and b.round_no=p.current_round and b.user_id=e.user_id)) then
  update public.stay_polls set status='closed',closed_at=now() where id=p.id;
 end if;
end $$;

create or replace function public.trip_poll_action(poll_token uuid,poll_action text) returns void language plpgsql security definer set search_path=public as $$
declare p public.stay_polls;
begin
 p:=public.trip_poll_require(poll_token);select * into p from public.stay_polls where id=p.id for update;if p.deleted_at is not null then raise exception 'ไม่พบโหวตนี้';end if;
 if not public.trip_poll_manager(p) then raise exception 'เฉพาะผู้สร้างหรือเจ้าของทริปเท่านั้น' using errcode='42501'; end if;
 if not public.trip_poll_active(p.trip_id) and poll_action<>'close' then raise exception 'ทริปนี้ดูย้อนหลังได้อย่างเดียว';end if;
 if poll_action='delete' then update public.stay_polls set deleted_at=now(),revision=revision+1 where id=p.id;return;end if;
 if poll_action='close' then update public.stay_polls set status='closed',closed_at=coalesce(closed_at,now()),revision=revision+1 where id=p.id;return;end if;
 if not public.trip_poll_active(p.trip_id) then raise exception 'ทริปนี้ดูย้อนหลังได้อย่างเดียว'; end if;
 if poll_action='reset' then
  insert into public.trip_poll_round_history(poll_id,round_no,winner_option_id,closed_at) values(p.id,p.current_round,p.winner_option_id,coalesce(p.closed_at,now())) on conflict do nothing;
  update public.stay_polls set current_round=current_round+1,status='open',closed_at=null,winner_option_id=null,revision=revision+1 where id=p.id;
  insert into public.trip_poll_eligible select p.id,user_id from public.trip_members where trip_id=p.trip_id and not exists(select 1 from public.trip_poll_eligible where poll_id=p.id) on conflict do nothing;
 elsif poll_action='publish' and p.status='draft' then
  if (select count(*) from public.stay_poll_options where poll_id=p.id and removed_at is null)<2 then raise exception 'ต้องมีอย่างน้อย 2 ตัวเลือก';end if;
  insert into public.trip_poll_eligible select p.id,user_id from public.trip_members where trip_id=p.trip_id on conflict do nothing;
  update public.stay_polls set status='open',revision=revision+1 where id=p.id;
 else raise exception 'คำสั่งโหวตไม่ถูกต้อง';end if;
end $$;

create or replace function public.trip_poll_snapshot(poll_token uuid,requested_round integer default null) returns jsonb language plpgsql stable security definer set search_path=public as $$
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
create or replace function public.trip_poll_list(target_trip uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.is_trip_member(target_trip) then raise exception 'เฉพาะสมาชิกในทริปเท่านั้น' using errcode='42501';end if;
 return coalesce((select jsonb_agg(public.trip_poll_snapshot(p.token) order by p.created_at desc) from public.stay_polls p where trip_id=target_trip and deleted_at is null and (status<>'draft' or public.trip_poll_manager(p))),'[]'::jsonb);
end $$;
-- Existing links and older clients use the same checked implementation.
create or replace function public.stay_poll_snapshot(poll_token uuid) returns jsonb language sql stable security definer set search_path=public as $$select public.trip_poll_snapshot(poll_token);$$;
create or replace function public.list_trip_vote_links(target_trip uuid) returns jsonb language sql stable security definer set search_path=public as $$select public.trip_poll_list(target_trip);$$;
create or replace function public.list_stay_polls(target_trip uuid) returns jsonb language sql stable security definer set search_path=public as $$select public.trip_poll_list(target_trip);$$;
create or replace function public.cast_stay_vote(poll_token uuid,voter text,option_ids uuid[]) returns void language sql security definer set search_path=public as $$select public.trip_poll_vote(poll_token,option_ids);$$;
create or replace function public.reset_stay_poll_votes(poll_token uuid) returns void language sql security definer set search_path=public as $$select public.trip_poll_action(poll_token,'reset');$$;
create or replace function public.create_stay_poll(target_trip uuid,poll_title text,poll_options jsonb) returns uuid language sql security definer set search_path=public as $$select public.trip_poll_save(target_trip,null,poll_title,'{}',poll_options,'open',null);$$;
create or replace function public.update_stay_poll(poll_token uuid,poll_title text,poll_status text,poll_options jsonb) returns void language plpgsql security definer set search_path=public as $$
declare p public.stay_polls;begin p:=public.trip_poll_require(poll_token);perform public.trip_poll_save(p.trip_id,p.token,poll_title,jsonb_build_object('vote_mode',p.vote_mode,'allow_options',p.allow_options,'auto_close',p.auto_close,'result_visibility',p.result_visibility,'poll_type',p.poll_type),poll_options,case when poll_status='closed' then 'open' else poll_status end,p.revision);if poll_status='closed' then perform public.trip_poll_action(p.token,'close');end if;end $$;
create or replace function public.configure_trip_poll(poll_token uuid,target_type text,should_auto_close boolean) returns void language plpgsql security definer set search_path=public as $$
declare p public.stay_polls;begin p:=public.trip_poll_require(poll_token);if not public.trip_poll_manager(p) or not public.trip_poll_active(p.trip_id) then raise exception 'ไม่มีสิทธิ์แก้ไข' using errcode='42501';end if;select * into p from public.stay_polls where id=p.id for update;if p.deleted_at is not null then raise exception 'ไม่พบโหวตนี้';end if;if exists(select 1 from public.stay_poll_votes where poll_id=p.id) then raise exception 'มีคะแนนแล้ว เปลี่ยนกติกาไม่ได้';end if;update public.stay_polls set poll_type=target_type,auto_close=should_auto_close,revision=revision+1 where id=p.id;end $$;
create or replace function public.select_stay_poll_winner(poll_token uuid,option_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare p public.stay_polls;begin p:=public.trip_poll_require(poll_token);select * into p from public.stay_polls where id=p.id for update;if p.deleted_at is not null then raise exception 'ไม่พบโหวตนี้';end if;if not public.trip_poll_manager(p) or not public.trip_poll_active(p.trip_id) or p.status<>'open' then raise exception 'ไม่มีสิทธิ์เปลี่ยนผลโหวต' using errcode='42501';end if;if not exists(select 1 from public.stay_poll_options o where o.id=option_id and o.poll_id=p.id and removed_at is null) then raise exception 'ไม่พบตัวเลือก';end if;update public.stay_polls set winner_option_id=option_id,status='closed',closed_at=now(),revision=revision+1 where id=p.id;end $$;
-- No direct table access; all mutation and visibility rules live in the RPCs.
revoke all on public.trip_poll_eligible,public.trip_poll_ballots,public.trip_poll_round_history from anon,authenticated;
do $$ declare f record;begin for f in select oid::regprocedure as signature,proname from pg_proc where pronamespace='public'::regnamespace and proname like 'trip_poll_%' loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);if f.proname in ('trip_poll_list','trip_poll_snapshot','trip_poll_save','trip_poll_vote','trip_poll_option_save','trip_poll_action') then execute format('grant execute on function %s to authenticated',f.signature);end if;end loop;end $$;
revoke all on function public.stay_poll_snapshot(uuid),public.cast_stay_vote(uuid,text,uuid[]) from anon;
do $$begin if (select signature from preserved_poll_data) is distinct from (select jsonb_build_object(
 'polls', (select jsonb_build_array(count(*),md5(string_agg(md5(row(id,trip_id,token,title,status,created_by,created_at,poll_type,auto_close,winner_option_id,closed_at)::text),'' order by id))) from public.stay_polls),
 'options', (select jsonb_build_array(count(*),md5(string_agg(md5(row(id,poll_id,name,details,pros,cons,price,image_url,sort_order)::text),'' order by id))) from public.stay_poll_options),
 'votes', (select jsonb_build_array(count(*),md5(string_agg(md5(row(poll_id,option_id,voter_key,voter_name,created_at)::text),'' order by poll_id,option_id,voter_key))) from public.stay_poll_votes))) then raise exception 'Legacy poll integrity check failed';end if;end $$;
select 'preserved' as legacy_poll_data,(select count(*) from public.stay_polls) as polls,(select count(*) from public.stay_poll_options) as options,(select count(*) from public.stay_poll_votes) as votes;
notify pgrst,'reload schema';
commit;
