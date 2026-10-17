-- Harden nullable optional time handling and scope capacity checks to the
-- destination dates being changed. Existing days outside this operation do
-- not block an otherwise valid reorganization.
create or replace function public.update_planned_study_block(
  p_id uuid,
  p_topic_id uuid,
  p_planned_date date,
  p_planned_minutes integer,
  p_planned_start_time time,
  p_status text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current public.study_blocks%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_planned_date is null or p_planned_minutes not between 15 and 480
     or p_status not in ('planejado', 'em_andamento', 'concluido', 'ignorado') then
    return 'invalid_input';
  end if;
  if not exists (
    select 1 from public.topics t
    join public.subjects s on s.id = t.subject_id and s.user_id = t.user_id
    where t.id = p_topic_id and t.user_id = v_user_id
      and t.archived_at is null and s.archived_at is null
  ) then
    return 'invalid_topic';
  end if;
  select * into v_current from public.study_blocks
  where id = p_id and user_id = v_user_id for update;
  if not found then return 'not_found'; end if;
  if (v_current.status = 'concluido' and p_status <> 'concluido')
     or (p_status = 'concluido' and v_current.status <> 'concluido')
     or (v_current.status = 'ignorado' and p_status <> 'planejado') then
    return 'invalid_state';
  end if;
  update public.study_blocks
  set topic_id = p_topic_id,
      planned_date = p_planned_date,
      moved_from_date = case when p_planned_date <> v_current.planned_date
        then v_current.planned_date else moved_from_date end,
      planned_minutes = p_planned_minutes,
      planned_start_time = nullif(p_planned_start_time::text, '')::time,
      status = p_status
  where id = p_id and user_id = v_user_id;
  return 'saved';
end;
$$;

create or replace function public.apply_schedule_reorganization(
  p_expected jsonb,
  p_changes jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal integer;
  v_change_count integer;
  v_expected_count integer;
  v_updated_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if jsonb_typeof(p_expected) <> 'array' or jsonb_typeof(p_changes) <> 'array'
     or jsonb_array_length(p_expected) = 0
     or jsonb_array_length(p_expected) <> jsonb_array_length(p_changes) then
    return 'invalid_input';
  end if;

  insert into public.user_settings (user_id) values (v_user_id)
  on conflict (user_id) do nothing;
  select daily_goal_minutes into v_goal from public.user_settings
  where user_id = v_user_id for update;

  select count(*) into v_expected_count from jsonb_to_recordset(p_expected)
    as e(id uuid, planned_date date, status text, pinned boolean);
  select count(*) into v_change_count from jsonb_to_recordset(p_changes)
    as c(id uuid, planned_date date);
  if v_expected_count <> v_change_count or v_change_count = 0 then return 'invalid_input'; end if;

  if exists (
    select 1 from jsonb_to_recordset(p_changes) as c(id uuid, planned_date date)
    left join jsonb_to_recordset(p_expected)
      as e(id uuid, planned_date date, status text, pinned boolean) on e.id = c.id
    where e.id is null or c.planned_date is null
  ) then return 'invalid_input'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_changes) as c(id uuid, planned_date date)
    left join public.study_blocks b on b.id = c.id and b.user_id = v_user_id
    where b.id is null
  ) then return 'stale'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_changes) as c(id uuid, planned_date date)
    group by c.id having count(*) > 1
  ) then return 'invalid_input'; end if;

  perform b.id from public.study_blocks b
  join jsonb_to_recordset(p_expected)
    as e(id uuid, planned_date date, status text, pinned boolean) on e.id = b.id
  where b.user_id = v_user_id for update;

  if exists (
    select 1 from jsonb_to_recordset(p_expected)
      as e(id uuid, planned_date date, status text, pinned boolean)
    left join public.study_blocks b on b.id = e.id and b.user_id = v_user_id
    where b.id is null or b.planned_date <> e.planned_date
      or b.status <> e.status or b.pinned <> e.pinned
      or b.status in ('concluido', 'ignorado') or b.pinned
  ) then return 'stale'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_changes) as c(id uuid, planned_date date)
    where c.planned_date < (pg_catalog.now() at time zone coalesce((
      select timezone from public.user_settings where user_id = v_user_id
    ), 'America/Sao_Paulo'))::date
  ) then return 'invalid_input'; end if;

  if exists (
    with moved as (
      select c.planned_date, b.planned_minutes
      from jsonb_to_recordset(p_changes) as c(id uuid, planned_date date)
      join public.study_blocks b on b.id = c.id and b.user_id = v_user_id
    ), retained as (
      select b.planned_date, b.planned_minutes
      from public.study_blocks b
      where b.user_id = v_user_id
        and b.id not in (select (entry->>'id')::uuid from jsonb_array_elements(p_changes) entry)
        and b.status <> 'ignorado'
    ), totals as (
      select planned_date, sum(planned_minutes) as minutes from (
        select * from moved union all select * from retained
      ) allocations group by planned_date
    ) select 1 from totals
      where minutes > v_goal
        and planned_date in (select planned_date from jsonb_to_recordset(p_changes) as c(id uuid, planned_date date))
  ) then return 'over_capacity'; end if;

  update public.study_blocks b
  set planned_date = c.planned_date,
      moved_from_date = b.planned_date
  from jsonb_to_recordset(p_changes) as c(id uuid, planned_date date)
  where b.id = c.id and b.user_id = v_user_id
    and b.status in ('planejado', 'em_andamento') and not b.pinned;
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> v_change_count then return 'stale'; end if;
  return 'applied';
end;
$$;
