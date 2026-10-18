-- Append-only audit trail for user-confirmed reinforcement planning previews.
create table public.reinforcement_plan_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  revision_id uuid not null,
  preview_hash text not null,
  change_set jsonb not null,
  applied_at timestamptz not null default now(),
  unique (user_id, revision_id)
);

alter table public.reinforcement_plan_events enable row level security;
revoke all on public.reinforcement_plan_events from public, anon, authenticated;

create or replace function public.apply_reinforcement_plan(
  p_revision_id uuid,
  p_expected jsonb,
  p_changes jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal integer;
  v_hash text;
  v_existing_hash text;
  v_expected_count integer;
  v_updated_count integer;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_revision_id is null or jsonb_typeof(p_expected) <> 'array' or jsonb_typeof(p_changes) <> 'array'
     or jsonb_array_length(p_expected) = 0 or jsonb_array_length(p_changes) = 0 then return 'invalid_input'; end if;

  v_hash := md5(p_expected::text || '|' || p_changes::text);
  select preview_hash into v_existing_hash from public.reinforcement_plan_events
    where user_id = v_user_id and revision_id = p_revision_id;
  if found then return case when v_existing_hash = v_hash then 'applied' else 'stale' end; end if;

  insert into public.user_settings (user_id) values (v_user_id) on conflict (user_id) do nothing;
  select daily_goal_minutes into v_goal from public.user_settings where user_id = v_user_id for update;

  select count(*) into v_expected_count from jsonb_to_recordset(p_expected) as e(
    id uuid, topic_id uuid, planned_date date, planned_minutes integer, planned_start_time time,
    status text, pinned boolean, updated_at timestamptz
  );
  if v_expected_count <> jsonb_array_length(p_expected) then return 'invalid_input'; end if;

  perform b.id from public.study_blocks b join jsonb_to_recordset(p_expected) as e(
    id uuid, topic_id uuid, planned_date date, planned_minutes integer, planned_start_time time,
    status text, pinned boolean, updated_at timestamptz
  ) on e.id = b.id where b.user_id = v_user_id for update;

  if (select count(*) from public.study_blocks b where b.user_id = v_user_id
       and b.planned_date >= (pg_catalog.now() at time zone coalesce((select timezone from public.user_settings where user_id = v_user_id), 'America/Sao_Paulo'))::date
       and b.status = 'planejado') <> v_expected_count
     or exists (
       select 1 from jsonb_to_recordset(p_expected) as e(
         id uuid, topic_id uuid, planned_date date, planned_minutes integer, planned_start_time time,
         status text, pinned boolean, updated_at timestamptz
       ) left join public.study_blocks b on b.id = e.id and b.user_id = v_user_id
       where b.id is null or b.topic_id <> e.topic_id or b.planned_date <> e.planned_date
         or b.planned_minutes <> e.planned_minutes or b.planned_start_time is distinct from e.planned_start_time
         or b.status <> e.status or b.pinned <> e.pinned or b.updated_at <> e.updated_at
         or b.status <> 'planejado'
     ) then return 'stale'; end if;

  if exists (
    select 1 from jsonb_to_recordset(p_changes) as c(
      id uuid, before_topic_id uuid, before_date date, after_topic_id uuid, after_date date
    ) left join jsonb_to_recordset(p_expected) as e(
      id uuid, topic_id uuid, planned_date date, planned_minutes integer, planned_start_time time,
      status text, pinned boolean, updated_at timestamptz
    ) on e.id = c.id
    where e.id is null or e.topic_id <> c.before_topic_id or e.planned_date <> c.before_date
       or c.after_date < (pg_catalog.now() at time zone coalesce((select timezone from public.user_settings where user_id = v_user_id), 'America/Sao_Paulo'))::date
  ) then return 'invalid_input'; end if;
  if (select count(*) from jsonb_to_recordset(p_changes) as c(id uuid, before_topic_id uuid, before_date date, after_topic_id uuid, after_date date))
     <> (select count(distinct id) from jsonb_to_recordset(p_changes) as c(id uuid, before_topic_id uuid, before_date date, after_topic_id uuid, after_date date)) then return 'invalid_input'; end if;

  if exists (
    select 1 from jsonb_to_recordset(p_changes) as c(id uuid, before_topic_id uuid, before_date date, after_topic_id uuid, after_date date)
    join public.topics t on t.id = c.after_topic_id and t.user_id = v_user_id
    join public.subjects s on s.id = t.subject_id and s.user_id = v_user_id
    where t.archived_at is not null or s.archived_at is not null
  ) then return 'invalid_topic'; end if;

  if exists (
    select 1 from jsonb_to_recordset(p_changes) as c(id uuid, before_topic_id uuid, before_date date, after_topic_id uuid, after_date date)
    join public.study_blocks b on b.id = c.id and b.user_id = v_user_id
    where b.status <> 'planejado' or b.pinned
  ) then return 'stale'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_changes) as c(id uuid, before_topic_id uuid, before_date date, after_topic_id uuid, after_date date)
    join public.topics source_topic on source_topic.id = c.before_topic_id and source_topic.user_id = v_user_id
    where exists (
      select 1 from public.exam_topics et join public.exam_targets e on e.id = et.exam_target_id and e.user_id = v_user_id
      where et.topic_id = c.before_topic_id and e.archived_at is null and e.exam_date between
        (pg_catalog.now() at time zone coalesce((select timezone from public.user_settings where user_id = v_user_id), 'America/Sao_Paulo'))::date
        and ((pg_catalog.now() at time zone coalesce((select timezone from public.user_settings where user_id = v_user_id), 'America/Sao_Paulo'))::date + 30)
    ) or exists (
      select 1 from public.exam_subjects es join public.exam_targets e on e.id = es.exam_target_id and e.user_id = v_user_id
      where es.subject_id = source_topic.subject_id and e.archived_at is null and e.exam_date between
        (pg_catalog.now() at time zone coalesce((select timezone from public.user_settings where user_id = v_user_id), 'America/Sao_Paulo'))::date
        and ((pg_catalog.now() at time zone coalesce((select timezone from public.user_settings where user_id = v_user_id), 'America/Sao_Paulo'))::date + 30)
    )
  ) then return 'protected_exam'; end if;

  if exists (
    select 1 from jsonb_to_recordset(p_changes) as c(id uuid, before_topic_id uuid, before_date date, after_topic_id uuid, after_date date)
    join public.study_blocks changed on changed.id = c.id and changed.user_id = v_user_id
    join public.study_blocks other on other.user_id = v_user_id and other.planned_date = c.after_date
      and other.id <> changed.id and other.status <> 'ignorado'
    where changed.planned_start_time is not null and other.planned_start_time is not null
      and changed.planned_start_time < other.planned_start_time + (other.planned_minutes * interval '1 minute')
      and other.planned_start_time < changed.planned_start_time + (changed.planned_minutes * interval '1 minute')
  ) then return 'time_conflict'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_changes) as c(id uuid, before_topic_id uuid, before_date date, after_topic_id uuid, after_date date)
    where not exists (select 1 from public.topics t where t.id = c.after_topic_id and t.user_id = v_user_id)
  ) then return 'invalid_topic'; end if;

  if exists (
    with changed as (
      select c.id, c.after_date as planned_date, b.planned_minutes
      from jsonb_to_recordset(p_changes) as c(id uuid, before_topic_id uuid, before_date date, after_topic_id uuid, after_date date)
      join public.study_blocks b on b.id = c.id and b.user_id = v_user_id
    ), retained as (
      select b.id, b.planned_date, b.planned_minutes from public.study_blocks b
      where b.user_id = v_user_id and b.status <> 'ignorado'
        and b.id not in (select (entry->>'id')::uuid from jsonb_array_elements(p_changes) entry)
    ), totals as (
      select planned_date, sum(planned_minutes) as minutes from (select * from changed union all select * from retained) values_by_date group by planned_date
    ) select 1 from totals where minutes > v_goal
  ) then return 'over_capacity'; end if;

  update public.study_blocks b set topic_id = c.after_topic_id, planned_date = c.after_date, moved_from_date =
      case when b.planned_date <> c.after_date then b.planned_date else b.moved_from_date end
  from jsonb_to_recordset(p_changes) as c(id uuid, before_topic_id uuid, before_date date, after_topic_id uuid, after_date date)
  where b.id = c.id and b.user_id = v_user_id and b.status = 'planejado' and not b.pinned;
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> jsonb_array_length(p_changes) then return 'stale'; end if;

  insert into public.reinforcement_plan_events (user_id, revision_id, preview_hash, change_set)
  values (v_user_id, p_revision_id, v_hash, p_changes);
  return 'applied';
end;
$$;

revoke all on function public.apply_reinforcement_plan(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.apply_reinforcement_plan(uuid, jsonb, jsonb) to authenticated;
