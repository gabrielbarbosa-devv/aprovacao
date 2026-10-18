create table if not exists private.notification_push_attempts (
  id bigint generated always as identity primary key,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null,
  attempt_no smallint not null check (attempt_no between 1 and 5),
  outcome text not null check (outcome in ('sent', 'failed', 'subscription_removed')),
  response_status integer check (response_status between 100 and 599),
  attempted_at timestamptz not null default now(),
  unique (notification_id, subscription_id, attempt_no)
);
revoke all on table private.notification_push_attempts from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert on table private.notification_push_attempts to service_role;

drop function if exists public.claim_notification_push_batch();
create function public.claim_notification_push_batch()
returns table(notification_id uuid, title text, body text, target_url text, subscription_id uuid, endpoint text, p256dh text, auth_secret text, attempt_no smallint)
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
    returning n.id, n.user_id, n.title, n.body, n.target_url, n.push_attempts
  )
  select c.id, c.title, c.body, c.target_url, s.id, s.endpoint, s.p256dh, s.auth_secret, c.push_attempts
  from claimed c join public.notification_push_subscriptions s on s.user_id=c.user_id;
end;
$$;
revoke all on function public.claim_notification_push_batch() from public, anon, authenticated;
grant execute on function public.claim_notification_push_batch() to service_role;

create or replace function public.log_notification_push_attempt(
  p_notification_id uuid, p_subscription_id uuid, p_attempt_no smallint,
  p_outcome text, p_response_status integer
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  insert into private.notification_push_attempts(notification_id, subscription_id, attempt_no, outcome, response_status)
  values (p_notification_id, p_subscription_id, p_attempt_no, p_outcome, p_response_status)
  on conflict (notification_id, subscription_id, attempt_no) do nothing;
end;
$$;
revoke all on function public.log_notification_push_attempt(uuid,uuid,smallint,text,integer) from public, anon, authenticated;
grant execute on function public.log_notification_push_attempt(uuid,uuid,smallint,text,integer) to service_role;

create or replace function public.mark_notification_push_sent(p_notification_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  update public.notifications set push_sent_at=now(), updated_at=now()
  where id=p_notification_id and push_sent_at is null;
end;
$$;
revoke all on function public.mark_notification_push_sent(uuid) from public, anon, authenticated;
grant execute on function public.mark_notification_push_sent(uuid) to service_role;
