-- 20260121000002_guard_finish_match_trigger.sql
begin;

create or replace function public.trigger_finish_match_ranked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Guard against recursive trigger execution.
  if pg_trigger_depth() > 1 then
    return NEW;
  end if;

  if NEW.status = 'finished' and NEW.ranked_applied_at is null then
    perform public.finish_match(NEW.id);
  end if;

  return NEW;
end;
$$;

alter function public.trigger_finish_match_ranked() set search_path = public;

commit;
