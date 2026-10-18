create or replace function public.pause_study_block(p_block_id uuid)
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

  if v_status = 'planejado' then
    return 'already_planned';
  end if;

  if v_status <> 'em_andamento' then
    return 'invalid_state';
  end if;

  update public.study_blocks
  set status = 'planejado'
  where id = p_block_id and user_id = v_user_id;

  return 'paused';
end;
$$;

revoke all on function public.pause_study_block(uuid) from public, anon;
grant execute on function public.pause_study_block(uuid) to authenticated;
