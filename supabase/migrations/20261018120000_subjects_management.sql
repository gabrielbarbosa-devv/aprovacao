-- Subject management uses the existing subjects/topics/study_blocks model.
-- Normalize names at the database boundary and keep case-insensitive uniqueness
-- aligned with application normalization.

create or replace function private.normalize_subject_name()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.name := pg_catalog.regexp_replace(pg_catalog.btrim(new.name), '\s+', ' ', 'g');
  if pg_catalog.length(new.name) = 0 then
    raise exception 'Subject name cannot be empty' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists subjects_normalize_name on public.subjects;
create trigger subjects_normalize_name
  before insert or update of name on public.subjects
  for each row execute function private.normalize_subject_name();

update public.subjects
set name = pg_catalog.regexp_replace(pg_catalog.btrim(name), '\s+', ' ', 'g')
where name <> pg_catalog.regexp_replace(pg_catalog.btrim(name), '\s+', ' ', 'g');

drop index if exists public.subjects_user_name_ci_key;
create unique index subjects_user_name_ci_key
  on public.subjects (
    user_id,
    pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(name), '\s+', ' ', 'g'))
  );

create or replace function public.archive_subject(
  p_subject_id uuid,
  p_expected_future_blocks integer
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_subject public.subjects%rowtype;
  v_timezone text;
  v_today date;
  v_future_blocks integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_expected_future_blocks is null or p_expected_future_blocks < 0 then return 'invalid_input'; end if;

  select * into v_subject from public.subjects
  where id = p_subject_id and user_id = v_user_id
  for update;
  if not found then return 'not_found'; end if;
  if v_subject.archived_at is not null then return 'already_archived'; end if;

  select timezone into v_timezone from public.user_settings
  where user_id = v_user_id;
  v_today := (pg_catalog.now() at time zone coalesce(v_timezone, 'America/Sao_Paulo'))::date;

  select pg_catalog.count(*)::integer into v_future_blocks
  from public.study_blocks b
  join public.topics t on t.id = b.topic_id and t.user_id = b.user_id
  where b.user_id = v_user_id and t.subject_id = p_subject_id
    and b.planned_date > v_today and b.status in ('planejado', 'em_andamento');

  if v_future_blocks <> p_expected_future_blocks then return 'future_blocks_changed'; end if;

  update public.subjects set archived_at = pg_catalog.now()
  where id = p_subject_id and user_id = v_user_id;
  return 'archived';
end;
$$;

revoke all on function public.archive_subject(uuid, integer) from public, anon;
grant execute on function public.archive_subject(uuid, integer) to authenticated;
