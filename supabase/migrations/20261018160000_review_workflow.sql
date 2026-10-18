-- Review outcomes extend the existing obligations instead of creating a second store.
alter table public.review_tasks
  add column if not exists reviewed_on date,
  add column if not exists review_question_count integer,
  add column if not exists review_correct_count integer,
  add column if not exists review_notes text;

alter table public.review_tasks drop constraint if exists review_tasks_review_outcome_check;
alter table public.review_tasks add constraint review_tasks_review_outcome_check check (
  (review_question_count is null and review_correct_count is null)
  or (review_question_count >= 0 and review_correct_count >= 0 and review_correct_count <= review_question_count)
);
alter table public.review_tasks drop constraint if exists review_tasks_review_notes_check;
alter table public.review_tasks add constraint review_tasks_review_notes_check
  check (review_notes is null or pg_catalog.length(review_notes) <= 2000);
create unique index if not exists review_tasks_one_reinforcement_per_parent
  on public.review_tasks(parent_review_id)
  where review_kind = 'reinforcement' and parent_review_id is not null;

-- SECURITY DEFINER is required because clients have read-only grants on review_tasks;
-- each function derives auth.uid(), locks the owner-scoped row, and writes atomically.
create or replace function public.complete_review_task(
  p_review_id uuid,
  p_reviewed_on date,
  p_difficulty smallint,
  p_question_count integer,
  p_correct_count integer,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_task public.review_tasks%rowtype;
  v_timezone text;
  v_today date;
  v_reinforcement_id uuid;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_difficulty not in (1, 3, 5)
    or ((p_question_count is null) <> (p_correct_count is null))
    or (p_question_count is not null and (p_question_count < 0 or p_correct_count < 0
      or p_correct_count > p_question_count or p_question_count > 100000)) then
    raise exception 'invalid review outcome' using errcode = '22023';
  end if;
  if p_notes is not null and pg_catalog.length(p_notes) > 2000 then
    raise exception 'review notes are too long' using errcode = '22023';
  end if;

  select timezone into v_timezone from public.user_settings where user_id = v_user_id;
  v_timezone := coalesce(v_timezone, 'America/Sao_Paulo');
  v_today := (pg_catalog.now() at time zone v_timezone)::date;
  if p_reviewed_on > v_today then raise exception 'review date is in the future' using errcode = '22023'; end if;

  select * into v_task from public.review_tasks
    where id = p_review_id and user_id = v_user_id for update;
  if not found then raise exception 'review not found' using errcode = 'P0002'; end if;
  if v_task.status = 'completed' then
    return pg_catalog.jsonb_build_object('status', 'already_completed');
  end if;
  if v_task.status <> 'pending' then raise exception 'review is not pending' using errcode = '55000'; end if;

  update public.review_tasks set
    status = 'completed', completed_at = pg_catalog.now(), reviewed_on = p_reviewed_on,
    difficulty = p_difficulty, review_question_count = p_question_count,
    review_correct_count = p_correct_count, review_notes = nullif(pg_catalog.btrim(p_notes), '')
    where id = v_task.id and user_id = v_user_id;
  insert into public.review_events(user_id, review_task_id, action, old_due_on, new_due_on, notes)
    values (v_user_id, v_task.id, 'completed', v_task.due_on, p_reviewed_on, nullif(pg_catalog.btrim(p_notes), ''));

  if p_difficulty = 5 then
    insert into public.review_tasks(
      user_id, study_session_id, topic_id, review_kind, interval_days, due_on, initial_due_on, parent_review_id
    ) values (
      v_user_id, v_task.study_session_id, v_task.topic_id, 'reinforcement', 2,
      p_reviewed_on + 2, p_reviewed_on + 2, v_task.id
    ) on conflict do nothing returning id into v_reinforcement_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'status', 'completed', 'reinforcement_created', v_reinforcement_id is not null,
    'reinforcement_id', v_reinforcement_id
  );
end;
$$;

create or replace function public.snooze_review_task(p_review_id uuid, p_new_due_on date, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_task public.review_tasks%rowtype;
  v_timezone text;
  v_today date;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_reason is not null and pg_catalog.length(p_reason) > 500 then
    raise exception 'reason is too long' using errcode = '22023';
  end if;
  select timezone into v_timezone from public.user_settings where user_id = v_user_id;
  v_timezone := coalesce(v_timezone, 'America/Sao_Paulo');
  v_today := (pg_catalog.now() at time zone v_timezone)::date;
  if p_new_due_on <= v_today then raise exception 'new due date must be in the future' using errcode = '22023'; end if;

  select * into v_task from public.review_tasks
    where id = p_review_id and user_id = v_user_id for update;
  if not found then raise exception 'review not found' using errcode = 'P0002'; end if;
  if v_task.status <> 'pending' then raise exception 'review is not pending' using errcode = '55000'; end if;
  if v_task.due_on = p_new_due_on then return pg_catalog.jsonb_build_object('status', 'already_scheduled'); end if;

  update public.review_tasks set due_on = p_new_due_on where id = v_task.id and user_id = v_user_id;
  insert into public.review_events(user_id, review_task_id, action, old_due_on, new_due_on, notes)
    values (v_user_id, v_task.id, 'rescheduled', v_task.due_on, p_new_due_on, nullif(pg_catalog.btrim(p_reason), ''));
  return pg_catalog.jsonb_build_object('status', 'rescheduled');
end;
$$;

revoke all on function public.complete_review_task(uuid, date, smallint, integer, integer, text) from public, anon;
revoke all on function public.snooze_review_task(uuid, date, text) from public, anon;
grant execute on function public.complete_review_task(uuid, date, smallint, integer, integer, text) to authenticated;
grant execute on function public.snooze_review_task(uuid, date, text) to authenticated;
