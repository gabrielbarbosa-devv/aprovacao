-- Extend the existing topics model for user-authored study organization.
-- Active titles are unique within a user's subject after whitespace/case normalization.
alter table public.topics
  add column if not exists notes text,
  add column if not exists source_url text,
  add column if not exists estimated_minutes integer;

alter table public.topics drop constraint if exists topics_estimated_minutes_check;
alter table public.topics add constraint topics_estimated_minutes_check
  check (estimated_minutes is null or estimated_minutes between 1 and 480);

alter table public.topics drop constraint if exists topics_source_url_check;
alter table public.topics add constraint topics_source_url_check
  check (source_url is null or source_url ~* '^https?://[^[:space:]]+$');

alter table public.topics drop constraint if exists topics_status_check;
alter table public.topics add constraint topics_status_check
  check (status in ('nao_iniciado', 'em_andamento', 'revisando', 'dominado', 'concluido'));

create or replace function private.normalize_topic_title()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.title := pg_catalog.regexp_replace(pg_catalog.btrim(new.title), '\s+', ' ', 'g');
  if pg_catalog.length(new.title) = 0 then
    raise exception 'Topic title cannot be empty' using errcode = '23514';
  end if;
  if new.notes is not null then new.notes := nullif(pg_catalog.btrim(new.notes), ''); end if;
  if new.source_url is not null then new.source_url := nullif(pg_catalog.btrim(new.source_url), ''); end if;
  return new;
end;
$$;

create or replace function private.require_active_subject_for_topic()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_subject_id uuid;
begin
  if tg_op = 'INSERT' or new.subject_id is distinct from old.subject_id
     or (new.archived_at is null and old.archived_at is not null) then
    select s.id into v_subject_id from public.subjects s
    where s.id = new.subject_id and s.user_id = new.user_id and s.archived_at is null
    for key share;
    if v_subject_id is null then
      raise exception 'An active subject owned by this user is required' using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists topics_require_active_subject on public.topics;
create trigger topics_require_active_subject
  before insert or update of subject_id, archived_at on public.topics
  for each row execute function private.require_active_subject_for_topic();

drop trigger if exists topics_normalize_title on public.topics;
create trigger topics_normalize_title
  before insert or update of title, notes, source_url on public.topics
  for each row execute function private.normalize_topic_title();

update public.topics
set title = pg_catalog.regexp_replace(pg_catalog.btrim(title), '\s+', ' ', 'g')
where title <> pg_catalog.regexp_replace(pg_catalog.btrim(title), '\s+', ' ', 'g');

create unique index if not exists topics_active_normalized_title_key
  on public.topics (
    user_id,
    subject_id,
    pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(title), '\s+', ' ', 'g'))
  ) where archived_at is null;

-- Preserve existing sessions and planned blocks: archiving is rejected while
-- non-terminal blocks still refer to the topic. Completed/skipped history stays linked.
create or replace function public.archive_topic(
  p_topic_id uuid,
  p_expected_open_blocks integer
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_topic public.topics%rowtype;
  v_open_blocks integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_expected_open_blocks is null or p_expected_open_blocks < 0 then return 'invalid_input'; end if;

  select * into v_topic from public.topics
  where id = p_topic_id and user_id = v_user_id
  for update;
  if not found then return 'not_found'; end if;
  if v_topic.archived_at is not null then return 'already_archived'; end if;

  select pg_catalog.count(*)::integer into v_open_blocks
  from public.study_blocks
  where user_id = v_user_id and topic_id = p_topic_id
    and status in ('planejado', 'em_andamento');
  if v_open_blocks <> p_expected_open_blocks then return 'blocks_changed'; end if;
  if v_open_blocks > 0 then return 'has_open_blocks'; end if;

  update public.topics set archived_at = pg_catalog.now()
  where id = p_topic_id and user_id = v_user_id;
  return 'archived';
end;
$$;

revoke all on function public.archive_topic(uuid, integer) from public, anon;
grant execute on function public.archive_topic(uuid, integer) to authenticated;

create or replace function public.reorder_topics(p_subject_id uuid, p_topic_ids uuid[])
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_active_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_topic_ids is null or pg_catalog.cardinality(p_topic_ids) = 0
     or pg_catalog.cardinality(p_topic_ids) > 1000
     or exists (select 1 from pg_catalog.unnest(p_topic_ids) requested(id) where requested.id is null)
     or pg_catalog.cardinality(p_topic_ids) <> (
       select pg_catalog.count(distinct requested.id)::integer
       from pg_catalog.unnest(p_topic_ids) requested(id)
     ) then
    return 'invalid_input';
  end if;

  perform s.id from public.subjects s
  where s.id = p_subject_id and s.user_id = v_user_id and s.archived_at is null
  for update;
  if not found then return 'not_found'; end if;

  perform t.id from public.topics t
  where t.subject_id = p_subject_id and t.user_id = v_user_id and t.archived_at is null
  order by t.id for update;
  select pg_catalog.count(*)::integer into v_active_count
  from public.topics t
  where t.subject_id = p_subject_id and t.user_id = v_user_id and t.archived_at is null;
  if v_active_count <> pg_catalog.cardinality(p_topic_ids) then return 'stale'; end if;
  if exists (
    select 1 from pg_catalog.unnest(p_topic_ids) requested(id)
    left join public.topics t on t.id = requested.id and t.subject_id = p_subject_id
      and t.user_id = v_user_id and t.archived_at is null
    where t.id is null
  ) then return 'stale'; end if;

  update public.topics t
  set sort_order = requested.ordinality::integer
  from pg_catalog.unnest(p_topic_ids) with ordinality requested(id, ordinality)
  where t.id = requested.id and t.subject_id = p_subject_id
    and t.user_id = v_user_id and t.archived_at is null;
  return 'reordered';
end;
$$;

revoke all on function public.reorder_topics(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_topics(uuid, uuid[]) to authenticated;

-- Direct writes cannot attach a new plan block to an archived topic. Updates
-- that keep the same topic_id remain allowed so existing records can be read/managed.
create or replace function private.require_active_topic_for_new_block()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_topic_id uuid;
begin
  if tg_op = 'INSERT' or new.topic_id is distinct from old.topic_id then
    select t.id into v_topic_id from public.topics t
      join public.subjects s on s.id = t.subject_id and s.user_id = t.user_id
      where t.id = new.topic_id and t.user_id = new.user_id
        and t.archived_at is null and s.archived_at is null
      for key share of t, s;
    if v_topic_id is null then
      raise exception 'An active topic in an active subject is required' using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists study_blocks_require_active_topic on public.study_blocks;
create trigger study_blocks_require_active_topic
  before insert or update of topic_id on public.study_blocks
  for each row execute function private.require_active_topic_for_new_block();
