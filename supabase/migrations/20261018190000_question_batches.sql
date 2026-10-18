-- Question practice logs are separate from study sessions. A batch can reference
-- existing planning data but never creates, changes or deletes those records.
create table public.question_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_key uuid not null,
  studied_on date not null,
  subject_id uuid not null,
  topic_id uuid,
  source_type text not null,
  source_label text not null,
  exam_target_id uuid,
  study_session_id uuid,
  question_count integer not null,
  correct_count integer not null,
  duration_minutes integer,
  notes text,
  replaces_session_totals boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  unique (user_id, operation_key),
  foreign key (subject_id, user_id) references public.subjects(id, user_id) on delete restrict,
  foreign key (topic_id, user_id) references public.topics(id, user_id) on delete restrict,
  foreign key (exam_target_id, user_id) references public.exam_targets(id, user_id) on delete restrict,
  foreign key (study_session_id, user_id) references public.study_sessions(id, user_id) on delete restrict,
  check (question_count > 0),
  check (correct_count between 0 and question_count),
  check (duration_minutes is null or duration_minutes between 1 and 1440),
  check (source_type in ('plataforma', 'prova_oficial', 'pdf', 'outro')),
  check (pg_catalog.length(pg_catalog.btrim(source_label)) between 1 and 120),
  check (notes is null or pg_catalog.length(notes) <= 2000),
  check (not replaces_session_totals or study_session_id is not null)
);

create index question_batches_owner_date_idx
  on public.question_batches(user_id, studied_on desc, created_at desc) where deleted_at is null;
create index question_batches_owner_subject_idx
  on public.question_batches(user_id, subject_id, studied_on desc) where deleted_at is null;
create index question_batches_owner_session_idx
  on public.question_batches(user_id, study_session_id) where deleted_at is null;
create unique index question_batches_one_active_replacement_per_session
  on public.question_batches(user_id, study_session_id)
  where deleted_at is null and replaces_session_totals;

drop trigger if exists question_batches_set_updated_at on public.question_batches;
create trigger question_batches_set_updated_at before update on public.question_batches
  for each row execute function private.set_updated_at();

alter table public.question_batches enable row level security;
revoke all on table public.question_batches from anon, authenticated;
grant select, insert, update on table public.question_batches to authenticated;
create policy question_batches_owner_read on public.question_batches for select to authenticated
  using ((select auth.uid()) = user_id);
create policy question_batches_owner_insert on public.question_batches for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy question_batches_owner_update on public.question_batches for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Validate all cross-links in the same transaction as each write. The scoped
-- composite FKs provide an additional owner boundary beneath these rules.
create or replace function private.validate_question_batch_links()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_subject_archived timestamptz;
  v_topic_subject uuid;
  v_topic_archived timestamptz;
  v_target_archived timestamptz;
  v_session_topic uuid;
  v_session_subject uuid;
  v_session_questions integer;
  v_session_correct integer;
  v_session_deleted timestamptz;
begin
  select archived_at into v_subject_archived from public.subjects
    where id = new.subject_id and user_id = new.user_id;
  if not found then raise exception 'subject is unavailable' using errcode = '23503'; end if;
  if v_subject_archived is not null then
    if tg_op = 'INSERT' then raise exception 'archived subject cannot be newly linked' using errcode = '23514'; end if;
    if old.subject_id is distinct from new.subject_id then raise exception 'archived subject cannot be newly linked' using errcode = '23514'; end if;
  end if;

  if new.topic_id is not null then
    select subject_id, archived_at into v_topic_subject, v_topic_archived from public.topics
      where id = new.topic_id and user_id = new.user_id;
    if not found or v_topic_subject <> new.subject_id then
      raise exception 'topic must belong to the selected subject and owner' using errcode = '23503';
    end if;
    if v_topic_archived is not null then
      if tg_op = 'INSERT' then raise exception 'archived topic cannot be newly linked' using errcode = '23514'; end if;
      if old.topic_id is distinct from new.topic_id then raise exception 'archived topic cannot be newly linked' using errcode = '23514'; end if;
    end if;
  end if;

  if new.exam_target_id is not null then
    select archived_at into v_target_archived from public.exam_targets
      where id = new.exam_target_id and user_id = new.user_id;
    if not found or not exists (select 1 from public.exam_subjects es
      where es.user_id = new.user_id and es.exam_target_id = new.exam_target_id and es.subject_id = new.subject_id) then
      raise exception 'subject must already be linked to the selected exam target' using errcode = '23503';
    end if;
    if v_target_archived is not null then
      if tg_op = 'INSERT' then raise exception 'archived exam target cannot be newly linked' using errcode = '23514'; end if;
      if old.exam_target_id is distinct from new.exam_target_id then raise exception 'archived exam target cannot be newly linked' using errcode = '23514'; end if;
    end if;
    if new.topic_id is not null
      and exists (
        select 1 from public.exam_topics et
        join public.topics t on t.id = et.topic_id and t.user_id = et.user_id
        where et.user_id = new.user_id and et.exam_target_id = new.exam_target_id and t.subject_id = new.subject_id
      )
      and not exists (
        select 1 from public.exam_topics et
        where et.user_id = new.user_id and et.exam_target_id = new.exam_target_id and et.topic_id = new.topic_id
      ) then
      raise exception 'topic must be mapped to the selected exam target' using errcode = '23503';
    end if;
  end if;

  if new.study_session_id is not null then
    select s.topic_id, t.subject_id, s.question_count, s.correct_count, s.deleted_at
      into v_session_topic, v_session_subject, v_session_questions, v_session_correct, v_session_deleted
      from public.study_sessions s join public.topics t on t.id = s.topic_id and t.user_id = s.user_id
      where s.id = new.study_session_id and s.user_id = new.user_id;
    if not found or v_session_subject <> new.subject_id
      or (new.topic_id is not null and new.topic_id <> v_session_topic) then
      raise exception 'study session must belong to the selected subject and topic' using errcode = '23503';
    end if;
    if v_session_deleted is not null then
      if tg_op = 'INSERT' then raise exception 'deleted study session cannot be newly linked' using errcode = '23514'; end if;
      if old.study_session_id is distinct from new.study_session_id then raise exception 'deleted study session cannot be newly linked' using errcode = '23514'; end if;
    end if;
    if new.replaces_session_totals and v_session_questions = 0 then
      raise exception 'there are no legacy question totals to replace' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists question_batches_validate_links on public.question_batches;
create trigger question_batches_validate_links before insert or update of subject_id, topic_id, exam_target_id, study_session_id, replaces_session_totals, user_id
  on public.question_batches for each row execute function private.validate_question_batch_links();

create or replace function public.save_question_batch(
  p_batch_id uuid,
  p_operation_key uuid,
  p_studied_on date,
  p_subject_id uuid,
  p_topic_id uuid,
  p_source_type text,
  p_source_label text,
  p_exam_target_id uuid,
  p_study_session_id uuid,
  p_question_count integer,
  p_correct_count integer,
  p_duration_minutes integer,
  p_notes text,
  p_replaces_session_totals boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_batch_id uuid;
  v_existing public.question_batches%rowtype;
  v_timezone text := 'America/Sao_Paulo';
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_operation_key is null or p_studied_on is null or p_subject_id is null
    or p_question_count is null or p_question_count < 1 or p_correct_count is null
    or p_correct_count < 0 or p_correct_count > p_question_count
    or p_duration_minutes is not null and (p_duration_minutes < 1 or p_duration_minutes > 1440)
    or p_source_type not in ('plataforma','prova_oficial','pdf','outro')
    or p_source_label is null or pg_catalog.length(pg_catalog.btrim(p_source_label)) not between 1 and 120
    or p_notes is not null and pg_catalog.length(p_notes) > 2000 then
    raise exception 'invalid question batch input' using errcode = '22023';
  end if;
  select coalesce((select timezone from public.user_settings where user_id = v_user_id), 'America/Sao_Paulo') into v_timezone;
  if p_studied_on > (pg_catalog.now() at time zone v_timezone)::date then
    raise exception 'study date is in the future' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 20261019));
  select id into v_batch_id from public.question_batches
    where user_id = v_user_id and operation_key = p_operation_key;
  if found then
    return pg_catalog.jsonb_build_object('status', 'exists', 'batch_id', v_batch_id);
  end if;

  if p_batch_id is null then
    insert into public.question_batches(user_id, operation_key, studied_on, subject_id, topic_id, source_type, source_label,
      exam_target_id, study_session_id, question_count, correct_count, duration_minutes, notes, replaces_session_totals)
    values (v_user_id, p_operation_key, p_studied_on, p_subject_id, p_topic_id, p_source_type, pg_catalog.btrim(p_source_label),
      p_exam_target_id, p_study_session_id, p_question_count, p_correct_count, p_duration_minutes, nullif(pg_catalog.btrim(p_notes), ''), coalesce(p_replaces_session_totals, false))
    returning id into v_batch_id;
    return pg_catalog.jsonb_build_object('status', 'created', 'batch_id', v_batch_id);
  end if;

  select * into v_existing from public.question_batches where id = p_batch_id and user_id = v_user_id and deleted_at is null for update;
  if not found then return pg_catalog.jsonb_build_object('status', 'not_found'); end if;
  update public.question_batches set studied_on = p_studied_on, subject_id = p_subject_id, topic_id = p_topic_id,
    source_type = p_source_type, source_label = pg_catalog.btrim(p_source_label), exam_target_id = p_exam_target_id,
    study_session_id = p_study_session_id, question_count = p_question_count, correct_count = p_correct_count,
    duration_minutes = p_duration_minutes, notes = nullif(pg_catalog.btrim(p_notes), ''),
    replaces_session_totals = coalesce(p_replaces_session_totals, false), operation_key = p_operation_key
    where id = p_batch_id and user_id = v_user_id;
  return pg_catalog.jsonb_build_object('status', 'updated', 'batch_id', p_batch_id);
end;
$$;

create or replace function public.delete_question_batch(p_batch_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  update public.question_batches set deleted_at = pg_catalog.now()
    where id = p_batch_id and user_id = v_user_id and deleted_at is null;
  if not found then return 'not_found'; end if;
  return 'deleted';
end;
$$;

revoke all on function public.save_question_batch(uuid, uuid, date, uuid, uuid, text, text, uuid, uuid, integer, integer, integer, text, boolean) from public, anon;
revoke all on function public.delete_question_batch(uuid) from public, anon;
grant execute on function public.save_question_batch(uuid, uuid, date, uuid, uuid, text, text, uuid, uuid, integer, integer, integer, text, boolean) to authenticated;
grant execute on function public.delete_question_batch(uuid) to authenticated;
