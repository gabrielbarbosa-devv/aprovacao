-- Internal, user-scoped notification center. Notifications are derived from
-- current study_blocks/review_tasks state; this migration never changes either.
alter table public.user_settings
  add column if not exists notifications_study_enabled boolean not null default false,
  add column if not exists notifications_reviews_enabled boolean not null default false,
  add column if not exists notifications_pending_enabled boolean not null default false,
  add column if not exists daily_reminder_time time,
  add column if not exists reminder_lead_minutes smallint not null default 30
    check (reminder_lead_minutes between 0 and 1440),
  add column if not exists quiet_hours_start time,
  add column if not exists quiet_hours_end time,
  add column if not exists browser_push_enabled boolean not null default false;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('study', 'review', 'pending')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  target_url text not null check (target_url like '/%' and target_url not like '//%'),
  related_entity_id uuid,
  local_date date not null,
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 180),
  scheduled_for timestamptz not null,
  read_at timestamptz,
  dismissed_at timestamptz,
  resolved_at timestamptz,
  push_sent_at timestamptz,
  push_attempts smallint not null default 0 check (push_attempts between 0 and 5),
  push_last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_key),
  unique (id, user_id)
);

create index if not exists notifications_owner_recent_idx
  on public.notifications(user_id, created_at desc) where dismissed_at is null and resolved_at is null;
create index if not exists notifications_owner_unread_idx
  on public.notifications(user_id, created_at desc) where read_at is null and dismissed_at is null and resolved_at is null;

alter table public.notifications enable row level security;
revoke all on table public.notifications from anon, authenticated;
grant select (id, user_id, category, title, body, target_url, related_entity_id, local_date, dedupe_key, scheduled_for, read_at, dismissed_at, resolved_at, created_at, updated_at) on table public.notifications to authenticated;
grant update (read_at, dismissed_at) on public.notifications to authenticated;
create policy notifications_owner_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_owner_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.notification_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null,
  auth_secret text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists notification_push_subscriptions_owner_idx on public.notification_push_subscriptions(user_id);
alter table public.notification_push_subscriptions enable row level security;
revoke all on table public.notification_push_subscriptions from anon, authenticated;
grant select (id, user_id, endpoint, created_at, last_used_at) on table public.notification_push_subscriptions to authenticated;
grant insert (user_id, endpoint, p256dh, auth_secret) on table public.notification_push_subscriptions to authenticated;
grant delete on table public.notification_push_subscriptions to authenticated;
create policy notification_push_owner_select on public.notification_push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy notification_push_owner_insert on public.notification_push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy notification_push_owner_delete on public.notification_push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Called by the authenticated app for read-your-own-writes and by the trusted
-- scheduler for all opted-in users. Unique keys make concurrent calls safe.
create or replace function private.process_notifications_for_user(p_user_id uuid, p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_settings public.user_settings%rowtype;
  v_timezone text;
  v_local_date date;
  v_local_time time;
  v_quiet boolean := false;
  v_count integer := 0;
  v_rows integer := 0;
  v_block_count integer;
  v_minutes integer;
  v_first_block uuid;
  v_review_count integer;
  v_due_reviews integer;
  v_reminder_at timestamptz;
  v_body text;
begin
  select * into v_settings from public.user_settings where user_id = p_user_id;
  if not found then return 0; end if;
  v_timezone := case when exists (select 1 from pg_catalog.pg_timezone_names where name = v_settings.timezone)
    then v_settings.timezone else 'America/Sao_Paulo' end;
  v_local_date := p_now at time zone v_timezone;
  v_local_time := (p_now at time zone v_timezone)::time;
  v_quiet := case
    when v_settings.quiet_hours_start is null or v_settings.quiet_hours_end is null then false
    when v_settings.quiet_hours_start = v_settings.quiet_hours_end then true
    when v_settings.quiet_hours_start < v_settings.quiet_hours_end
      then v_local_time >= v_settings.quiet_hours_start and v_local_time < v_settings.quiet_hours_end
    else v_local_time >= v_settings.quiet_hours_start or v_local_time < v_settings.quiet_hours_end
  end;
  if v_quiet then return 0; end if;
  v_reminder_at := ((v_local_date + coalesce(v_settings.daily_reminder_time, time '06:00')) at time zone v_timezone);

  if v_settings.notifications_study_enabled then
    select count(*), coalesce(sum(b.planned_minutes), 0), (array_agg(b.id order by b.sort_order, b.id))[1]
      into v_block_count, v_minutes, v_first_block
    from public.study_blocks b
    join public.topics t on t.id = b.topic_id and t.user_id = b.user_id and t.archived_at is null
    join public.subjects s on s.id = t.subject_id and s.user_id = b.user_id and s.archived_at is null
    where b.user_id = p_user_id and b.planned_date = v_local_date and b.status in ('planejado', 'em_andamento')
      and ((b.planned_start_time is null and v_settings.daily_reminder_time is not null and v_local_time >= v_settings.daily_reminder_time)
        or (b.planned_start_time is not null and v_local_time >= b.planned_start_time - make_interval(mins => v_settings.reminder_lead_minutes)));
    if v_block_count > 0 then
      v_body := case when v_block_count = 1 then
        (select s.name || ' — ' || t.title from public.study_blocks b join public.topics t on t.id=b.topic_id and t.user_id=b.user_id join public.subjects s on s.id=t.subject_id and s.user_id=t.user_id where b.id=v_first_block and b.user_id=p_user_id)
        else v_block_count::text || ' blocos planejados hoje (' || round(v_minutes::numeric / 60, 1)::text || ' h).' end;
      insert into public.notifications(user_id, category, title, body, target_url, related_entity_id, local_date, dedupe_key, scheduled_for)
      values (p_user_id, 'study', 'Seu planejamento de hoje está disponível.', v_body, '/', null, v_local_date, 'study:' || v_local_date::text, v_reminder_at)
      on conflict (user_id, dedupe_key) do update set title=excluded.title, body=excluded.body,
        target_url=excluded.target_url, related_entity_id=excluded.related_entity_id,
        scheduled_for=excluded.scheduled_for, updated_at=now(), resolved_at=null
      where public.notifications.dismissed_at is null;
      get diagnostics v_rows = row_count;
      v_count := v_count + v_rows;
    end if;
  end if;

  if v_settings.notifications_reviews_enabled and v_settings.daily_reminder_time is not null and v_local_time >= v_settings.daily_reminder_time then
    select count(*) into v_review_count from public.review_tasks r
    where r.user_id=p_user_id and r.status='pending' and r.due_on <= v_local_date;
    if v_review_count > 0 then
      select count(*) into v_due_reviews from public.review_tasks r
      where r.user_id=p_user_id and r.status='pending' and r.due_on < v_local_date;
      v_body := case when v_due_reviews > 0 then v_review_count::text || ' revisões pendentes, incluindo ' || v_due_reviews::text || ' atrasadas.'
        else v_review_count::text || ' revisões vencem hoje.' end;
      insert into public.notifications(user_id, category, title, body, target_url, local_date, dedupe_key, scheduled_for)
      values (p_user_id, 'review', case when v_due_reviews > 0 then 'Você tem revisões atrasadas.' else 'Suas revisões de hoje estão prontas.' end,
        v_body, '/revisoes', v_local_date, 'review:' || v_local_date::text, v_reminder_at)
      on conflict (user_id, dedupe_key) do update set title=excluded.title, body=excluded.body,
        scheduled_for=excluded.scheduled_for, updated_at=now(), resolved_at=null
      where public.notifications.dismissed_at is null;
      get diagnostics v_rows = row_count;
      v_count := v_count + v_rows;
    end if;
  end if;

  if v_settings.notifications_pending_enabled and v_settings.daily_reminder_time is not null and v_local_time >= v_settings.daily_reminder_time then
    select count(*), (array_agg(b.id order by b.planned_date, b.sort_order, b.id))[1]
      into v_block_count, v_first_block
    from public.study_blocks b join public.topics t on t.id=b.topic_id and t.user_id=b.user_id and t.archived_at is null
    where b.user_id=p_user_id and b.planned_date < v_local_date and b.status in ('planejado','em_andamento');
    if v_block_count > 0 then
      insert into public.notifications(user_id, category, title, body, target_url, related_entity_id, local_date, dedupe_key, scheduled_for)
      values (p_user_id, 'pending', 'Você tem um estudo pendente.', 'Continue pelo bloco mais antigo no Planejamento. As datas originais foram preservadas.', '/planejamento', v_first_block, v_local_date,
        'pending:' || v_first_block::text, v_reminder_at)
      on conflict (user_id, dedupe_key) do update set body=excluded.body, related_entity_id=excluded.related_entity_id,
        scheduled_for=excluded.scheduled_for, updated_at=now(), resolved_at=null
      where public.notifications.dismissed_at is null;
      get diagnostics v_rows = row_count;
      v_count := v_count + v_rows;
    end if;
  end if;

  update public.notifications n set resolved_at=now(), updated_at=now()
  where n.user_id=p_user_id and n.resolved_at is null and n.dismissed_at is null
    and ((n.category='study' and (not v_settings.notifications_study_enabled or n.local_date < v_local_date or not exists (
          select 1 from public.study_blocks b where b.user_id=p_user_id and b.planned_date=n.local_date and b.status in ('planejado','em_andamento'))))
      or (n.category='review' and (not v_settings.notifications_reviews_enabled or n.local_date < v_local_date or not exists (
          select 1 from public.review_tasks r where r.user_id=p_user_id and r.status='pending' and r.due_on<=n.local_date)))
      or (n.category='pending' and (not v_settings.notifications_pending_enabled or not exists (
          select 1 from public.study_blocks b where b.id=n.related_entity_id and b.user_id=p_user_id and b.planned_date<v_local_date and b.status in ('planejado','em_andamento')))));
  return v_count;
end;
$$;

create or replace function public.sync_my_notifications()
returns integer language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  return private.process_notifications_for_user(auth.uid(), now());
end;
$$;
revoke all on function public.sync_my_notifications() from public, anon;
grant execute on function public.sync_my_notifications() to authenticated;

create or replace function public.save_notification_preferences(
  p_study_enabled boolean, p_reviews_enabled boolean, p_pending_enabled boolean,
  p_daily_reminder_time time, p_reminder_lead_minutes smallint,
  p_quiet_hours_start time, p_quiet_hours_end time, p_browser_push_enabled boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_reminder_lead_minutes not between 0 and 1440 then raise exception 'invalid reminder lead time' using errcode='22023'; end if;
  insert into public.user_settings(user_id, notifications_study_enabled, notifications_reviews_enabled,
    notifications_pending_enabled, daily_reminder_time, reminder_lead_minutes, quiet_hours_start, quiet_hours_end, browser_push_enabled)
  values (v_user_id, p_study_enabled, p_reviews_enabled, p_pending_enabled, p_daily_reminder_time,
    p_reminder_lead_minutes, p_quiet_hours_start, p_quiet_hours_end, p_browser_push_enabled)
  on conflict (user_id) do update set notifications_study_enabled=excluded.notifications_study_enabled,
    notifications_reviews_enabled=excluded.notifications_reviews_enabled,
    notifications_pending_enabled=excluded.notifications_pending_enabled,
    daily_reminder_time=excluded.daily_reminder_time, reminder_lead_minutes=excluded.reminder_lead_minutes,
    quiet_hours_start=excluded.quiet_hours_start, quiet_hours_end=excluded.quiet_hours_end,
    browser_push_enabled=excluded.browser_push_enabled;
end;
$$;
revoke all on function public.save_notification_preferences(boolean,boolean,boolean,time,smallint,time,time,boolean) from public, anon;
grant execute on function public.save_notification_preferences(boolean,boolean,boolean,time,smallint,time,time,boolean) to authenticated;

create or replace function public.process_notification_queue()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_user record; v_total integer := 0;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  for v_user in select user_id from public.user_settings where notifications_study_enabled or notifications_reviews_enabled or notifications_pending_enabled loop
    v_total := v_total + private.process_notifications_for_user(v_user.user_id, now());
  end loop;
  return v_total;
end;
$$;
revoke all on function public.process_notification_queue() from public, anon, authenticated;
grant execute on function public.process_notification_queue() to service_role;

create or replace function public.claim_notification_push_batch()
returns table(notification_id uuid, title text, body text, target_url text, endpoint text, p256dh text, auth_secret text)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  perform public.process_notification_queue();
  return query
  with candidates as (
    select n.id from public.notifications n
    join public.user_settings p on p.user_id=n.user_id and p.browser_push_enabled
    where n.push_sent_at is null and n.push_attempts < 3 and n.scheduled_for <= now()
      and n.resolved_at is null and n.dismissed_at is null
      and (n.push_last_attempt_at is null or n.push_last_attempt_at < now() - interval '10 minutes')
      and exists (select 1 from public.notification_push_subscriptions s where s.user_id=n.user_id)
    order by n.scheduled_for, n.created_at limit 100 for update of n skip locked
  ), claimed as (
    update public.notifications n set push_attempts=n.push_attempts+1, push_last_attempt_at=now(), updated_at=now()
    from candidates c where n.id=c.id
    returning n.id, n.user_id, n.title, n.body, n.target_url
  )
  select c.id, c.title, c.body, c.target_url, s.endpoint, s.p256dh, s.auth_secret
  from claimed c join public.notification_push_subscriptions s on s.user_id=c.user_id;
end;
$$;
revoke all on function public.claim_notification_push_batch() from public, anon, authenticated;
grant execute on function public.claim_notification_push_batch() to service_role;
