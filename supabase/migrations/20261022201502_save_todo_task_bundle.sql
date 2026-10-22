create or replace function public.save_todo_task_bundle(
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
  p_subtasks jsonb
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
  v_subtask_id uuid;
  v_position integer := 0;
  v_label_name text;
  v_label_id uuid;
  v_label_ids uuid[];
  v_existing_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if length(btrim(p_title)) not between 1 and 240 then
    raise exception 'Task title must contain between 1 and 240 characters';
  end if;
  if p_priority not in ('low', 'medium', 'high') then
    raise exception 'Invalid task priority';
  end if;
  if p_due_on is not null and p_due_on < p_starts_on then
    raise exception 'Due date cannot be before start date';
  end if;
  if p_due_at is not null and p_due_on is null then
    raise exception 'A deadline time requires a due date';
  end if;
  if coalesce(cardinality(p_label_ids), 0) > 50
     or coalesce(cardinality(p_new_labels), 0) > 30
     or coalesce(jsonb_typeof(p_subtasks), '') <> 'array'
     or jsonb_array_length(p_subtasks) > 50 then
    raise exception 'Too many task relations';
  end if;

  if p_task_id is null then
    insert into public.todo_tasks (user_id, list_id, workspace_id, title, description, priority, starts_on, due_on, due_at)
    values (v_user_id, p_list_id, p_workspace_id, btrim(p_title), nullif(btrim(p_description), ''), p_priority, p_starts_on, p_due_on, p_due_at)
    returning id into v_task_id;
  else
    update public.todo_tasks
    set list_id = p_list_id,
        workspace_id = p_workspace_id,
        title = btrim(p_title),
        description = nullif(btrim(p_description), ''),
        priority = p_priority,
        starts_on = p_starts_on,
        due_on = p_due_on,
        due_at = p_due_at
    where id = p_task_id and user_id = v_user_id and deleted_at is null
    returning id into v_task_id;
    if v_task_id is null then
      raise exception 'Task not found';
    end if;
  end if;

  select count(*) into v_existing_count
  from public.todo_subtasks s
  where s.user_id = v_user_id and s.task_id = v_task_id
    and s.id in (
      select (entry->>'id')::uuid
      from jsonb_array_elements(p_subtasks) as items(entry)
      where entry ? 'id'
    );
  if v_existing_count <> (
    select count(*) from jsonb_array_elements(p_subtasks) as items(entry) where entry ? 'id'
  ) then
    raise exception 'One or more subtasks do not belong to this task';
  end if;

  delete from public.todo_subtasks s
  where s.user_id = v_user_id and s.task_id = v_task_id
    and not exists (
      select 1 from jsonb_array_elements(p_subtasks) as items(entry)
      where entry ? 'id' and (entry->>'id')::uuid = s.id
    );

  for v_subtask in select entry from jsonb_array_elements(p_subtasks) as items(entry)
  loop
    if length(btrim(coalesce(v_subtask->>'title', ''))) not between 1 and 240 then
      raise exception 'Subtask title must contain between 1 and 240 characters';
    end if;
    if v_subtask ? 'id' then
      update public.todo_subtasks
      set title = btrim(v_subtask->>'title'),
          is_completed = coalesce((v_subtask->>'is_completed')::boolean, false),
          position = v_position
      where id = (v_subtask->>'id')::uuid and task_id = v_task_id and user_id = v_user_id;
    else
      insert into public.todo_subtasks (user_id, task_id, title, is_completed, position)
      values (v_user_id, v_task_id, btrim(v_subtask->>'title'), coalesce((v_subtask->>'is_completed')::boolean, false), v_position);
    end if;
    v_position := v_position + 1;
  end loop;

  if coalesce(cardinality(p_label_ids), 0) > 0 then
    select count(*) into v_existing_count
    from public.todo_labels l
    where l.user_id = v_user_id and l.id = any(p_label_ids);
    if v_existing_count <> (select count(distinct ids.id) from unnest(p_label_ids) as ids(id)) then
      raise exception 'One or more labels do not belong to this user';
    end if;
  end if;

  v_label_ids := coalesce(p_label_ids, array[]::uuid[]);
  foreach v_label_name in array coalesce(p_new_labels, array[]::text[])
  loop
    if length(btrim(v_label_name)) not between 1 and 60 then
      raise exception 'Label name must contain between 1 and 60 characters';
    end if;
    insert into public.todo_labels (user_id, name)
    values (v_user_id, btrim(v_label_name))
    on conflict (user_id, lower(name)) do update set name = excluded.name
    returning id into v_label_id;
    v_label_ids := array_append(v_label_ids, v_label_id);
  end loop;

  delete from public.todo_task_labels l
  where l.user_id = v_user_id and l.task_id = v_task_id
    and not (l.label_id = any(coalesce(v_label_ids, array[]::uuid[])));
  insert into public.todo_task_labels (user_id, task_id, label_id)
  select v_user_id, v_task_id, label_id
  from (select distinct unnest(coalesce(v_label_ids, array[]::uuid[])) as label_id) selected
  on conflict (user_id, task_id, label_id) do nothing;

  return v_task_id;
end;
$function$;

revoke all on function public.save_todo_task_bundle(uuid, uuid, uuid, text, text, text, date, date, timestamptz, uuid[], text[], jsonb) from public, anon;
grant execute on function public.save_todo_task_bundle(uuid, uuid, uuid, text, text, text, date, date, timestamptz, uuid[], text[], jsonb) to authenticated;
