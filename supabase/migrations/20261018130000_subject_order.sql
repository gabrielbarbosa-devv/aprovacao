create or replace function public.reorder_subjects(p_subject_ids uuid[])
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
  if p_subject_ids is null or pg_catalog.cardinality(p_subject_ids) = 0
     or pg_catalog.cardinality(p_subject_ids) > 500
     or exists (select 1 from pg_catalog.unnest(p_subject_ids) requested(id) where requested.id is null)
     or pg_catalog.cardinality(p_subject_ids) <> (
       select pg_catalog.count(distinct requested.id)::integer
       from pg_catalog.unnest(p_subject_ids) requested(id)
     ) then
    return 'invalid_input';
  end if;

  perform s.id from public.subjects s
  where s.user_id = v_user_id and s.archived_at is null
  order by s.id for update;

  select pg_catalog.count(*)::integer into v_active_count
  from public.subjects s
  where s.user_id = v_user_id and s.archived_at is null;
  if v_active_count <> pg_catalog.cardinality(p_subject_ids) then return 'stale'; end if;

  if exists (
    select 1
    from pg_catalog.unnest(p_subject_ids) requested(id)
    left join public.subjects s
      on s.id = requested.id and s.user_id = v_user_id and s.archived_at is null
    where s.id is null
  ) then return 'stale'; end if;

  update public.subjects s
  set sort_order = requested.ordinality::integer
  from pg_catalog.unnest(p_subject_ids) with ordinality requested(id, ordinality)
  where s.id = requested.id and s.user_id = v_user_id and s.archived_at is null;
  return 'reordered';
end;
$$;

revoke all on function public.reorder_subjects(uuid[]) from public, anon;
grant execute on function public.reorder_subjects(uuid[]) to authenticated;
