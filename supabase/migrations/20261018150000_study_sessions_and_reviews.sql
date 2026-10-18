-- Real study records and review obligations. Narrow owner-scoped RPCs perform
-- the atomic writes; direct API writes are revoked and RLS scopes all reads.
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  block_id uuid,
  topic_id uuid not null,
  operation_key uuid not null,
  studied_on date not null,
  duration_minutes integer not null check (duration_minutes > 0),
  question_count integer not null default 0 check (question_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  unique (user_id, operation_key),
  foreign key (topic_id, user_id) references public.topics(id, user_id) on delete restrict,
  foreign key (block_id, user_id) references public.study_blocks(id, user_id) on delete restrict,
  check (correct_count <= question_count),
  check (notes is null or pg_catalog.length(notes) <= 2000)
);
create unique index if not exists study_sessions_one_active_per_block
  on public.study_sessions(block_id) where block_id is not null and deleted_at is null;
create index if not exists study_sessions_owner_date_idx
  on public.study_sessions(user_id, studied_on desc, created_at desc) where deleted_at is null;

create table if not exists public.review_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  study_session_id uuid not null,
  topic_id uuid not null,
  review_kind text not null default 'standard' check (review_kind in ('standard', 'reinforcement')),
  interval_days integer not null check (interval_days > 0),
  due_on date not null,
  initial_due_on date not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  completed_at timestamptz,
  difficulty smallint check (difficulty is null or difficulty between 1 and 5),
  notes text,
  parent_review_id uuid,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  foreign key (study_session_id, user_id) references public.study_sessions(id, user_id) on delete restrict,
  foreign key (topic_id, user_id) references public.topics(id, user_id) on delete restrict,
  foreign key (parent_review_id, user_id) references public.review_tasks(id, user_id) on delete restrict,
  check (review_kind <> 'standard' or interval_days in (1, 7, 30))
);
create unique index if not exists review_tasks_standard_interval_key
  on public.review_tasks(study_session_id, interval_days) where review_kind = 'standard';
create index if not exists review_tasks_owner_due_idx
  on public.review_tasks(user_id, due_on) where status = 'pending';

create table if not exists public.review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_task_id uuid not null,
  action text not null check (action in ('completed', 'rescheduled', 'cancelled', 'restored')),
  old_due_on date,
  new_due_on date,
  notes text,
  occurred_at timestamptz not null default pg_catalog.now(),
  foreign key (review_task_id, user_id) references public.review_tasks(id, user_id) on delete restrict
);
create index if not exists review_events_owner_task_idx on public.review_events(user_id, review_task_id, occurred_at);

drop trigger if exists study_sessions_set_updated_at on public.study_sessions;
create trigger study_sessions_set_updated_at before update on public.study_sessions
  for each row execute function private.set_updated_at();
drop trigger if exists review_tasks_set_updated_at on public.review_tasks;
create trigger review_tasks_set_updated_at before update on public.review_tasks
  for each row execute function private.set_updated_at();

alter table public.study_sessions enable row level security;
alter table public.review_tasks enable row level security;
alter table public.review_events enable row level security;
revoke all on table public.study_sessions, public.review_tasks, public.review_events from anon, authenticated;
grant select on table public.study_sessions, public.review_tasks, public.review_events to authenticated;
create policy study_sessions_owner_all on public.study_sessions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy review_tasks_owner_all on public.review_tasks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy review_events_owner_read on public.review_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy review_events_owner_insert on public.review_events for insert to authenticated
  with check ((select auth.uid()) = user_id);

create or replace function public.save_study_session(
  p_session_id uuid,
  p_operation_key uuid,
  p_block_id uuid,
  p_topic_id uuid,
  p_studied_on date,
  p_duration_minutes integer,
  p_question_count integer,
  p_correct_count integer,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_existing public.study_sessions%rowtype;
  v_block public.study_blocks%rowtype;
  v_dates date[];
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_topic_id is null or p_studied_on is null or p_duration_minutes is null or p_duration_minutes <= 0
    or p_question_count is null or p_question_count < 0 or p_correct_count is null
    or p_correct_count < 0 or p_correct_count > p_question_count
    or (p_notes is not null and pg_catalog.length(p_notes) > 2000)
    or (p_session_id is null and p_operation_key is null) then
    return pg_catalog.jsonb_build_object('status', 'invalid_input');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 20261018));
  if p_session_id is not null then
    select * into v_existing from public.study_sessions
    where id = p_session_id and user_id = v_user_id and deleted_at is null for update;
    if not found then return pg_catalog.jsonb_build_object('status', 'not_found'); end if;
    if v_existing.block_id is distinct from p_block_id or v_existing.topic_id <> p_topic_id then
      return pg_catalog.jsonb_build_object('status', 'invalid_relation');
    end if;
    update public.study_sessions set studied_on = p_studied_on, duration_minutes = p_duration_minutes,
      question_count = p_question_count, correct_count = p_correct_count, notes = nullif(pg_catalog.btrim(p_notes), '')
      where id = p_session_id and user_id = v_user_id;
    update public.review_tasks set due_on = p_studied_on + interval_days
      where study_session_id = p_session_id and user_id = v_user_id and review_kind = 'standard' and status = 'pending';
    v_session_id := p_session_id;
  else
    if p_block_id is not null then
      select * into v_block from public.study_blocks where id = p_block_id and user_id = v_user_id for update;
      if not found or v_block.topic_id <> p_topic_id or v_block.status = 'ignorado' then
        return pg_catalog.jsonb_build_object('status', 'invalid_relation');
      end if;
      select * into v_existing from public.study_sessions where block_id = p_block_id and deleted_at is null;
      if found then
        select pg_catalog.array_agg(due_on order by interval_days) into v_dates
          from public.review_tasks where study_session_id = v_existing.id and user_id = v_user_id and review_kind = 'standard';
        return pg_catalog.jsonb_build_object('status', 'exists', 'session_id', v_existing.id, 'review_dates', coalesce(to_jsonb(v_dates), '[]'::jsonb));
      end if;
    end if;
    select id into v_session_id from public.study_sessions
      where user_id = v_user_id and operation_key = p_operation_key and deleted_at is null;
    if v_session_id is not null then
      select pg_catalog.array_agg(due_on order by interval_days) into v_dates
        from public.review_tasks where study_session_id = v_session_id and user_id = v_user_id and review_kind = 'standard';
      return pg_catalog.jsonb_build_object('status', 'exists', 'session_id', v_session_id, 'review_dates', coalesce(to_jsonb(v_dates), '[]'::jsonb));
    end if;
    insert into public.study_sessions(user_id, block_id, topic_id, operation_key, studied_on, duration_minutes, question_count, correct_count, notes)
    values (v_user_id, p_block_id, p_topic_id, p_operation_key, p_studied_on, p_duration_minutes, p_question_count, p_correct_count, nullif(pg_catalog.btrim(p_notes), ''))
    returning id into v_session_id;
    if p_block_id is not null and v_block.status in ('planejado', 'em_andamento') then
      update public.study_blocks set status = 'concluido' where id = p_block_id and user_id = v_user_id;
    end if;
    insert into public.review_tasks(user_id, study_session_id, topic_id, review_kind, interval_days, due_on, initial_due_on)
    select v_user_id, v_session_id, p_topic_id, 'standard', interval_days,
      p_studied_on + interval_days, p_studied_on + interval_days from (values (1), (7), (30)) intervals(interval_days);
  end if;
  select pg_catalog.array_agg(due_on order by interval_days) into v_dates
    from public.review_tasks where study_session_id = v_session_id and user_id = v_user_id and review_kind = 'standard';
  return pg_catalog.jsonb_build_object('status', case when p_session_id is null then 'created' else 'updated' end,
    'session_id', v_session_id, 'review_dates', coalesce(to_jsonb(v_dates), '[]'::jsonb));
end;
$$;

create or replace function public.delete_study_session(p_session_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.study_sessions%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 20261018));
  select * into v_session from public.study_sessions
    where id = p_session_id and user_id = v_user_id and deleted_at is null for update;
  if not found then return 'not_found'; end if;
  insert into public.review_events(user_id, review_task_id, action, old_due_on, notes)
    select v_user_id, id, 'cancelled', due_on, 'Estudo excluído; revisão pendente cancelada.'
    from public.review_tasks where study_session_id = v_session.id and user_id = v_user_id and status = 'pending';
  update public.review_tasks set status = 'cancelled'
    where study_session_id = v_session.id and user_id = v_user_id and status = 'pending';
  update public.study_sessions set deleted_at = pg_catalog.now() where id = v_session.id and user_id = v_user_id;
  if v_session.block_id is not null and not exists (
    select 1 from public.study_sessions where block_id = v_session.block_id and user_id = v_user_id and deleted_at is null
  ) then
    update public.study_blocks set status = 'planejado'
      where id = v_session.block_id and user_id = v_user_id and status = 'concluido';
  end if;
  return 'deleted';
end;
$$;

-- These narrowly scoped SECURITY DEFINER RPCs are required because direct
-- table writes are revoked. Each derives identity from auth.uid(), validates
-- ownership, and performs the whole session/review/block transaction atomically.

revoke all on function public.save_study_session(uuid, uuid, uuid, uuid, date, integer, integer, integer, text) from public, anon;
revoke all on function public.delete_study_session(uuid) from public, anon;
grant execute on function public.save_study_session(uuid, uuid, uuid, uuid, date, integer, integer, integer, text) to authenticated;
grant execute on function public.delete_study_session(uuid) to authenticated;
