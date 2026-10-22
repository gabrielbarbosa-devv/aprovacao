-- Transfer every task (including soft-deleted history) before removing a list.
-- SECURITY INVOKER keeps the caller's grants and RLS policies in force.
create or replace function public.delete_todo_list_with_transfer(
  p_list_id uuid,
  p_target_list_id uuid default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  task_count integer;
  moved_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  perform 1 from public.todo_lists
  where id = p_list_id and user_id = current_user_id
  for update;
  if not found then
    raise exception 'list not found' using errcode = 'P0002';
  end if;

  select count(*)::integer into task_count
  from public.todo_tasks
  where list_id = p_list_id and user_id = current_user_id;

  if task_count > 0 then
    if p_target_list_id is null or p_target_list_id = p_list_id then
      raise exception 'choose a different destination list' using errcode = '22023';
    end if;
    perform 1 from public.todo_lists
    where id = p_target_list_id and user_id = current_user_id
    for update;
    if not found then
      raise exception 'destination list not found' using errcode = '23503';
    end if;

    update public.todo_tasks
    set list_id = p_target_list_id
    where list_id = p_list_id and user_id = current_user_id;
    get diagnostics moved_count = row_count;
  elsif p_target_list_id is not null then
    raise exception 'a destination is only needed when tasks exist' using errcode = '22023';
  end if;

  delete from public.todo_lists where id = p_list_id and user_id = current_user_id;
  if not found then
    raise exception 'list could not be deleted' using errcode = '42501';
  end if;
  return moved_count;
end;
$$;

revoke all on function public.delete_todo_list_with_transfer(uuid, uuid) from public, anon;
grant execute on function public.delete_todo_list_with_transfer(uuid, uuid) to authenticated;
