create or replace function public.claim_notification_push_batch()
returns table(notification_id uuid, title text, body text, target_url text, subscription_id uuid, endpoint text, p256dh text, auth_secret text, attempt_no smallint)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  perform public.process_notification_queue();
  return query
  with candidates as (
    select n.id from public.notifications n
    join public.user_settings p on p.user_id=n.user_id and p.browser_push_enabled
      and ((n.category='study' and p.notifications_study_enabled)
        or (n.category='review' and p.notifications_reviews_enabled)
        or (n.category='pending' and p.notifications_pending_enabled))
    where n.push_sent_at is null and n.push_attempts < 3 and n.scheduled_for <= now()
      and n.resolved_at is null and n.dismissed_at is null
      and (n.push_last_attempt_at is null or n.push_last_attempt_at < now() - interval '10 minutes')
      and not case
        when p.quiet_hours_start is null or p.quiet_hours_end is null then false
        when p.quiet_hours_start = p.quiet_hours_end then true
        when p.quiet_hours_start < p.quiet_hours_end then
          (now() at time zone case when exists (select 1 from pg_catalog.pg_timezone_names z where z.name=p.timezone) then p.timezone else 'America/Sao_Paulo' end)::time >= p.quiet_hours_start
          and (now() at time zone case when exists (select 1 from pg_catalog.pg_timezone_names z where z.name=p.timezone) then p.timezone else 'America/Sao_Paulo' end)::time < p.quiet_hours_end
        else
          (now() at time zone case when exists (select 1 from pg_catalog.pg_timezone_names z where z.name=p.timezone) then p.timezone else 'America/Sao_Paulo' end)::time >= p.quiet_hours_start
          or (now() at time zone case when exists (select 1 from pg_catalog.pg_timezone_names z where z.name=p.timezone) then p.timezone else 'America/Sao_Paulo' end)::time < p.quiet_hours_end
      end
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
