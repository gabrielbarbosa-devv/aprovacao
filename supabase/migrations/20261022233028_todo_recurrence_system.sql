-- Recurrence data is isolated to todo_* tables. Existing task rows remain the
-- materialized occurrences, each with its own status, completion time and log.
create table public.todo_recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_task_id uuid,
  frequency text not null check (frequency in ('daily','weekdays','weekly','monthly','yearly','custom')),
  interval_count integer not null check (interval_count between 1 and 366),
  weekdays smallint[] not null default '{}',
  monthly_mode text not null default 'day' check (monthly_mode in ('day','last_day','nth_weekday')),
  month_day smallint not null default 1 check (month_day between 1 and 31),
  month_week text not null default 'first' check (month_week in ('first','last')),
  month_weekday smallint not null default 1 check (month_weekday between 0 and 6),
  annual_month smallint not null default 1 check (annual_month between 1 and 12),
  annual_day smallint not null default 1 check (annual_day between 1 and 31),
  custom_unit text not null default 'week' check (custom_unit in ('day','week','month','year')),
  starts_on date not null,
  time_of_day time,
  ends_on date,
  max_occurrences integer check (max_occurrences between 1 and 10000),
  timezone text not null,
  schedule_basis text not null check (schedule_basis in ('planned','completion')),
  status text not null default 'active' check (status in ('active','paused','ended')),
  next_occurrence_on date,
  occurrences_created integer not null default 1 check (occurrences_created >= 1),
  template jsonb not null check (jsonb_typeof(template) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (ends_on is null or ends_on >= starts_on),
  check (schedule_basis <> 'completion' or (frequency <> 'weekdays' and cardinality(weekdays) = 0))
);
alter table public.todo_recurrence_rules add constraint todo_recurrence_rules_template_owner_fkey
  foreign key (template_task_id,user_id) references public.todo_tasks(id,user_id) on delete set null (template_task_id);

alter table public.todo_tasks
  add column recurrence_rule_id uuid,
  add column recurrence_on date;
alter table public.todo_tasks add constraint todo_tasks_recurrence_rule_owner_fkey
  foreign key (recurrence_rule_id,user_id) references public.todo_recurrence_rules(id,user_id) on delete set null (recurrence_rule_id);

create unique index todo_tasks_recurrence_occurrence_unique
  on public.todo_tasks (recurrence_rule_id, recurrence_on)
  where recurrence_rule_id is not null and recurrence_on is not null;
create index todo_tasks_user_recurrence_active_idx
  on public.todo_tasks (user_id, recurrence_rule_id, recurrence_on)
  where recurrence_rule_id is not null and deleted_at is null and archived_at is null;
create index todo_recurrence_rules_user_status_next_idx
  on public.todo_recurrence_rules (user_id, status, next_occurrence_on);

create table public.todo_recurrence_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid not null,
  occurrence_on date not null,
  action text not null check (action in ('skipped','rescheduled')),
  override_on date,
  created_at timestamptz not null default now(),
  unique (rule_id, occurrence_on),
  foreign key (rule_id,user_id) references public.todo_recurrence_rules(id,user_id) on delete cascade,
  check ((action = 'rescheduled' and override_on is not null) or (action = 'skipped' and override_on is null))
);

alter table public.todo_recurrence_rules enable row level security;
alter table public.todo_recurrence_exceptions enable row level security;
create policy todo_recurrence_rules_select_own on public.todo_recurrence_rules for select to authenticated using (auth.uid() = user_id);
create policy todo_recurrence_rules_insert_own on public.todo_recurrence_rules for insert to authenticated with check (auth.uid() = user_id);
create policy todo_recurrence_rules_update_own on public.todo_recurrence_rules for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy todo_recurrence_rules_delete_own on public.todo_recurrence_rules for delete to authenticated using (auth.uid() = user_id);
create policy todo_recurrence_exceptions_select_own on public.todo_recurrence_exceptions for select to authenticated using (auth.uid() = user_id);
create policy todo_recurrence_exceptions_insert_own on public.todo_recurrence_exceptions for insert to authenticated with check (auth.uid() = user_id);
create policy todo_recurrence_exceptions_update_own on public.todo_recurrence_exceptions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy todo_recurrence_exceptions_delete_own on public.todo_recurrence_exceptions for delete to authenticated using (auth.uid() = user_id);
grant select, insert, update, delete on public.todo_recurrence_rules, public.todo_recurrence_exceptions to authenticated;

create or replace function public.todo_recurrence_config_json(p_rule_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'frequency', frequency, 'interval', interval_count, 'weekdays', to_jsonb(weekdays),
    'monthlyMode', monthly_mode, 'monthDay', month_day, 'monthWeek', month_week,
    'monthWeekday', month_weekday, 'annualMonth', annual_month, 'annualDay', annual_day,
    'customUnit', custom_unit, 'startsOn', starts_on, 'timeOfDay', case when time_of_day is null then null else to_char(time_of_day, 'HH24:MI') end,
    'endsOn', ends_on, 'maxOccurrences', max_occurrences, 'timezone', timezone,
    'scheduleBasis', schedule_basis
  ) from public.todo_recurrence_rules where id = p_rule_id and user_id = auth.uid()
$$;

create or replace function public.save_todo_task_with_recurrence(
  p_task_id uuid, p_list_id uuid, p_workspace_id uuid, p_title text, p_description text,
  p_priority text, p_starts_on date, p_due_on date, p_due_at timestamptz,
  p_label_ids uuid[], p_new_labels text[], p_subtasks jsonb, p_recurrence jsonb
)
returns uuid language plpgsql security invoker set search_path = '' as $function$
declare
  v_user_id uuid := auth.uid();
  v_task_id uuid;
  v_rule_id uuid;
  v_frequency text;
  v_interval integer;
  v_weekdays smallint[];
  v_monthly_mode text;
  v_month_day smallint;
  v_month_week text;
  v_month_weekday smallint;
  v_annual_month smallint;
  v_annual_day smallint;
  v_custom_unit text;
  v_starts_on date;
  v_time_of_day time;
  v_ends_on date;
  v_max_occurrences integer;
  v_timezone text;
  v_schedule_basis text;
  v_template jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if coalesce(jsonb_typeof(p_recurrence), '') <> 'object' then raise exception 'Invalid recurrence configuration'; end if;
  v_frequency := p_recurrence->>'frequency';
  v_interval := (p_recurrence->>'interval')::integer;
  select coalesce(array_agg(value::smallint), array[]::smallint[]) into v_weekdays
    from jsonb_array_elements_text(coalesce(p_recurrence->'weekdays','[]'::jsonb)) value;
  v_monthly_mode := coalesce(p_recurrence->>'monthlyMode','day');
  v_month_day := coalesce((p_recurrence->>'monthDay')::smallint,1);
  v_month_week := coalesce(p_recurrence->>'monthWeek','first');
  v_month_weekday := coalesce((p_recurrence->>'monthWeekday')::smallint,1);
  v_annual_month := coalesce((p_recurrence->>'annualMonth')::smallint,1);
  v_annual_day := coalesce((p_recurrence->>'annualDay')::smallint,1);
  v_custom_unit := coalesce(p_recurrence->>'customUnit','week');
  v_starts_on := (p_recurrence->>'startsOn')::date;
  v_time_of_day := nullif(p_recurrence->>'timeOfDay','')::time;
  v_ends_on := nullif(p_recurrence->>'endsOn','')::date;
  v_max_occurrences := nullif(p_recurrence->>'maxOccurrences','')::integer;
  v_timezone := p_recurrence->>'timezone';
  v_schedule_basis := p_recurrence->>'scheduleBasis';
  if v_frequency not in ('daily','weekdays','weekly','monthly','yearly','custom')
     or v_interval not between 1 and 366 or v_starts_on is null
     or v_schedule_basis not in ('planned','completion')
     or v_monthly_mode not in ('day','last_day','nth_weekday')
     or v_month_day not between 1 and 31 or v_month_week not in ('first','last')
     or v_month_weekday not between 0 and 6 or v_annual_month not between 1 and 12
     or v_annual_day not between 1 and 31 or v_custom_unit not in ('day','week','month','year')
     or exists (select 1 from unnest(v_weekdays) day where day not between 0 and 6)
     or cardinality(v_weekdays) <> (select count(distinct day)::integer from unnest(v_weekdays) day)
     or (v_frequency='weekdays' and v_interval<>1)
     or (v_schedule_basis = 'completion' and (v_frequency = 'weekdays' or cardinality(v_weekdays) > 0))
     or (v_ends_on is not null and v_ends_on < v_starts_on)
     or (v_max_occurrences is not null and v_max_occurrences not between 1 and 10000)
     or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
    raise exception 'Invalid recurrence configuration';
  end if;

  v_task_id := public.save_todo_task_bundle(p_task_id, p_list_id, p_workspace_id, p_title, p_description, p_priority, p_starts_on, p_due_on, p_due_at, p_label_ids, p_new_labels, p_subtasks);
  select recurrence_rule_id into v_rule_id from public.todo_tasks where id = v_task_id and user_id = v_user_id for update;
  if v_rule_id is null then
    insert into public.todo_recurrence_rules(user_id, template_task_id, frequency, interval_count, weekdays, monthly_mode, month_day, month_week, month_weekday, annual_month, annual_day, custom_unit, starts_on, time_of_day, ends_on, max_occurrences, timezone, schedule_basis, next_occurrence_on, occurrences_created, template)
    values (v_user_id, v_task_id, v_frequency, v_interval, v_weekdays, v_monthly_mode, v_month_day, v_month_week, v_month_weekday, v_annual_month, v_annual_day, v_custom_unit, v_starts_on, v_time_of_day, v_ends_on, v_max_occurrences, v_timezone, v_schedule_basis, case when v_schedule_basis = 'planned' then v_starts_on + 1 else null end, 1, '{}'::jsonb)
    returning id into v_rule_id;
    update public.todo_tasks set recurrence_rule_id = v_rule_id, recurrence_on = v_starts_on where id = v_task_id and user_id = v_user_id;
  else
    -- Preserve prior completed history; future pending snapshots are retained as archived
    -- records and regenerated from the updated rule after this transaction.
    update public.todo_tasks set archived_at=now(), recurrence_rule_id=null, recurrence_on=null
      where user_id=v_user_id and recurrence_rule_id=v_rule_id and id<>v_task_id
        and status<>'done' and deleted_at is null and archived_at is null
        and recurrence_on>(select recurrence_on from public.todo_tasks where id=v_task_id and user_id=v_user_id);
    update public.todo_recurrence_rules set frequency=v_frequency, interval_count=v_interval, weekdays=v_weekdays,
      monthly_mode=v_monthly_mode, month_day=v_month_day, month_week=v_month_week, month_weekday=v_month_weekday,
      annual_month=v_annual_month, annual_day=v_annual_day, custom_unit=v_custom_unit, starts_on=v_starts_on,
      time_of_day=v_time_of_day, ends_on=v_ends_on, max_occurrences=v_max_occurrences, timezone=v_timezone,
      schedule_basis=v_schedule_basis, status='active', next_occurrence_on=case when v_schedule_basis='planned' then greatest(
        v_starts_on + 1,
        coalesce((select recurrence_on + 1 from public.todo_tasks where id=v_task_id and user_id=v_user_id),v_starts_on + 1),
        (select coalesce(max(recurrence_on),v_starts_on)+1 from public.todo_tasks where recurrence_rule_id=v_rule_id and status='done')
      ) else null end,
      updated_at=now() where id=v_rule_id and user_id=v_user_id;
  end if;

  select jsonb_build_object(
    'listId', t.list_id, 'workspaceId', t.workspace_id, 'title', t.title, 'description', t.description,
    'priority', t.priority, 'labels', coalesce((select jsonb_agg(tl.label_id) from public.todo_task_labels tl where tl.task_id=t.id and tl.user_id=v_user_id),'[]'::jsonb),
    'subtasks', coalesce((select jsonb_agg(jsonb_build_object('title',s.title) order by s.position) from public.todo_subtasks s where s.task_id=t.id and s.user_id=v_user_id),'[]'::jsonb)
  ) into v_template from public.todo_tasks t where t.id=v_task_id and t.user_id=v_user_id;
  update public.todo_recurrence_rules set template=v_template, updated_at=now() where id=v_rule_id and user_id=v_user_id;
  return v_task_id;
end;
$function$;

create or replace function public.ensure_todo_recurrence_occurrences(p_days_ahead integer default 45)
returns integer language plpgsql security invoker set search_path = '' as $function$
declare
  v_user_id uuid := auth.uid();
  r public.todo_recurrence_rules%rowtype;
  v_today date;
  v_horizon date;
  v_candidate date;
  v_due date;
  v_day integer;
  v_day_offset integer;
  v_month_offset integer;
  v_year_offset integer;
  v_matches boolean;
  v_task_id uuid;
  v_created integer := 0;
  v_total integer := 0;
  v_label uuid;
  v_subtask jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_days_ahead not between 1 and 90 then raise exception 'Generation window must be between 1 and 90 days'; end if;
  for r in select * from public.todo_recurrence_rules where user_id=v_user_id and status='active' order by id loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r.id::text, 0));
    v_today := (now() at time zone r.timezone)::date;
    v_horizon := v_today + p_days_ahead;
    v_candidate := coalesce(r.next_occurrence_on, case when r.schedule_basis='planned' then r.starts_on else null end);
    if v_candidate is null then continue; end if;
    v_candidate := greatest(v_candidate,r.starts_on);
    while v_candidate <= v_horizon loop
      if (r.ends_on is not null and v_candidate > r.ends_on) or (r.max_occurrences is not null and r.occurrences_created >= r.max_occurrences) then
        update public.todo_recurrence_rules set status='ended', next_occurrence_on=null, updated_at=now() where id=r.id and user_id=v_user_id;
        exit;
      end if;
      v_day_offset := v_candidate - r.starts_on;
      v_month_offset := (extract(year from v_candidate)::integer-extract(year from r.starts_on)::integer)*12 + extract(month from v_candidate)::integer-extract(month from r.starts_on)::integer;
      v_year_offset := extract(year from v_candidate)::integer-extract(year from r.starts_on)::integer;
      v_day := extract(dow from v_candidate)::integer;
      v_matches := case
        when r.frequency='daily' then mod(v_day_offset,r.interval_count)=0
        when r.frequency='weekdays' then v_day between 1 and 5
        when r.frequency='weekly' then mod(floor(v_day_offset::numeric/7)::integer,r.interval_count)=0 and (case when cardinality(r.weekdays)=0 then v_day=extract(dow from r.starts_on)::integer else v_day=any(r.weekdays) end)
        when r.frequency='monthly' then mod(v_month_offset,r.interval_count)=0 and case
          when r.monthly_mode='last_day' then v_candidate=pg_catalog.date_trunc('month',v_candidate)::date + interval '1 month - 1 day'
          when r.monthly_mode='day' then extract(day from v_candidate)::integer=r.month_day
          else v_day=r.month_weekday and case when r.month_week='first' then extract(day from v_candidate)::integer<=7 else v_candidate+7>pg_catalog.date_trunc('month',v_candidate)::date + interval '1 month - 1 day' end end
        when r.frequency='yearly' then mod(v_year_offset,r.interval_count)=0 and extract(month from v_candidate)::integer=r.annual_month and extract(day from v_candidate)::integer=r.annual_day
        when r.frequency='custom' and r.custom_unit='day' then mod(v_day_offset,r.interval_count)=0
        when r.frequency='custom' and r.custom_unit='week' then mod(floor(v_day_offset::numeric/7)::integer,r.interval_count)=0 and (case when cardinality(r.weekdays)=0 then v_day=extract(dow from r.starts_on)::integer else v_day=any(r.weekdays) end)
        when r.frequency='custom' and r.custom_unit='month' then mod(v_month_offset,r.interval_count)=0 and case
          when r.monthly_mode='last_day' then v_candidate=pg_catalog.date_trunc('month',v_candidate)::date + interval '1 month - 1 day'
          when r.monthly_mode='day' then extract(day from v_candidate)::integer=r.month_day
          else v_day=r.month_weekday and case when r.month_week='first' then extract(day from v_candidate)::integer<=7 else v_candidate+7>pg_catalog.date_trunc('month',v_candidate)::date + interval '1 month - 1 day' end end
        when r.frequency='custom' and r.custom_unit='year' then mod(v_year_offset,r.interval_count)=0 and extract(month from v_candidate)::integer=r.annual_month and extract(day from v_candidate)::integer=r.annual_day
        else false end;
      if v_matches then
        v_due := v_candidate;
        if exists(select 1 from public.todo_recurrence_exceptions e where e.rule_id=r.id and e.user_id=v_user_id and e.occurrence_on=v_candidate and e.action='skipped') then
          null;
        else
          select coalesce(override_on,v_candidate) into v_due from public.todo_recurrence_exceptions e where e.rule_id=r.id and e.user_id=v_user_id and e.occurrence_on=v_candidate and e.action='rescheduled';
          v_due := coalesce(v_due,v_candidate);
          insert into public.todo_tasks(user_id,list_id,workspace_id,title,description,status,priority,starts_on,due_on,due_at,completed_at,position,recurrence_rule_id,recurrence_on)
          values (v_user_id,(r.template->>'listId')::uuid,nullif(r.template->>'workspaceId','')::uuid,r.template->>'title',nullif(r.template->>'description',''),'todo',r.template->>'priority',v_due,v_due,
            case when r.time_of_day is null then null else ((v_due + r.time_of_day) at time zone r.timezone) end,null,coalesce((select max(position)+1 from public.todo_tasks where list_id=(r.template->>'listId')::uuid and user_id=v_user_id),0),r.id,v_candidate)
          on conflict (recurrence_rule_id,recurrence_on) where recurrence_rule_id is not null and recurrence_on is not null do nothing
          returning id into v_task_id;
          if v_task_id is not null then
            for v_label in select value::uuid from jsonb_array_elements_text(coalesce(r.template->'labels','[]'::jsonb)) value loop
              insert into public.todo_task_labels(user_id,task_id,label_id) select v_user_id,v_task_id,v_label where exists(select 1 from public.todo_labels where id=v_label and user_id=v_user_id) on conflict do nothing;
            end loop;
            for v_subtask in select value from jsonb_array_elements(coalesce(r.template->'subtasks','[]'::jsonb)) value loop
              insert into public.todo_subtasks(user_id,task_id,title,is_completed,position) values(v_user_id,v_task_id,v_subtask->>'title',false,(select count(*)::integer from public.todo_subtasks where task_id=v_task_id and user_id=v_user_id));
            end loop;
            v_created := v_created+1;
            update public.todo_recurrence_rules set occurrences_created=occurrences_created+1, updated_at=now() where id=r.id and user_id=v_user_id;
          end if;
        end if;
      end if;
      v_candidate := v_candidate+1;
      if r.schedule_basis='completion' then exit; end if;
    end loop;
    if r.schedule_basis='planned' and v_candidate>v_horizon then
      update public.todo_recurrence_rules set next_occurrence_on=v_candidate, updated_at=now() where id=r.id and user_id=v_user_id and status='active';
    elsif r.schedule_basis='completion' and v_created>0 then
      update public.todo_recurrence_rules set next_occurrence_on=null where id=r.id and user_id=v_user_id;
    end if;
    v_total := v_total+v_created;
    v_created := 0;
  end loop;
  return v_total;
end;
$function$;

create or replace function public.advance_completion_based_todo_recurrence()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare
  r public.todo_recurrence_rules%rowtype;
  v_completed_on date;
  v_next date;
  v_offset integer;
  v_target_month date;
  v_target_day integer;
begin
  if new.status='done' and old.status is distinct from new.status and new.recurrence_rule_id is not null then
    select * into r from public.todo_recurrence_rules where id=new.recurrence_rule_id and user_id=new.user_id and status='active' and schedule_basis='completion' for update;
    if r.id is not null then
      v_completed_on := (new.completed_at at time zone r.timezone)::date;
      if r.frequency='daily' or (r.frequency='custom' and r.custom_unit='day') then
        v_next := v_completed_on + r.interval_count;
      elsif r.frequency='weekly' or (r.frequency='custom' and r.custom_unit='week') then
        v_next := v_completed_on + (r.interval_count*7);
      elsif r.frequency='monthly' or (r.frequency='custom' and r.custom_unit='month') then
        v_offset := r.interval_count;
        v_next := null;
        while v_offset <= r.interval_count*120 loop
          v_target_month := (pg_catalog.date_trunc('month',v_completed_on)::date + make_interval(months=>v_offset))::date;
          if r.monthly_mode='last_day' then
            v_next := (pg_catalog.date_trunc('month',v_target_month)::date + interval '1 month - 1 day')::date;
          elsif r.monthly_mode='day' then
            v_target_day := extract(day from (pg_catalog.date_trunc('month',v_target_month)::date + interval '1 month - 1 day'))::integer;
            if r.month_day <= v_target_day then v_next := v_target_month + (r.month_day-1); end if;
          else
            v_target_day := extract(dow from v_target_month)::integer;
            if r.month_week='first' then
              v_next := v_target_month + ((r.month_weekday-v_target_day+7)%7);
            else
              v_target_month := (pg_catalog.date_trunc('month',v_target_month)::date + interval '1 month - 1 day')::date;
              v_target_day := extract(dow from v_target_month)::integer;
              v_next := v_target_month - ((v_target_day-r.month_weekday+7)%7);
            end if;
          end if;
          if v_next is not null then exit; end if;
          v_offset := v_offset + r.interval_count;
        end loop;
      elsif r.frequency='yearly' or (r.frequency='custom' and r.custom_unit='year') then
        v_offset := r.interval_count;
        v_next := null;
        while v_offset <= r.interval_count*400 loop
          v_target_month := make_date(extract(year from v_completed_on)::integer+v_offset,r.annual_month,1);
          v_target_day := extract(day from (v_target_month + interval '1 month - 1 day'))::integer;
          if r.annual_day <= v_target_day then v_next := v_target_month + (r.annual_day-1); exit; end if;
          v_offset := v_offset + r.interval_count;
        end loop;
      else
        v_next := null;
      end if;
      if v_next is null or (r.ends_on is not null and v_next>r.ends_on) or (r.max_occurrences is not null and r.occurrences_created>=r.max_occurrences) then
        update public.todo_recurrence_rules set status='ended',next_occurrence_on=null,updated_at=now() where id=r.id and user_id=new.user_id;
      else
        update public.todo_recurrence_rules set next_occurrence_on=v_next,updated_at=now() where id=r.id and user_id=new.user_id;
      end if;
    end if;
  end if;
  return new;
end;
$function$;
create trigger todo_tasks_advance_completion_recurrence after update of status, completed_at on public.todo_tasks for each row execute function public.advance_completion_based_todo_recurrence();

create or replace function public.set_todo_recurrence_state(p_rule_id uuid, p_status text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_status not in ('active','paused','ended') then raise exception 'Invalid recurrence status'; end if;
  update public.todo_recurrence_rules set status=p_status, updated_at=now(), next_occurrence_on=case when p_status='ended' then null else next_occurrence_on end where id=p_rule_id and user_id=auth.uid();
  if not found then raise exception 'Recurrence rule not found'; end if;
end;
$$;

create or replace function public.set_todo_recurrence_exception(p_rule_id uuid,p_occurrence_on date,p_action text,p_override_on date default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_action not in ('skipped','rescheduled') or (p_action='rescheduled' and p_override_on is null) or (p_action='skipped' and p_override_on is not null) then raise exception 'Invalid recurrence exception'; end if;
  if not exists(select 1 from public.todo_recurrence_rules where id=p_rule_id and user_id=auth.uid() and status<>'ended') then raise exception 'Recurrence rule not found'; end if;
  insert into public.todo_recurrence_exceptions(user_id,rule_id,occurrence_on,action,override_on) values(auth.uid(),p_rule_id,p_occurrence_on,p_action,p_override_on)
  on conflict(rule_id,occurrence_on) do update set action=excluded.action,override_on=excluded.override_on;
  if p_action='skipped' then update public.todo_tasks set archived_at=now() where recurrence_rule_id=p_rule_id and recurrence_on=p_occurrence_on and user_id=auth.uid() and status<>'done' and archived_at is null and deleted_at is null; end if;
  if p_action='rescheduled' then update public.todo_tasks set due_on=p_override_on,starts_on=p_override_on,due_at=case when (select time_of_day from public.todo_recurrence_rules where id=p_rule_id and user_id=auth.uid()) is null then null else ((p_override_on+(select time_of_day from public.todo_recurrence_rules where id=p_rule_id and user_id=auth.uid())) at time zone (select timezone from public.todo_recurrence_rules where id=p_rule_id and user_id=auth.uid())) end where recurrence_rule_id=p_rule_id and recurrence_on=p_occurrence_on and user_id=auth.uid() and status<>'done'; end if;
end;
$$;

create or replace function public.save_todo_task_details_with_recurrence_if_unchanged(
  p_task_id uuid, p_list_id uuid, p_workspace_id uuid, p_title text, p_description text,
  p_priority text, p_starts_on date, p_due_on date, p_due_at timestamptz,
  p_label_ids uuid[], p_new_labels text[], p_subtasks jsonb, p_status text,
  p_expected_updated_at timestamptz, p_recurrence jsonb, p_recurrence_scope text default 'occurrence'
)
returns uuid language plpgsql security invoker set search_path = '' as $function$
declare
  v_existing_rule uuid;
  v_task_id uuid;
begin
  if p_recurrence_scope not in ('occurrence','following','series') then raise exception 'Invalid recurrence edit scope'; end if;
  select recurrence_rule_id into v_existing_rule from public.todo_tasks where id=p_task_id and user_id=auth.uid();
  v_task_id := public.save_todo_task_details_if_unchanged(p_task_id,p_list_id,p_workspace_id,p_title,p_description,p_priority,p_starts_on,p_due_on,p_due_at,p_label_ids,p_new_labels,p_subtasks,p_status,p_expected_updated_at);
  if v_existing_rule is not null and p_recurrence_scope='occurrence' then return v_task_id; end if;
  if v_existing_rule is not null and p_recurrence_scope='following' then
    update public.todo_recurrence_rules set status='ended',next_occurrence_on=null,updated_at=now() where id=v_existing_rule and user_id=auth.uid();
    update public.todo_tasks set archived_at=now(),recurrence_rule_id=null,recurrence_on=null
      where user_id=auth.uid() and recurrence_rule_id=v_existing_rule and id<>p_task_id
        and status<>'done' and deleted_at is null and archived_at is null
        and recurrence_on>(select recurrence_on from public.todo_tasks where id=p_task_id and user_id=auth.uid());
    update public.todo_tasks set recurrence_rule_id=null,recurrence_on=null where id=p_task_id and user_id=auth.uid();
  elsif v_existing_rule is not null and p_recurrence is null then
    update public.todo_recurrence_rules set status='ended',next_occurrence_on=null,updated_at=now() where id=v_existing_rule and user_id=auth.uid();
    update public.todo_tasks set recurrence_rule_id=null,recurrence_on=null where id=p_task_id and user_id=auth.uid();
    update public.todo_tasks set archived_at=now(),recurrence_rule_id=null,recurrence_on=null
      where user_id=auth.uid() and recurrence_rule_id=v_existing_rule and id<>p_task_id
        and status<>'done' and deleted_at is null and archived_at is null;
  end if;
  if p_recurrence is null then return v_task_id; end if;
  return public.save_todo_task_with_recurrence(p_task_id,p_list_id,p_workspace_id,p_title,p_description,p_priority,p_starts_on,p_due_on,p_due_at,p_label_ids,p_new_labels,p_subtasks,p_recurrence);
end;
$function$;

revoke all on function public.todo_recurrence_config_json(uuid) from public,anon;
revoke all on function public.save_todo_task_with_recurrence(uuid,uuid,uuid,text,text,text,date,date,timestamptz,uuid[],text[],jsonb,jsonb) from public,anon;
revoke all on function public.ensure_todo_recurrence_occurrences(integer) from public,anon;
revoke all on function public.advance_completion_based_todo_recurrence() from public,anon,authenticated;
revoke all on function public.set_todo_recurrence_state(uuid,text) from public,anon;
revoke all on function public.set_todo_recurrence_exception(uuid,date,text,date) from public,anon;
revoke all on function public.save_todo_task_details_with_recurrence_if_unchanged(uuid,uuid,uuid,text,text,text,date,date,timestamptz,uuid[],text[],jsonb,text,timestamptz,jsonb,text) from public,anon;
grant execute on function public.todo_recurrence_config_json(uuid) to authenticated;
grant execute on function public.save_todo_task_with_recurrence(uuid,uuid,uuid,text,text,text,date,date,timestamptz,uuid[],text[],jsonb,jsonb) to authenticated;
grant execute on function public.ensure_todo_recurrence_occurrences(integer) to authenticated;
grant execute on function public.set_todo_recurrence_state(uuid,text) to authenticated;
grant execute on function public.set_todo_recurrence_exception(uuid,date,text,date) to authenticated;
grant execute on function public.save_todo_task_details_with_recurrence_if_unchanged(uuid,uuid,uuid,text,text,text,date,date,timestamptz,uuid[],text[],jsonb,text,timestamptz,jsonb,text) to authenticated;
