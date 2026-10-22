-- Remove a workspace atomically while requiring an explicit policy for its tasks.
-- The soft-delete policy uses the module's recoverable deletion behavior.
create or replace function public.delete_todo_workspace_with_task_policy(
  p_workspace_id uuid,
  p_task_policy text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  linked_task_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_task_policy is null or p_task_policy not in ('keep_tasks', 'soft_delete_tasks') then
    raise exception 'invalid task policy' using errcode = '22023';
  end if;

  perform 1 from public.todo_workspaces
  where id = p_workspace_id and user_id = current_user_id
  for update;
  if not found then
    raise exception 'workspace not found' using errcode = 'P0002';
  end if;

  select count(*)::integer into linked_task_count
  from public.todo_tasks
  where workspace_id = p_workspace_id and user_id = current_user_id;

  update public.todo_tasks
  set workspace_id = null,
      deleted_at = case
        when p_task_policy = 'soft_delete_tasks' then coalesce(deleted_at, now())
        else deleted_at
      end
  where workspace_id = p_workspace_id and user_id = current_user_id;

  delete from public.todo_workspaces
  where id = p_workspace_id and user_id = current_user_id;
  if not found then
    raise exception 'workspace could not be deleted' using errcode = '42501';
  end if;

  return linked_task_count;
end;
$$;

revoke all on function public.delete_todo_workspace_with_task_policy(uuid, text) from public, anon;
grant execute on function public.delete_todo_workspace_with_task_policy(uuid, text) to authenticated;
