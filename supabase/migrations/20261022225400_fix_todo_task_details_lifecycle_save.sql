-- Repair the optimistic-save wrapper after the lifecycle migration. This is an
-- additive function replacement and leaves task data and contest tables intact.
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
