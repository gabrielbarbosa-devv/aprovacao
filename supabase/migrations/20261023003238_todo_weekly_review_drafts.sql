alter table public.todo_weekly_reviews
  add column capture_draft_title text not null default '' check (length(capture_draft_title) <= 240),
  add column capture_draft_notes text not null default '' check (length(capture_draft_notes) <= 2000);

create or replace function public.save_todo_weekly_capture_draft(
  p_week_start date, p_title text, p_notes text default ''
) returns boolean language plpgsql security invoker set search_path = '' as $function$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_week_start is null or extract(isodow from p_week_start) <> 1
     or length(coalesce(p_title,'')) > 240 or length(coalesce(p_notes,'')) > 2000 then
    raise exception 'Invalid weekly capture draft' using errcode = '22023';
  end if;
  insert into public.todo_weekly_reviews(user_id,week_start,capture_draft_title,capture_draft_notes)
    values(v_user_id,p_week_start,coalesce(p_title,''),coalesce(p_notes,''))
    on conflict(user_id,week_start) do update set capture_draft_title=excluded.capture_draft_title,
      capture_draft_notes=excluded.capture_draft_notes,updated_at=now();
  return true;
end $function$;

create or replace function public.create_todo_weekly_capture(
  p_week_start date, p_title text, p_notes text default ''
) returns uuid language plpgsql security invoker set search_path = '' as $function$
declare v_user_id uuid := auth.uid(); v_review_id uuid; v_capture_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if extract(isodow from p_week_start) <> 1 or length(btrim(p_title)) not between 1 and 240 or length(coalesce(p_notes,'')) > 2000 then
    raise exception 'Invalid weekly capture' using errcode = '22023';
  end if;
  insert into public.todo_weekly_reviews(user_id,week_start,capture_draft_title,capture_draft_notes)
    values(v_user_id,p_week_start,'','')
    on conflict(user_id,week_start) do update set capture_draft_title='',capture_draft_notes='',updated_at=now()
    returning id into v_review_id;
  insert into public.todo_weekly_review_captures(user_id,review_id,title,notes)
    values(v_user_id,v_review_id,btrim(p_title),coalesce(p_notes,'')) returning id into v_capture_id;
  return v_capture_id;
end $function$;

revoke all on function public.save_todo_weekly_capture_draft(date,text,text) from public, anon;
grant execute on function public.save_todo_weekly_capture_draft(date,text,text) to authenticated;
revoke all on function public.create_todo_weekly_capture(date,text,text) from public, anon;
grant execute on function public.create_todo_weekly_capture(date,text,text) to authenticated;
