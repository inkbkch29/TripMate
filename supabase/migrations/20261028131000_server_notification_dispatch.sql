begin;
create extension if not exists pg_net with schema extensions;
create function public.queue_trip_activity_push(activity bigint)returns void language plpgsql security definer set search_path=public as $queue$
declare endpoint text;key text;secret text;
begin
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='tripmate_push_url';
 select decrypted_secret into key from vault.decrypted_secrets where name='tripmate_push_public_key';
 select decrypted_secret into secret from vault.decrypted_secrets where name='tripmate_push_dispatch_secret';
 if endpoint is null or key is null or secret is null then return;end if;
 perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||key,'x-tripmate-dispatch',secret),body:=jsonb_build_object('activityId',activity),timeout_milliseconds:=10000);
 exception when others then raise warning 'Push dispatch could not be queued';
end $queue$;
revoke all on function public.queue_trip_activity_push(bigint)from public,anon,authenticated;


do $$declare d text;begin
select pg_get_functiondef('public.notify_trip_activity()'::regprocedure)into d;
d:=replace(d,' return new;', ' if exists(select 1 from public.user_notifications where dedupe_key=''activity:''||new.id)then perform public.queue_trip_activity_push(new.id);end if; return new;');execute d;end$$;
commit;
