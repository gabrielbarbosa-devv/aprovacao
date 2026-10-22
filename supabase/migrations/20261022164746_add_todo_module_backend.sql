-- Additive To-Do module storage. No existing contest tables are modified.

create table public.todo_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  icon text not null default 'list-todo',
  color text not null default 'blue',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint todo_lists_id_user_id_key unique (id, user_id),
  constraint todo_lists_user_slug_key unique (user_id, slug)
);

create table public.todo_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  description text check (description is null or length(description) <= 2000),
  icon text not null default 'briefcase',
  color text not null default 'violet',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint todo_workspaces_id_user_id_key unique (id, user_id)
);

create table public.todo_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid not null,
  workspace_id uuid,
  title text not null check (length(btrim(title)) between 1 and 240),
  description text check (description is null or length(description) <= 10000),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  starts_on date not null default current_date,
  due_on date,
  due_at timestamptz,
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint todo_tasks_id_user_id_key unique (id, user_id),
  constraint todo_tasks_list_owner_fkey foreign key (list_id, user_id)
    references public.todo_lists(id, user_id) on delete restrict,
  constraint todo_tasks_workspace_owner_fkey foreign key (workspace_id, user_id)
    references public.todo_workspaces(id, user_id) on delete restrict,
  constraint todo_tasks_due_after_start check (due_on is null or due_on >= starts_on),
  constraint todo_tasks_completion_consistent check (
    (status = 'done' and completed_at is not null) or (status <> 'done' and completed_at is null)
  )
);

create table public.todo_subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 240),
  is_completed boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint todo_subtasks_task_owner_fkey foreign key (task_id, user_id)
    references public.todo_tasks(id, user_id) on delete cascade
);

create table public.todo_labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  color text not null default 'slate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint todo_labels_id_user_id_key unique (id, user_id)
);

create unique index todo_labels_user_name_unique on public.todo_labels (user_id, lower(name));

create table public.todo_task_labels (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null,
  label_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, task_id, label_id),
  constraint todo_task_labels_task_owner_fkey foreign key (task_id, user_id)
    references public.todo_tasks(id, user_id) on delete cascade,
  constraint todo_task_labels_label_owner_fkey foreign key (label_id, user_id)
    references public.todo_labels(id, user_id) on delete cascade
);

create table public.todo_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null,
  action text not null check (action in ('created', 'updated', 'status_changed', 'completed', 'reopened', 'soft_deleted')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint todo_activity_logs_task_owner_fkey foreign key (task_id, user_id)
    references public.todo_tasks(id, user_id) on delete cascade
);

create index todo_lists_user_position_idx on public.todo_lists (user_id, position, name);
create index todo_workspaces_user_created_idx on public.todo_workspaces (user_id, created_at desc);
create index todo_tasks_user_status_due_idx on public.todo_tasks (user_id, status, due_on) where deleted_at is null;
create index todo_tasks_user_list_position_idx on public.todo_tasks (user_id, list_id, position) where deleted_at is null;
create index todo_tasks_user_workspace_position_idx on public.todo_tasks (user_id, workspace_id, position) where deleted_at is null;
create index todo_tasks_user_starts_on_idx on public.todo_tasks (user_id, starts_on) where deleted_at is null;
create index todo_subtasks_task_position_idx on public.todo_subtasks (user_id, task_id, position);
create index todo_task_labels_label_idx on public.todo_task_labels (user_id, label_id);
create index todo_activity_logs_task_created_idx on public.todo_activity_logs (user_id, task_id, created_at desc);

grant select, insert, update, delete on public.todo_lists, public.todo_workspaces,
  public.todo_tasks, public.todo_subtasks, public.todo_labels,
  public.todo_task_labels, public.todo_activity_logs to authenticated;
revoke all on public.todo_lists, public.todo_workspaces, public.todo_tasks,
  public.todo_subtasks, public.todo_labels, public.todo_task_labels,
  public.todo_activity_logs from anon;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'todo_lists', 'todo_workspaces', 'todo_tasks', 'todo_subtasks',
    'todo_labels', 'todo_task_labels', 'todo_activity_logs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (auth.uid() is not null and auth.uid() = user_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (auth.uid() is not null and auth.uid() = user_id)', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (auth.uid() is not null and auth.uid() = user_id) with check (auth.uid() is not null and auth.uid() = user_id)', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (auth.uid() is not null and auth.uid() = user_id)', table_name || '_delete_own', table_name);
  end loop;
end;
$$;

create or replace function public.set_todo_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function public.set_todo_updated_at() from public, anon, authenticated;

create trigger todo_lists_set_updated_at before update on public.todo_lists
for each row execute function public.set_todo_updated_at();
create trigger todo_workspaces_set_updated_at before update on public.todo_workspaces
for each row execute function public.set_todo_updated_at();
create trigger todo_tasks_set_updated_at before update on public.todo_tasks
for each row execute function public.set_todo_updated_at();
create trigger todo_subtasks_set_updated_at before update on public.todo_subtasks
for each row execute function public.set_todo_updated_at();
create trigger todo_labels_set_updated_at before update on public.todo_labels
for each row execute function public.set_todo_updated_at();

create or replace function public.log_todo_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed jsonb := '{}'::jsonb;
  log_action text;
begin
  if tg_op = 'INSERT' then
    log_action := 'created';
    changed := jsonb_build_object('status', new.status, 'priority', new.priority, 'list_id', new.list_id, 'workspace_id', new.workspace_id);
  else
    if old.status is distinct from new.status then
      log_action := case when new.status = 'done' then 'completed' when old.status = 'done' then 'reopened' else 'status_changed' end;
      changed := changed || jsonb_build_object('status', jsonb_build_object('from', old.status, 'to', new.status));
    elsif old.deleted_at is null and new.deleted_at is not null then
      log_action := 'soft_deleted';
      changed := changed || jsonb_build_object('deleted_at', new.deleted_at);
    else
      log_action := 'updated';
    end if;
    if old.priority is distinct from new.priority then changed := changed || jsonb_build_object('priority', jsonb_build_object('from', old.priority, 'to', new.priority)); end if;
    if old.due_on is distinct from new.due_on then changed := changed || jsonb_build_object('due_on', jsonb_build_object('from', old.due_on, 'to', new.due_on)); end if;
    if old.due_at is distinct from new.due_at then changed := changed || jsonb_build_object('due_at', jsonb_build_object('from', old.due_at, 'to', new.due_at)); end if;
    if old.list_id is distinct from new.list_id then changed := changed || jsonb_build_object('list_id', jsonb_build_object('from', old.list_id, 'to', new.list_id)); end if;
    if old.workspace_id is distinct from new.workspace_id then changed := changed || jsonb_build_object('workspace_id', jsonb_build_object('from', old.workspace_id, 'to', new.workspace_id)); end if;
    if old.title is distinct from new.title then changed := changed || jsonb_build_object('title_changed', true); end if;
    if old.description is distinct from new.description then changed := changed || jsonb_build_object('description_changed', true); end if;
    if changed = '{}'::jsonb then return new; end if;
  end if;

  insert into public.todo_activity_logs(user_id, task_id, action, metadata)
  values (new.user_id, new.id, log_action, changed);
  return new;
end;
$$;
revoke all on function public.log_todo_task_activity() from public, anon, authenticated;

create trigger todo_tasks_log_activity after insert or update on public.todo_tasks
for each row execute function public.log_todo_task_activity();

create or replace function public.initialize_todo_lists()
returns setof public.todo_lists
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;

  insert into public.todo_lists(user_id, name, slug, icon, color, position)
  values
    (current_user_id, 'Pessoal', 'pessoal', 'user-round', 'blue', 0),
    (current_user_id, 'Trabalho', 'trabalho', 'briefcase-business', 'violet', 1)
  on conflict (user_id, slug) do nothing;

  return query
  select l.* from public.todo_lists l
  where l.user_id = current_user_id and l.slug in ('pessoal', 'trabalho')
  order by l.position, l.name;
end;
$$;
revoke all on function public.initialize_todo_lists() from public, anon;
grant execute on function public.initialize_todo_lists() to authenticated;
