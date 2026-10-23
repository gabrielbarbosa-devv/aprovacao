-- Completion-based monthly/yearly schedules skip dates that do not exist.
create or replace function public.advance_completion_based_todo_recurrence()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare
  r public.todo_recurrence_rules%rowtype;
  v_completed_on date;
  v_next date;
  v_offset integer;
  v_target_month date;
  v_target_day integer;
begin
  if new.status='done' and old.status is distinct from new.status and new.recurrence_rule_id is not null then
    select * into r from public.todo_recurrence_rules where id=new.recurrence_rule_id and user_id=new.user_id and status='active' and schedule_basis='completion' for update;
    if r.id is not null then
      v_completed_on := (new.completed_at at time zone r.timezone)::date;
      if r.frequency='daily' or (r.frequency='custom' and r.custom_unit='day') then
        v_next := v_completed_on + r.interval_count;
      elsif r.frequency='weekly' or (r.frequency='custom' and r.custom_unit='week') then
        v_next := v_completed_on + (r.interval_count*7);
      elsif r.frequency='monthly' or (r.frequency='custom' and r.custom_unit='month') then
        v_offset := r.interval_count;
        v_next := null;
        while v_offset <= r.interval_count*120 loop
          v_target_month := (pg_catalog.date_trunc('month',v_completed_on)::date + make_interval(months=>v_offset))::date;
          if r.monthly_mode='last_day' then
            v_next := (pg_catalog.date_trunc('month',v_target_month)::date + interval '1 month - 1 day')::date;
          elsif r.monthly_mode='day' then
            v_target_day := extract(day from (pg_catalog.date_trunc('month',v_target_month)::date + interval '1 month - 1 day'))::integer;
            if r.month_day <= v_target_day then v_next := v_target_month + (r.month_day-1); end if;
          else
            v_target_day := extract(dow from v_target_month)::integer;
            if r.month_week='first' then
              v_next := v_target_month + ((r.month_weekday-v_target_day+7)%7);
            else
              v_target_month := (pg_catalog.date_trunc('month',v_target_month)::date + interval '1 month - 1 day')::date;
              v_target_day := extract(dow from v_target_month)::integer;
              v_next := v_target_month - ((v_target_day-r.month_weekday+7)%7);
            end if;
          end if;
          if v_next is not null then exit; end if;
          v_offset := v_offset + r.interval_count;
        end loop;
      elsif r.frequency='yearly' or (r.frequency='custom' and r.custom_unit='year') then
        v_offset := r.interval_count;
        v_next := null;
        while v_offset <= r.interval_count*400 loop
          v_target_month := make_date(extract(year from v_completed_on)::integer+v_offset,r.annual_month,1);
          v_target_day := extract(day from (v_target_month + interval '1 month - 1 day'))::integer;
          if r.annual_day <= v_target_day then v_next := v_target_month + (r.annual_day-1); exit; end if;
          v_offset := v_offset + r.interval_count;
        end loop;
      else
        v_next := null;
      end if;
      if v_next is null or (r.ends_on is not null and v_next>r.ends_on) or (r.max_occurrences is not null and r.occurrences_created>=r.max_occurrences) then
        update public.todo_recurrence_rules set status='ended',next_occurrence_on=null,updated_at=now() where id=r.id and user_id=new.user_id;
      else
        update public.todo_recurrence_rules set next_occurrence_on=v_next,updated_at=now() where id=r.id and user_id=new.user_id;
      end if;
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.advance_completion_based_todo_recurrence() from public,anon,authenticated;
