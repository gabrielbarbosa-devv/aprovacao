-- Weekly planning belongs exclusively to the To-Do module. Child relations
-- include user_id so a review cannot point at another user's records.
create table public.todo_weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  current_step smallint not null default 0 check (current_step between 0 and 4),
  notes text not null default '' check (length(notes) <= 2000),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, week_start),
  check (extract(isodow from week_start) = 1)
);

create table public.todo_weekly_review_captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 240),
  notes text not null default '' check (length(notes) <= 2000),
  list_id uuid,
  scheduled_on date,
  state text not null default 'captured' check (state in ('captured','converted','archived','discarded')),
  converted_task_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (review_id, user_id) references public.todo_weekly_reviews(id, user_id) on delete cascade,
  foreign key (list_id, user_id) references public.todo_lists(id, user_id) on delete set null (list_id),
  foreign key (converted_task_id, user_id) references public.todo_tasks(id, user_id) on delete set null (converted_task_id)
);
create index todo_weekly_review_captures_review_idx on public.todo_weekly_review_captures(user_id, review_id, state, created_at desc);
create unique index todo_weekly_review_captures_task_unique on public.todo_weekly_review_captures(converted_task_id) where converted_task_id is not null;

create table public.todo_weekly_review_priorities (
  review_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null,
  position smallint not null check (position between 1 and 3),
  why_important text not null default '' check (length(why_important) <= 500),
  planned_on date,
  planned_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (review_id, task_id),
  unique (review_id, position),
  foreign key (review_id, user_id) references public.todo_weekly_reviews(id, user_id) on delete cascade,
  foreign key (task_id, user_id) references public.todo_tasks(id, user_id) on delete cascade,
  check (planned_time is null or planned_on is not null)
);
create index todo_weekly_review_priorities_task_idx on public.todo_weekly_review_priorities(user_id, task_id);

alter table public.todo_weekly_reviews enable row level security;
alter table public.todo_weekly_review_captures enable row level security;
alter table public.todo_weekly_review_priorities enable row level security;

create policy todo_weekly_reviews_select_own on public.todo_weekly_reviews for select to authenticated using ((select auth.uid()) = user_id);
create policy todo_weekly_reviews_insert_own on public.todo_weekly_reviews for insert to authenticated with check ((select auth.uid()) = user_id);
create policy todo_weekly_reviews_update_own on public.todo_weekly_reviews for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy todo_weekly_reviews_delete_own on public.todo_weekly_reviews for delete to authenticated using ((select auth.uid()) = user_id);
create policy todo_weekly_review_captures_select_own on public.todo_weekly_review_captures for select to authenticated using ((select auth.uid()) = user_id);
create policy todo_weekly_review_captures_insert_own on public.todo_weekly_review_captures for insert to authenticated with check ((select auth.uid()) = user_id);
create policy todo_weekly_review_captures_update_own on public.todo_weekly_review_captures for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy todo_weekly_review_captures_delete_own on public.todo_weekly_review_captures for delete to authenticated using ((select auth.uid()) = user_id);
create policy todo_weekly_review_priorities_select_own on public.todo_weekly_review_priorities for select to authenticated using ((select auth.uid()) = user_id);
create policy todo_weekly_review_priorities_insert_own on public.todo_weekly_review_priorities for insert to authenticated with check ((select auth.uid()) = user_id);
create policy todo_weekly_review_priorities_update_own on public.todo_weekly_review_priorities for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy todo_weekly_review_priorities_delete_own on public.todo_weekly_review_priorities for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.todo_weekly_reviews, public.todo_weekly_review_captures, public.todo_weekly_review_priorities to authenticated;

create or replace function public.create_todo_weekly_capture(
  p_week_start date, p_title text, p_notes text default ''
) returns uuid language plpgsql security invoker set search_path = '' as $function$
declare v_user_id uuid := auth.uid(); v_review_id uuid; v_capture_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if extract(isodow from p_week_start) <> 1 or length(btrim(p_title)) not between 1 and 240 or length(coalesce(p_notes,'')) > 2000 then
    raise exception 'Invalid weekly capture' using errcode = '22023';
  end if;
  insert into public.todo_weekly_reviews(user_id, week_start) values (v_user_id,p_week_start)
    on conflict (user_id,week_start) do update set updated_at=now() returning id into v_review_id;
  insert into public.todo_weekly_review_captures(user_id,review_id,title,notes)
    values(v_user_id,v_review_id,btrim(p_title),coalesce(p_notes,'')) returning id into v_capture_id;
  return v_capture_id;
end $function$;

create or replace function public.convert_todo_weekly_capture_to_task(
  p_capture_id uuid, p_list_id uuid, p_scheduled_on date default null
) returns uuid language plpgsql security invoker set search_path = '' as $function$
declare v_user_id uuid := auth.uid(); v_capture public.todo_weekly_review_captures%rowtype; v_task_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_capture from public.todo_weekly_review_captures where id=p_capture_id and user_id=v_user_id for update;
  if not found then raise exception 'Capture not found' using errcode = 'P0002'; end if;
  if v_capture.converted_task_id is not null then return v_capture.converted_task_id; end if;
  if v_capture.state <> 'captured' then raise exception 'Capture is not available' using errcode = '55000'; end if;
  if not exists(select 1 from public.todo_lists where id=p_list_id and user_id=v_user_id) then
    raise exception 'List not found' using errcode = '23503';
  end if;
  insert into public.todo_tasks(user_id,list_id,title,description,starts_on,due_on)
    values(v_user_id,p_list_id,v_capture.title,nullif(v_capture.notes,''),coalesce(p_scheduled_on,current_date),p_scheduled_on)
    returning id into v_task_id;
  update public.todo_weekly_review_captures set list_id=p_list_id,scheduled_on=p_scheduled_on,state='converted',converted_task_id=v_task_id,updated_at=now()
    where id=p_capture_id and user_id=v_user_id;
  return v_task_id;
end $function$;

create or replace function public.save_todo_weekly_review(
  p_week_start date, p_current_step smallint, p_notes text, p_priorities jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $function$
declare
  v_user_id uuid := auth.uid(); v_review_id uuid; v_item jsonb; v_task_id uuid;
  v_position smallint; v_why text; v_planned_on date; v_planned_time time;
  v_timezone text;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_week_start is null or extract(isodow from p_week_start) <> 1 or p_current_step not between 0 and 4
     or length(coalesce(p_notes,'')) > 2000 or p_priorities is null or jsonb_typeof(p_priorities) <> 'array'
     or jsonb_array_length(p_priorities) > 3 then
    raise exception 'Invalid weekly review' using errcode = '22023';
  end if;
  select coalesce(timezone,'America/Sao_Paulo') into v_timezone from public.user_settings where user_id=v_user_id;
  v_timezone := coalesce(v_timezone,'America/Sao_Paulo');
  insert into public.todo_weekly_reviews(user_id,week_start,current_step,notes,finished_at)
    values(v_user_id,p_week_start,p_current_step,coalesce(p_notes,''),case when p_current_step=4 then now() else null end)
    on conflict (user_id,week_start) do update set current_step=excluded.current_step,notes=excluded.notes,
      finished_at=excluded.finished_at,updated_at=now() returning id into v_review_id;
  delete from public.todo_weekly_review_priorities where review_id=v_review_id and user_id=v_user_id;
  for v_item in select value from jsonb_array_elements(p_priorities) loop
    v_task_id := (v_item->>'taskId')::uuid;
    v_position := (v_item->>'position')::smallint;
    v_why := coalesce(v_item->>'whyImportant','');
    v_planned_on := nullif(v_item->>'plannedOn','')::date;
    v_planned_time := nullif(v_item->>'plannedTime','')::time;
    if v_position not between 1 and 3 or length(v_why)>500
       or (v_planned_time is not null and v_planned_on is null)
       or (v_planned_on is not null and v_planned_on not between p_week_start+7 and p_week_start+13)
       or not exists(select 1 from public.todo_tasks where id=v_task_id and user_id=v_user_id and status <> 'done' and deleted_at is null and archived_at is null) then
      raise exception 'Invalid weekly priority' using errcode = '22023';
    end if;
    insert into public.todo_weekly_review_priorities(review_id,user_id,task_id,position,why_important,planned_on,planned_time)
      values(v_review_id,v_user_id,v_task_id,v_position,v_why,v_planned_on,v_planned_time);
    if v_planned_on is not null then
      update public.todo_tasks set due_on=v_planned_on,
        due_at=case when v_planned_time is null then null else (v_planned_on + v_planned_time) at time zone v_timezone end,
        updated_at=now()
      where id=v_task_id and user_id=v_user_id;
    end if;
  end loop;
  return v_review_id;
end $function$;

revoke all on function public.create_todo_weekly_capture(date,text,text) from public, anon;
revoke all on function public.convert_todo_weekly_capture_to_task(uuid,uuid,date) from public, anon;
revoke all on function public.save_todo_weekly_review(date,smallint,text,jsonb) from public, anon;
grant execute on function public.create_todo_weekly_capture(date,text,text) to authenticated;
grant execute on function public.convert_todo_weekly_capture_to_task(uuid,uuid,date) to authenticated;
grant execute on function public.save_todo_weekly_review(date,smallint,text,jsonb) to authenticated;
