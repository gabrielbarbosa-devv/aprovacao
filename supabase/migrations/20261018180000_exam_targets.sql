-- User-managed exam objectives. Sessions, blocks and reviews remain shared;
-- targets only reference existing subjects/topics.
create table public.exam_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_name text not null,
  institution text not null,
  role_title text not null,
  jurisdiction text not null,
  current_stage text not null default 'em_preparacao',
  priority text not null default 'media',
  exam_date date,
  application_deadline date,
  official_url text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  check (pg_catalog.length(pg_catalog.btrim(exam_name)) between 1 and 120),
  check (pg_catalog.length(pg_catalog.btrim(institution)) between 1 and 120),
  check (pg_catalog.length(pg_catalog.btrim(role_title)) between 1 and 120),
  check (jurisdiction = 'Federal' or jurisdiction in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  check (current_stage in ('em_preparacao','edital_publicado','inscricao_aberta','prova_realizada')),
  check (priority in ('alta','media','baixa')),
  check (application_deadline is null or exam_date is null or application_deadline <= exam_date),
  check (official_url is null or (official_url ~* '^https?://[^[:space:]]+$' and pg_catalog.length(official_url) <= 2000)),
  check (notes is null or pg_catalog.length(notes) <= 4000)
);

create table public.exam_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_target_id uuid not null,
  subject_id uuid not null,
  importance text,
  official_question_weight integer,
  source_url text,
  created_at timestamptz not null default pg_catalog.now(),
  unique (exam_target_id, subject_id),
  foreign key (exam_target_id, user_id) references public.exam_targets(id, user_id) on delete cascade,
  foreign key (subject_id, user_id) references public.subjects(id, user_id) on delete restrict,
  check (importance is null or importance in ('alta','media','baixa')),
  check (official_question_weight is null or official_question_weight between 0 and 100),
  check (official_question_weight is null or source_url is not null),
  check (source_url is null or (source_url ~* '^https?://[^[:space:]]+$' and pg_catalog.length(source_url) <= 2000))
);

create table public.exam_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_target_id uuid not null,
  topic_id uuid not null,
  created_at timestamptz not null default pg_catalog.now(),
  unique (exam_target_id, topic_id),
  foreign key (exam_target_id, user_id) references public.exam_targets(id, user_id) on delete cascade,
  foreign key (topic_id, user_id) references public.topics(id, user_id) on delete restrict
);

create index exam_targets_owner_active_idx on public.exam_targets(user_id, created_at desc) where archived_at is null;
create index exam_subjects_owner_target_idx on public.exam_subjects(user_id, exam_target_id);
create index exam_topics_owner_target_idx on public.exam_topics(user_id, exam_target_id);

drop trigger if exists exam_targets_set_updated_at on public.exam_targets;
create trigger exam_targets_set_updated_at before update on public.exam_targets
  for each row execute function private.set_updated_at();

-- A target may map a topic only after its parent subject is linked to that target.
create or replace function private.require_linked_subject_for_exam_topic()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.topics t
    join public.exam_subjects es on es.subject_id = t.subject_id and es.user_id = t.user_id
    where t.id = new.topic_id and t.user_id = new.user_id
      and es.exam_target_id = new.exam_target_id
  ) then
    raise exception 'Topic must belong to a linked subject owned by this user' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists exam_topics_require_linked_subject on public.exam_topics;
create trigger exam_topics_require_linked_subject before insert or update of exam_target_id, topic_id, user_id
  on public.exam_topics for each row execute function private.require_linked_subject_for_exam_topic();

drop trigger if exists exam_subjects_remove_topic_links on public.exam_subjects;
create or replace function private.remove_unlinked_exam_topics()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.exam_topics where exam_target_id = old.exam_target_id
    and user_id = old.user_id and topic_id in (
      select t.id from public.topics t where t.subject_id = old.subject_id and t.user_id = old.user_id
    );
  return old;
end;
$$;
create trigger exam_subjects_remove_topic_links after delete on public.exam_subjects
  for each row execute function private.remove_unlinked_exam_topics();

alter table public.exam_targets enable row level security;
alter table public.exam_subjects enable row level security;
alter table public.exam_topics enable row level security;
revoke all on table public.exam_targets, public.exam_subjects, public.exam_topics from anon, authenticated;
grant select, insert, update, delete on table public.exam_targets, public.exam_subjects, public.exam_topics to authenticated;
create policy exam_targets_owner_all on public.exam_targets for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy exam_subjects_owner_all on public.exam_subjects for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy exam_topics_owner_all on public.exam_topics for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- One transaction validates ownership and replaces the target's subject/topic
-- mappings. RLS remains in force because this function is SECURITY INVOKER.
create or replace function public.save_exam_target(
  p_target_id uuid,
  p_exam_name text,
  p_institution text,
  p_role_title text,
  p_jurisdiction text,
  p_current_stage text,
  p_priority text,
  p_exam_date date,
  p_application_deadline date,
  p_official_url text,
  p_notes text,
  p_subject_ids uuid[],
  p_topic_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_target_id uuid;
  v_archived_at timestamptz;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_subject_ids is null or p_topic_ids is null
    or pg_catalog.cardinality(p_subject_ids) > 500 or pg_catalog.cardinality(p_topic_ids) > 2000
    or exists (select 1 from pg_catalog.unnest(p_subject_ids) x(id) where x.id is null)
    or exists (select 1 from pg_catalog.unnest(p_topic_ids) x(id) where x.id is null)
    or pg_catalog.cardinality(p_subject_ids) <> (select pg_catalog.count(distinct x.id)::integer from pg_catalog.unnest(p_subject_ids) x(id))
    or pg_catalog.cardinality(p_topic_ids) <> (select pg_catalog.count(distinct x.id)::integer from pg_catalog.unnest(p_topic_ids) x(id)) then
    raise exception 'invalid subject or topic selection' using errcode = '22023';
  end if;
  if p_official_url is not null and (p_official_url !~* '^https?://[^[:space:]]+$' or pg_catalog.length(p_official_url) > 2000) then
    raise exception 'invalid official URL' using errcode = '22023';
  end if;
  if p_application_deadline is not null and p_exam_date is not null and p_application_deadline > p_exam_date then
    raise exception 'application deadline must not follow the exam date' using errcode = '22023';
  end if;

  if p_target_id is null then
    insert into public.exam_targets(user_id, exam_name, institution, role_title, jurisdiction, current_stage, priority, exam_date, application_deadline, official_url, notes)
      values (v_user_id, pg_catalog.btrim(p_exam_name), pg_catalog.btrim(p_institution), pg_catalog.btrim(p_role_title), p_jurisdiction, p_current_stage, p_priority, p_exam_date, p_application_deadline, nullif(pg_catalog.btrim(p_official_url), ''), nullif(pg_catalog.btrim(p_notes), ''))
      returning id, archived_at into v_target_id, v_archived_at;
  else
    update public.exam_targets set exam_name = pg_catalog.btrim(p_exam_name), institution = pg_catalog.btrim(p_institution),
      role_title = pg_catalog.btrim(p_role_title), jurisdiction = p_jurisdiction, current_stage = p_current_stage,
      priority = p_priority, exam_date = p_exam_date, application_deadline = p_application_deadline,
      official_url = nullif(pg_catalog.btrim(p_official_url), ''), notes = nullif(pg_catalog.btrim(p_notes), '')
      where id = p_target_id and user_id = v_user_id and archived_at is null
      returning id, archived_at into v_target_id, v_archived_at;
    if not found then raise exception 'active exam target not found' using errcode = 'P0002'; end if;
  end if;

  if exists (
    select 1 from pg_catalog.unnest(p_subject_ids) x(id)
    left join public.subjects s on s.id = x.id and s.user_id = v_user_id
    where s.id is null or (s.archived_at is not null and not exists (
      select 1 from public.exam_subjects es where es.user_id = v_user_id and es.exam_target_id = v_target_id and es.subject_id = s.id
    ))
  ) then raise exception 'subject is unavailable or belongs to another user' using errcode = '23503'; end if;

  if exists (
    select 1 from pg_catalog.unnest(p_topic_ids) x(id)
    left join public.topics t on t.id = x.id and t.user_id = v_user_id
    where t.id is null or not (t.subject_id = any(p_subject_ids))
      or (t.archived_at is not null and not exists (
        select 1 from public.exam_topics et where et.user_id = v_user_id and et.exam_target_id = v_target_id and et.topic_id = t.id
      ))
  ) then raise exception 'topic must belong to a selected subject owned by this user' using errcode = '23503'; end if;

  delete from public.exam_topics where user_id = v_user_id and exam_target_id = v_target_id and not (topic_id = any(p_topic_ids));
  delete from public.exam_subjects where user_id = v_user_id and exam_target_id = v_target_id and not (subject_id = any(p_subject_ids));
  insert into public.exam_subjects(user_id, exam_target_id, subject_id)
    select v_user_id, v_target_id, x.id from pg_catalog.unnest(p_subject_ids) x(id)
    on conflict (exam_target_id, subject_id) do nothing;
  insert into public.exam_topics(user_id, exam_target_id, topic_id)
    select v_user_id, v_target_id, x.id from pg_catalog.unnest(p_topic_ids) x(id)
    on conflict (exam_target_id, topic_id) do nothing;

  return pg_catalog.jsonb_build_object('status', 'saved', 'target_id', v_target_id);
end;
$$;

revoke all on function public.save_exam_target(uuid, text, text, text, text, text, text, date, date, text, text, uuid[], uuid[]) from public, anon;
grant execute on function public.save_exam_target(uuid, text, text, text, text, text, text, date, date, text, text, uuid[], uuid[]) to authenticated;
