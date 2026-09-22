alter table public.user_notifications
  add column if not exists pushed_at timestamptz;

create index if not exists user_notifications_unpushed_idx
  on public.user_notifications(created_at)
  where pushed_at is null;
