create or replace function public.save_todo_task_details_bundle(
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
  p_status text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_task_id uuid;
  v_subtask jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_task_id is null then
    raise exception 'Task not found';
  end if;
  if p_status not in ('todo', 'in_progress', 'done') then
    raise exception 'Invalid task status';
  end if;
  if not exists (
    select 1 from public.todo_tasks t
    where t.id = p_task_id and t.user_id = v_user_id and t.deleted_at is null
  ) then
    raise exception 'Task not found';
  end if;

  v_task_id := public.save_todo_task_bundle(
    p_task_id, p_list_id, p_workspace_id, p_title, p_description, p_priority,
    p_starts_on, p_due_on, p_due_at, p_label_ids, p_new_labels, p_subtasks
  );

  for v_subtask in
    select entry from jsonb_array_elements(p_subtasks) as items(entry)
    where not (entry ? 'id')
  loop
    insert into public.todo_activity_logs(user_id, task_id, action, metadata)
    values (v_user_id, v_task_id, 'updated', jsonb_build_object(
      'entity', 'subtask', 'change', 'added', 'title', btrim(v_subtask->>'title')
    ));
  end loop;

  update public.todo_tasks
  set status = p_status,
      completed_at = case
        when p_status = 'done' then coalesce(completed_at, now())
        else null
      end
  where id = v_task_id and user_id = v_user_id and deleted_at is null;

  return v_task_id;
end;
$function$;

revoke all on function public.save_todo_task_details_bundle(uuid, uuid, uuid, text, text, text, date, date, timestamptz, uuid[], text[], jsonb, text) from public, anon;
grant execute on function public.save_todo_task_details_bundle(uuid, uuid, uuid, text, text, text, date, date, timestamptz, uuid[], text[], jsonb, text) to authenticated;
