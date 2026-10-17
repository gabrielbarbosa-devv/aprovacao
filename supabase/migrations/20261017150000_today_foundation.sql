-- Foundation for the Hoje screen. These tables start empty; users explicitly
-- create their own starter plan through create_starter_plan().

create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  daily_goal_minutes integer not null default 240 check (daily_goal_minutes > 0),
  weekly_availability jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (pg_catalog.length(pg_catalog.btrim(name)) > 0),
  color_token text,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id)
);

create unique index subjects_user_name_ci_key
  on public.subjects (user_id, pg_catalog.lower(name));

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null,
  title text not null check (pg_catalog.length(pg_catalog.btrim(title)) > 0),
  sort_order integer not null default 0,
  status text not null default 'nao_iniciado'
    check (status in ('nao_iniciado', 'em_andamento', 'concluido')),
  priority text not null default 'media'
    check (priority in ('baixa', 'media', 'alta')),
  archived_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  foreign key (subject_id, user_id)
    references public.subjects (id, user_id) on delete restrict
);

create table public.study_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null,
  planned_date date not null,
  planned_minutes integer not null check (planned_minutes > 0),
  sort_order integer not null default 0,
  status text not null default 'planejado'
    check (status in ('planejado', 'em_andamento', 'concluido', 'ignorado')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  foreign key (topic_id, user_id)
    references public.topics (id, user_id) on delete restrict
);

create index study_blocks_user_date_order_idx
  on public.study_blocks (user_id, planned_date, sort_order);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function private.set_updated_at();

create trigger subjects_set_updated_at
  before update on public.subjects
  for each row execute function private.set_updated_at();

create trigger topics_set_updated_at
  before update on public.topics
  for each row execute function private.set_updated_at();

create trigger study_blocks_set_updated_at
  before update on public.study_blocks
  for each row execute function private.set_updated_at();

alter table public.user_settings enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.study_blocks enable row level security;

revoke all on table public.user_settings, public.subjects, public.topics, public.study_blocks
  from anon, authenticated;
grant select, insert, update, delete on table public.user_settings, public.subjects, public.topics, public.study_blocks
  to authenticated;

create policy "user_settings_owner_all"
  on public.user_settings for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "subjects_owner_all"
  on public.subjects for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "topics_owner_all"
  on public.topics for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "study_blocks_owner_all"
  on public.study_blocks for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.create_starter_plan(p_start_date date)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_portuguese_subject_id uuid;
  v_penal_subject_id uuid;
  v_portuguese_topic_id uuid;
  v_penal_topic_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  -- Serialize repeated/parallel starter-plan requests for the same account.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 180716)
  );

  if p_start_date < (pg_catalog.now() at time zone coalesce((
    select timezone from public.user_settings where user_id = v_user_id
  ), 'America/Sao_Paulo'))::date then
    return 'invalid_date';
  end if;

  insert into public.user_settings (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  perform 1
  from public.user_settings
  where user_id = v_user_id
  for update;

  if exists (select 1 from public.subjects where user_id = v_user_id)
     or exists (select 1 from public.study_blocks where user_id = v_user_id) then
    return 'already_exists';
  end if;

  insert into public.subjects (user_id, name, sort_order)
  values
    (v_user_id, 'Português', 1),
    (v_user_id, 'Matemática', 2),
    (v_user_id, 'Raciocínio Lógico', 3),
    (v_user_id, 'Direito Administrativo', 4),
    (v_user_id, 'Direito Penal', 5),
    (v_user_id, 'Direito Processual Penal', 6);

  select id into strict v_portuguese_subject_id
  from public.subjects
  where user_id = v_user_id and name = 'Português';

  select id into strict v_penal_subject_id
  from public.subjects
  where user_id = v_user_id and name = 'Direito Penal';

  insert into public.topics (user_id, subject_id, title, sort_order)
  values
    (v_user_id, v_portuguese_subject_id, 'Interpretação de texto', 1)
  returning id into v_portuguese_topic_id;

  insert into public.topics (user_id, subject_id, title, sort_order)
  values
    (v_user_id, v_penal_subject_id, 'Princípios e aplicação da lei penal', 1)
  returning id into v_penal_topic_id;

  insert into public.study_blocks (user_id, topic_id, planned_date, planned_minutes, sort_order)
  values
    (v_user_id, v_portuguese_topic_id, p_start_date, 120, 1),
    (v_user_id, v_penal_topic_id, p_start_date, 120, 2);

  return 'created';
end;
$$;

create or replace function public.start_study_block(p_block_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select status into v_status
  from public.study_blocks
  where id = p_block_id and user_id = v_user_id
  for update;

  if not found then
    return 'not_found';
  end if;

  if (select planned_date from public.study_blocks where id = p_block_id and user_id = v_user_id)
     > (pg_catalog.now() at time zone coalesce((
       select timezone from public.user_settings where user_id = v_user_id
     ), 'America/Sao_Paulo'))::date then
    return 'invalid_state';
  end if;

  if v_status = 'em_andamento' then
    return 'already_in_progress';
  end if;

  if v_status <> 'planejado' then
    return 'invalid_state';
  end if;

  update public.study_blocks
  set status = 'em_andamento'
  where id = p_block_id and user_id = v_user_id;

  return 'started';
end;
$$;

revoke all on function public.create_starter_plan(date) from public, anon;
revoke all on function public.start_study_block(uuid) from public, anon;
grant execute on function public.create_starter_plan(date) to authenticated;
grant execute on function public.start_study_block(uuid) to authenticated;
