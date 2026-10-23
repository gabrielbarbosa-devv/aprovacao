-- Extend task lifecycle without removing task rows or modifying contest data.
alter table public.todo_tasks
  add column archived_at timestamptz;

create index todo_tasks_user_archived_idx
  on public.todo_tasks (user_id, archived_at desc)
  where archived_at is not null and deleted_at is null;

create index todo_tasks_user_trash_idx
  on public.todo_tasks (user_id, deleted_at desc)
  where deleted_at is not null;

create index todo_tasks_user_active_status_due_idx
  on public.todo_tasks (user_id, status, due_on)
  where deleted_at is null and archived_at is null;

create index todo_tasks_user_active_list_position_idx
  on public.todo_tasks (user_id, list_id, position)
  where deleted_at is null and archived_at is null;

create index todo_tasks_user_active_workspace_position_idx
  on public.todo_tasks (user_id, workspace_id, position)
  where deleted_at is null and archived_at is null;

create index todo_tasks_user_active_starts_on_idx
  on public.todo_tasks (user_id, starts_on)
  where deleted_at is null and archived_at is null;

alter table public.todo_activity_logs
  drop constraint todo_activity_logs_action_check;
alter table public.todo_activity_logs
  add constraint todo_activity_logs_action_check
  check (action in ('created', 'updated', 'status_changed', 'completed', 'reopened', 'soft_deleted', 'archived', 'restored'));

create or replace function public.log_todo_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed jsonb := '{}'::jsonb;
  log_action text;
begin
  if tg_op = 'INSERT' then
    log_action := 'created';
    changed := jsonb_build_object('status', new.status, 'priority', new.priority, 'list_id', new.list_id, 'workspace_id', new.workspace_id);
  else
    if old.status is distinct from new.status then
      log_action := case when new.status = 'done' then 'completed' when old.status = 'done' then 'reopened' else 'status_changed' end;
      changed := changed || jsonb_build_object('status', jsonb_build_object('from', old.status, 'to', new.status));
    elsif old.deleted_at is null and new.deleted_at is not null then
      log_action := 'soft_deleted';
      changed := changed || jsonb_build_object('deleted_at', new.deleted_at);
    elsif (old.deleted_at is not null and new.deleted_at is null)
       or (old.archived_at is not null and new.archived_at is null) then
      log_action := 'restored';
      changed := changed || jsonb_build_object('restored_at', pg_catalog.now());
    elsif old.archived_at is null and new.archived_at is not null then
      log_action := 'archived';
      changed := changed || jsonb_build_object('archived_at', new.archived_at);
    else
      log_action := 'updated';
    end if;
    if old.priority is distinct from new.priority then changed := changed || jsonb_build_object('priority', jsonb_build_object('from', old.priority, 'to', new.priority)); end if;
    if old.due_on is distinct from new.due_on then changed := changed || jsonb_build_object('due_on', jsonb_build_object('from', old.due_on, 'to', new.due_on)); end if;
    if old.due_at is distinct from new.due_at then changed := changed || jsonb_build_object('due_at', jsonb_build_object('from', old.due_at, 'to', new.due_at)); end if;
    if old.list_id is distinct from new.list_id then changed := changed || jsonb_build_object('list_id', jsonb_build_object('from', old.list_id, 'to', new.list_id)); end if;
    if old.workspace_id is distinct from new.workspace_id then changed := changed || jsonb_build_object('workspace_id', jsonb_build_object('from', old.workspace_id, 'to', new.workspace_id)); end if;
    if old.title is distinct from new.title then changed := changed || jsonb_build_object('title_changed', true); end if;
    if old.description is distinct from new.description then changed := changed || jsonb_build_object('description_changed', true); end if;
    if changed = '{}'::jsonb then return new; end if;
  end if;

  insert into public.todo_activity_logs(user_id, task_id, action, metadata)
  values (new.user_id, new.id, log_action, changed);
  return new;
end;
$$;
revoke all on function public.log_todo_task_activity() from public, anon, authenticated;

create or replace function public.save_todo_task_details_if_unchanged(
  p_task_id uuid,
  p_list_id uuid,
  p_workspace_id uuid,
  p_title text,
  p_description text,
  p_priority text,
  p_starts_on date,
  p_due_on date,
  p_due_at timestamptz,
  p_label_ids uuid[],
  p_new_labels text[],
  p_subtasks jsonb,
  p_status text,
  p_expected_updated_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_task_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select task.id
    into v_task_id
    from public.todo_tasks as task
    where task.id = p_task_id
      and task.user_id = v_user_id
      and task.deleted_at is null
      and task.archived_at is null
      and task.updated_at = p_expected_updated_at
    for update;

  if v_task_id is null then
    raise exception 'Task changed or is unavailable. Reload before saving.' using errcode = '40001';
  end if;

  return public.save_todo_task_details_bundle(
    p_task_id, p_list_id, p_workspace_id, p_title, p_description, p_priority,
    p_starts_on, p_due_on, p_due_at, p_label_ids, p_new_labels, p_subtasks, p_status
  );
end;
$function$;

revoke all on function public.save_todo_task_details_if_unchanged(uuid, uuid, uuid, text, text, text, date, date, timestamptz, uuid[], text[], jsonb, text, timestamptz) from public, anon;
grant execute on function public.save_todo_task_details_if_unchanged(uuid, uuid, uuid, text, text, text, date, date, timestamptz, uuid[], text[], jsonb, text, timestamptz) to authenticated;
