-- Normalize the existing To-Do order so open tasks come before completed ones.
-- This only changes the To-Do module's existing position values.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, list_id
      order by
        case when deleted_at is not null then 2 when status = 'done' then 1 else 0 end,
        position,
        created_at,
        id
    ) - 1 as next_position
  from public.todo_tasks
)
update public.todo_tasks as task
set position = ranked.next_position::integer
from ranked
where task.id = ranked.id;

alter table public.todo_tasks
  add constraint todo_tasks_user_list_position_key
  unique (user_id, list_id, position)
  deferrable initially deferred;

create or replace function public.assign_todo_task_position()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  lock_key bigint;
begin
  if current_user_id is null or current_user_id is distinct from new.user_id then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(current_user_id::text || ':' || new.list_id::text, 0)
    );
    select coalesce(max(task.position) + 1, 0)
      into new.position
      from public.todo_tasks as task
      where task.user_id = current_user_id and task.list_id = new.list_id;
    return new;
  end if;

  if old.list_id is distinct from new.list_id then
    for lock_key in
      select pg_catalog.hashtextextended(current_user_id::text || ':' || changed.list_id::text, 0)
      from pg_catalog.unnest(array[old.list_id, new.list_id]) as changed(list_id)
      order by 1
    loop
      perform pg_catalog.pg_advisory_xact_lock(lock_key);
    end loop;

    select coalesce(max(task.position) + 1, 0)
      into new.position
      from public.todo_tasks as task
      where task.user_id = current_user_id
        and task.list_id = new.list_id
        and task.id <> new.id;
  end if;

  return new;
end;
$function$;

revoke all on function public.assign_todo_task_position() from public, anon, authenticated;

create trigger todo_tasks_assign_position
before insert or update of list_id on public.todo_tasks
for each row execute function public.assign_todo_task_position();

create or replace function public.reorder_todo_task_positions(
  p_list_id uuid,
  p_lane text,
  p_task_ids uuid[]
)
returns table (id uuid, task_position integer)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  expected_count integer;
  supplied_count integer := coalesce(cardinality(p_task_ids), 0);
  ids_to_write uuid[];
  untouched_ids uuid[];
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_lane not in ('pending', 'done') then
    raise exception 'Invalid task lane';
  end if;
  if supplied_count > 2000 then
    raise exception 'Too many tasks to reorder';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text || ':' || p_list_id::text, 0)
  );

  select count(*)::integer into expected_count
  from public.todo_tasks as task
  where task.user_id = current_user_id
    and task.list_id = p_list_id
    and task.deleted_at is null
    and ((p_lane = 'pending' and task.status <> 'done') or (p_lane = 'done' and task.status = 'done'));

  if supplied_count <> expected_count then
    raise exception 'Task list changed. Reload and try again.' using errcode = '40001';
  end if;
  if supplied_count <> (select count(distinct task_id) from pg_catalog.unnest(coalesce(p_task_ids, array[]::uuid[])) as supplied(task_id)) then
    raise exception 'Duplicate task IDs are not allowed';
  end if;
  if exists (
    select 1
    from pg_catalog.unnest(coalesce(p_task_ids, array[]::uuid[])) as supplied(task_id)
    left join public.todo_tasks as task
      on task.id = supplied.task_id
      and task.user_id = current_user_id
      and task.list_id = p_list_id
      and task.deleted_at is null
      and ((p_lane = 'pending' and task.status <> 'done') or (p_lane = 'done' and task.status = 'done'))
    where task.id is null
  ) then
    raise exception 'Tasks must belong to this user, list, and status lane';
  end if;

  select coalesce(array_agg(task.id order by task.position, task.created_at, task.id), array[]::uuid[])
    into untouched_ids
    from public.todo_tasks as task
    where task.user_id = current_user_id
      and task.list_id = p_list_id
      and task.deleted_at is null
      and ((p_lane = 'pending' and task.status = 'done') or (p_lane = 'done' and task.status <> 'done'));

  if p_lane = 'pending' then
    ids_to_write := coalesce(p_task_ids, array[]::uuid[]) || untouched_ids;
  else
    ids_to_write := untouched_ids || coalesce(p_task_ids, array[]::uuid[]);
  end if;

  select coalesce(array_agg(task.id order by task.position, task.created_at, task.id), array[]::uuid[])
    into untouched_ids
    from public.todo_tasks as task
    where task.user_id = current_user_id and task.list_id = p_list_id and task.deleted_at is not null;
  ids_to_write := ids_to_write || untouched_ids;

  update public.todo_tasks as task
  set position = (ranked.ordinality - 1)::integer
  from pg_catalog.unnest(ids_to_write) with ordinality as ranked(task_id, ordinality)
  where task.id = ranked.task_id and task.user_id = current_user_id and task.list_id = p_list_id;

  return query
  select task.id, task.position
  from public.todo_tasks as task
  where task.user_id = current_user_id and task.list_id = p_list_id and task.deleted_at is null
  order by task.position;
end;
$function$;

revoke all on function public.reorder_todo_task_positions(uuid, text, uuid[]) from public, anon;
grant execute on function public.reorder_todo_task_positions(uuid, text, uuid[]) to authenticated;
