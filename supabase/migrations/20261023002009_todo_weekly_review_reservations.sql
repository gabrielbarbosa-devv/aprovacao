create table public.todo_weekly_review_reservations (
  user_id uuid not null references auth.users(id) on delete cascade,
  review_id uuid not null,
  planned_on date not null,
  created_at timestamptz not null default now(),
  primary key (review_id, planned_on),
  foreign key (review_id, user_id) references public.todo_weekly_reviews(id, user_id) on delete cascade
);
create index todo_weekly_review_reservations_user_idx on public.todo_weekly_review_reservations(user_id, review_id, planned_on);
alter table public.todo_weekly_review_reservations enable row level security;
create policy todo_weekly_review_reservations_select_own on public.todo_weekly_review_reservations for select to authenticated using ((select auth.uid()) = user_id);
create policy todo_weekly_review_reservations_insert_own on public.todo_weekly_review_reservations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy todo_weekly_review_reservations_delete_own on public.todo_weekly_review_reservations for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, delete on public.todo_weekly_review_reservations to authenticated;

create or replace function public.set_todo_weekly_review_reservation(
  p_week_start date, p_planned_on date, p_reserved boolean
) returns boolean language plpgsql security invoker set search_path = '' as $function$
declare v_user_id uuid := auth.uid(); v_review_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_week_start is null or extract(isodow from p_week_start) <> 1 or p_planned_on not between p_week_start+7 and p_week_start+13 then
    raise exception 'Invalid reserved day' using errcode = '22023';
  end if;
  insert into public.todo_weekly_reviews(user_id,week_start) values(v_user_id,p_week_start)
    on conflict(user_id,week_start) do update set updated_at=now() returning id into v_review_id;
  if p_reserved then
    insert into public.todo_weekly_review_reservations(user_id,review_id,planned_on)
      values(v_user_id,v_review_id,p_planned_on) on conflict(review_id,planned_on) do nothing;
  else
    delete from public.todo_weekly_review_reservations where user_id=v_user_id and review_id=v_review_id and planned_on=p_planned_on;
  end if;
  return p_reserved;
end $function$;

revoke all on function public.set_todo_weekly_review_reservation(date,date,boolean) from public, anon;
grant execute on function public.set_todo_weekly_review_reservation(date,date,boolean) to authenticated;
