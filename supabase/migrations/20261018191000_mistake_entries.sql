-- The error notebook stores only qualitative learning notes. It does not
-- modify question totals, study sessions, planning blocks or review tasks.
create table public.mistake_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_key uuid not null,
  subject_id uuid not null,
  topic_id uuid,
  question_batch_id uuid,
  reason text not null,
  thought text not null,
  correct_rule text not null,
  next_step text,
  external_reference text,
  status text not null default 'needs_review',
  deleted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id),
  unique (user_id, operation_key),
  foreign key (subject_id, user_id) references public.subjects(id, user_id) on delete restrict,
  foreign key (topic_id, user_id) references public.topics(id, user_id) on delete restrict,
  foreign key (question_batch_id, user_id) references public.question_batches(id, user_id) on delete set null (question_batch_id),
  check (reason in ('conteudo', 'interpretacao', 'desatencao', 'tempo', 'confusao_regra', 'outro')),
  check (status in ('needs_review', 'in_review', 'understood')),
  check (pg_catalog.length(pg_catalog.btrim(thought)) between 1 and 3000),
  check (pg_catalog.length(pg_catalog.btrim(correct_rule)) between 1 and 3000),
  check (next_step is null or pg_catalog.length(pg_catalog.btrim(next_step)) <= 1000),
  check (external_reference is null or pg_catalog.length(pg_catalog.btrim(external_reference)) <= 500)
);

create index mistake_entries_owner_created_idx
  on public.mistake_entries(user_id, created_at desc) where deleted_at is null;
create index mistake_entries_owner_status_idx
  on public.mistake_entries(user_id, status, created_at desc) where deleted_at is null;
create index mistake_entries_owner_subject_idx
  on public.mistake_entries(user_id, subject_id, created_at desc) where deleted_at is null;
create index mistake_entries_owner_batch_idx
  on public.mistake_entries(user_id, question_batch_id) where deleted_at is null;

drop trigger if exists mistake_entries_set_updated_at on public.mistake_entries;
create trigger mistake_entries_set_updated_at before update on public.mistake_entries
  for each row execute function private.set_updated_at();

alter table public.mistake_entries enable row level security;
revoke all on table public.mistake_entries from anon, authenticated;
grant select, insert, update on table public.mistake_entries to authenticated;
create policy mistake_entries_owner_read on public.mistake_entries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy mistake_entries_owner_insert on public.mistake_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy mistake_entries_owner_update on public.mistake_entries for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function private.validate_mistake_entry_links()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_subject_archived timestamptz;
  v_topic_subject uuid;
  v_topic_archived timestamptz;
  v_batch_subject uuid;
  v_batch_topic uuid;
  v_batch_deleted timestamptz;
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

  if new.question_batch_id is not null then
    select subject_id, topic_id, deleted_at into v_batch_subject, v_batch_topic, v_batch_deleted
      from public.question_batches where id = new.question_batch_id and user_id = new.user_id;
    if not found or v_batch_subject <> new.subject_id
      or (new.topic_id is not null and v_batch_topic is not null and new.topic_id <> v_batch_topic) then
      raise exception 'question batch must match the selected subject and topic' using errcode = '23503';
    end if;
    if v_batch_deleted is not null then
      if tg_op = 'INSERT' then raise exception 'archived question batch cannot be newly linked' using errcode = '23514'; end if;
      if old.question_batch_id is distinct from new.question_batch_id then raise exception 'archived question batch cannot be newly linked' using errcode = '23514'; end if;
    end if;
  end if;

  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'entry owner cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists mistake_entries_validate_links on public.mistake_entries;
create trigger mistake_entries_validate_links before insert or update of subject_id, topic_id, question_batch_id, user_id
  on public.mistake_entries for each row execute function private.validate_mistake_entry_links();

create or replace function public.save_mistake_entry(
  p_entry_id uuid,
  p_operation_key uuid,
  p_subject_id uuid,
  p_topic_id uuid,
  p_question_batch_id uuid,
  p_reason text,
  p_thought text,
  p_correct_rule text,
  p_next_step text,
  p_external_reference text,
  p_status text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_entry_id uuid;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_operation_key is null or p_subject_id is null or p_reason is null or p_status is null
    or p_reason not in ('conteudo','interpretacao','desatencao','tempo','confusao_regra','outro')
    or p_status not in ('needs_review','in_review','understood')
    or p_thought is null or pg_catalog.length(pg_catalog.btrim(p_thought)) not between 1 and 3000
    or p_correct_rule is null or pg_catalog.length(pg_catalog.btrim(p_correct_rule)) not between 1 and 3000
    or p_next_step is not null and pg_catalog.length(pg_catalog.btrim(p_next_step)) > 1000
    or p_external_reference is not null and (
      pg_catalog.length(pg_catalog.btrim(p_external_reference)) > 500
      or p_external_reference ~ '[[:space:][:cntrl:]]'
      or (p_external_reference ~* '^[a-z][a-z0-9+.-]*:' and p_external_reference !~* '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$')
    ) then
    raise exception 'invalid mistake entry input' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 20261020));
  select id into v_entry_id from public.mistake_entries
    where user_id = v_user_id and operation_key = p_operation_key;
  if found then return pg_catalog.jsonb_build_object('status', 'exists', 'entry_id', v_entry_id); end if;

  if p_entry_id is null then
    insert into public.mistake_entries(user_id, operation_key, subject_id, topic_id, question_batch_id, reason,
      thought, correct_rule, next_step, external_reference, status)
    values (v_user_id, p_operation_key, p_subject_id, p_topic_id, p_question_batch_id, p_reason,
      pg_catalog.btrim(p_thought), pg_catalog.btrim(p_correct_rule), nullif(pg_catalog.btrim(p_next_step), ''),
      nullif(pg_catalog.btrim(p_external_reference), ''), p_status)
    returning id into v_entry_id;
    return pg_catalog.jsonb_build_object('status', 'created', 'entry_id', v_entry_id);
  end if;

  select id into v_entry_id from public.mistake_entries
    where id = p_entry_id and user_id = v_user_id and deleted_at is null for update;
  if not found then return pg_catalog.jsonb_build_object('status', 'not_found'); end if;
  update public.mistake_entries set operation_key = p_operation_key, subject_id = p_subject_id, topic_id = p_topic_id,
    question_batch_id = p_question_batch_id, reason = p_reason, thought = pg_catalog.btrim(p_thought),
    correct_rule = pg_catalog.btrim(p_correct_rule), next_step = nullif(pg_catalog.btrim(p_next_step), ''),
    external_reference = nullif(pg_catalog.btrim(p_external_reference), ''), status = p_status
    where id = p_entry_id and user_id = v_user_id;
  return pg_catalog.jsonb_build_object('status', 'updated', 'entry_id', v_entry_id);
end;
$$;

create or replace function public.delete_mistake_entry(p_entry_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  update public.mistake_entries set deleted_at = pg_catalog.now()
    where id = p_entry_id and user_id = v_user_id and deleted_at is null;
  if not found then return 'not_found'; end if;
  return 'deleted';
end;
$$;

revoke all on function public.save_mistake_entry(uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text) from public, anon;
revoke all on function public.delete_mistake_entry(uuid) from public, anon;
grant execute on function public.save_mistake_entry(uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.delete_mistake_entry(uuid) to authenticated;
