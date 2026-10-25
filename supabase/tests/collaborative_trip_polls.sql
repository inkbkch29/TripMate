-- Requires the designated ทดสอบ trip with two members. All fixtures roll back.
begin;
do $$
declare tid uuid;owner_uid uuid;member_uid uuid;other_uid uuid;tok uuid;ctok uuid;s jsonb;opts uuid[];x uuid;before_count integer;
begin
 select id,owner_id into tid,owner_uid from public.trips where name='ทดสอบ' limit 1;
 if tid is null then raise exception 'Test trip missing';end if;
 select user_id into member_uid from public.trip_members where trip_id=tid and user_id<>owner_uid limit 1;
 other_uid:=member_uid;
 if member_uid is null then raise exception 'Two test accounts needed';end if;
 update public.trips set start_date=current_date+1,end_date=current_date+3,status='planning' where id=tid;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_uid,'role','authenticated')::text,true);
 ctok:=public.trip_poll_save(tid,null,'QA member draft','{}','[{"name":"A"},{"name":"B"}]','draft');
 if not(public.trip_poll_snapshot(ctok)->>'can_manage')::boolean then raise exception 'Member creator cannot manage';end if;
 perform public.trip_poll_action(ctok,'close');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_uid,'role','authenticated')::text,true);
 tok:=public.trip_poll_save(tid,null,'QA collaborative',jsonb_build_object('vote_mode','multiple','allow_options',true,'auto_close',false,'result_visibility','after_vote'),'[{"name":"A"},{"name":"B"}]','open');
 s:=public.trip_poll_snapshot(tok);if not(s->>'can_manage')::boolean then raise exception 'Creator cannot manage';end if;
 select array_agg((v->>'id')::uuid) into opts from jsonb_array_elements(s->'options')v;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_uid,'role','authenticated')::text,true);
 s:=public.trip_poll_snapshot(tok);if (s->>'results_visible')::boolean or s->'options'->0->'votes'<>'null' then raise exception 'Hidden results leaked';end if;
 begin perform public.trip_poll_action(tok,'close');raise exception 'Non creator closed poll';exception when insufficient_privilege then null;end;
 x:=public.trip_poll_option_save(tok,'{"name":"Contribution","links":["https://vt.tiktok.com/abc/"]}');
 perform public.trip_poll_vote(tok,opts);perform public.trip_poll_vote(tok,opts);
 if (select count(*) from public.stay_poll_votes where poll_id=(s->>'id')::uuid and voter_key='user:'||other_uid::text)<>2 then raise exception 'Duplicate ballot';end if;
 perform public.trip_poll_vote(tok,array[opts[1]]);
 if (public.trip_poll_snapshot(tok)->>'total_ballots')::int<>1 then raise exception 'Ballot replacement duplicated member';end if;
 begin perform public.trip_poll_option_save(tok,jsonb_build_object('id',opts[1],'name','Changed'));raise exception 'Other member changed option';exception when insufficient_privilege then null;end;
 perform public.trip_poll_option_save(tok,jsonb_build_object('id',x),true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_uid,'role','authenticated')::text,true);
 begin perform public.trip_poll_option_save(tok,jsonb_build_object('id',opts[1],'name','Changed'));raise exception 'Voted option changed';exception when raise_exception then if sqlerrm='Voted option changed' then raise;end if;end;
 perform public.trip_poll_action(tok,'close');s:=public.trip_poll_snapshot(tok);if not(s->>'read_only')::boolean then raise exception 'Closed poll is writable';end if;
 perform public.trip_poll_action(tok,'reset');s:=public.trip_poll_snapshot(tok,1);if (s->>'total_ballots')::int<>1 then raise exception 'Reset erased history';end if;
 s:=public.trip_poll_snapshot(tok);if (s->>'current_round')::int<>2 or (s->>'total_ballots')::int<>0 then raise exception 'Round reset incorrect';end if;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 begin perform public.trip_poll_snapshot(tok);raise exception 'Anonymous snapshot access';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_uid,'role','authenticated')::text,true);
 perform public.trip_poll_action(tok,'close');
 if public.trip_poll_safe_link('javascript:alert(1)') or public.trip_poll_safe_link('https://localhost/a') then raise exception 'Unsafe URL accepted';end if;
 perform set_config('tripmate.qa_poll_result','passed',true);
end $$;
select current_setting('tripmate.qa_poll_result') as collaborative_poll_regression;

do $$
declare tid uuid;u uuid;m uuid;t uuid;d uuid;s jsonb;ids uuid[];n int;rev int;
begin
 select id,owner_id into tid,u from public.trips where name='ทดสอบ' limit 1;
 select user_id into m from public.trip_members where trip_id=tid and user_id<>u limit 1;
 update public.trips set start_date=current_date+1,end_date=current_date+3,status='planning' where id=tid;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 d:=public.trip_poll_save(tid,null,'QA private draft','{}','[{"name":"A"},{"name":"B"}]','draft');
 t:=public.trip_poll_save(tid,null,'QA auto close','{"auto_close":true}','[{"name":"A"},{"name":"B"}]','open');
 s:=public.trip_poll_snapshot(t);select array_agg((v->>'id')::uuid) into ids from jsonb_array_elements(s->'options')v;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',m,'role','authenticated')::text,true);
 begin perform public.trip_poll_snapshot(d);raise exception 'DRAFT LEAK';exception when insufficient_privilege then null;end;
 begin perform public.trip_poll_option_save(t,'{"name":"Disallowed"}');raise exception 'OPTION BYPASS';exception when insufficient_privilege then null;end;
 begin perform public.trip_poll_vote(t,ids);raise exception 'SINGLE BYPASS';exception when raise_exception then if sqlerrm='SINGLE BYPASS' then raise;end if;end;
 perform public.trip_poll_vote(t,array[ids[1]]);
 if (public.trip_poll_snapshot(t)->>'status')<>'open' then raise exception 'CLOSED TOO EARLY';end if;
 -- Removing a member does not change the stable electorate. Restore them inside rollback.
 select count(*) into n from public.trip_poll_eligible where poll_id=(s->>'id')::uuid;
 delete from public.trip_members where trip_id=tid and user_id=m;
 if (select count(*) from public.trip_poll_eligible where poll_id=(s->>'id')::uuid)<>n then raise exception 'UNSTABLE ELECTORATE';end if;
 insert into public.trip_members(trip_id,user_id,trip_role) values(tid,m,'member');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 perform public.trip_poll_vote(t,array[ids[2]]);s:=public.trip_poll_snapshot(t);
 if s->>'status'<>'closed' or (s->>'voter_count')::int<>2 or jsonb_array_length(s->'leader_ids')<>2 then raise exception 'AUTO CLOSE OR TIE ERROR';end if;
 begin perform public.cast_stay_vote(t,'spoof',array[ids[1]]);raise exception 'CLOSED BYPASS';exception when raise_exception then if sqlerrm='CLOSED BYPASS' then raise;end if;end;
 if not has_function_privilege('authenticated','public.trip_poll_vote(uuid,uuid[])','execute') or has_function_privilege('anon','public.trip_poll_vote(uuid,uuid[])','execute') then raise exception 'RPC GRANTS';end if;
 if has_function_privilege('authenticated','public.trip_poll_require(uuid)','execute') then raise exception 'HELPER EXPOSED';end if;
 perform public.trip_poll_action(t,'reset');
 rev:=(public.trip_poll_snapshot(t)->>'revision')::int;
 begin perform public.trip_poll_save(tid,t,'Conflict','{}','[{"name":"X"},{"name":"Y"}]','open',rev-1);raise exception 'STALE EDIT ACCEPTED';exception when raise_exception then if sqlerrm='STALE EDIT ACCEPTED' then raise;end if;end;
 perform public.trip_poll_action(t,'delete');
 if not exists(select 1 from public.stay_poll_votes where poll_id=(s->>'id')::uuid) then raise exception 'DELETE ERASED HISTORY';end if;
 begin perform public.trip_poll_snapshot(t);raise exception 'DELETED ACCESS';exception when insufficient_privilege then null;end;
end $$;
-- SQL roles, not only auth.uid(): direct table reads cannot bypass visibility.
set local role authenticated;
do $$begin
 begin perform * from public.trip_poll_ballots limit 1;raise exception 'BALLOT TABLE EXPOSED';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.stay_poll_votes) then raise exception 'VOTES RLS LEAK';end if;
end $$;
reset role;
select 'passed' as extended_poll_regression;
rollback;
