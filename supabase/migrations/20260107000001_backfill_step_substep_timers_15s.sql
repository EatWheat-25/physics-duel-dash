-- 20260107000001_backfill_step_substep_timers_15s.sql
-- Backfill questions_v2.steps JSON timers:
-- - Steps: default/fix to 15s when missing/invalid or obviously wrong (>60s).
-- - Sub-steps: default/fix to 15s when missing/invalid, old default (5s), or obviously wrong (>60s).
--
-- We intentionally DO NOT overwrite reasonable explicit overrides (e.g. 20s, 30s) to respect per-step configuration.

begin;

with per_question as (
  select
    q.id,
    jsonb_agg(
      (
        -- Start from the original step object and overlay corrected timer + corrected sub-structures.
        s.step_obj
        ||
        jsonb_build_object(
          'timeLimitSeconds',
          (
            case
              when (
                case
                  when jsonb_typeof(s.step_obj->'timeLimitSeconds') = 'number' then (s.step_obj->>'timeLimitSeconds')::int
                  when jsonb_typeof(s.step_obj->'timeLimitSeconds') = 'string' and (s.step_obj->>'timeLimitSeconds') ~ '^[0-9]+$' then (s.step_obj->>'timeLimitSeconds')::int
                  when jsonb_typeof(s.step_obj->'time_limit_seconds') = 'number' then (s.step_obj->>'time_limit_seconds')::int
                  when jsonb_typeof(s.step_obj->'time_limit_seconds') = 'string' and (s.step_obj->>'time_limit_seconds') ~ '^[0-9]+$' then (s.step_obj->>'time_limit_seconds')::int
                  else null
                end
              ) is null then 15
              when (
                case
                  when jsonb_typeof(s.step_obj->'timeLimitSeconds') = 'number' then (s.step_obj->>'timeLimitSeconds')::int
                  when jsonb_typeof(s.step_obj->'timeLimitSeconds') = 'string' and (s.step_obj->>'timeLimitSeconds') ~ '^[0-9]+$' then (s.step_obj->>'timeLimitSeconds')::int
                  when jsonb_typeof(s.step_obj->'time_limit_seconds') = 'number' then (s.step_obj->>'time_limit_seconds')::int
                  when jsonb_typeof(s.step_obj->'time_limit_seconds') = 'string' and (s.step_obj->>'time_limit_seconds') ~ '^[0-9]+$' then (s.step_obj->>'time_limit_seconds')::int
                  else null
                end
              ) <= 0 then 15
              when (
                case
                  when jsonb_typeof(s.step_obj->'timeLimitSeconds') = 'number' then (s.step_obj->>'timeLimitSeconds')::int
                  when jsonb_typeof(s.step_obj->'timeLimitSeconds') = 'string' and (s.step_obj->>'timeLimitSeconds') ~ '^[0-9]+$' then (s.step_obj->>'timeLimitSeconds')::int
                  when jsonb_typeof(s.step_obj->'time_limit_seconds') = 'number' then (s.step_obj->>'time_limit_seconds')::int
                  when jsonb_typeof(s.step_obj->'time_limit_seconds') = 'string' and (s.step_obj->>'time_limit_seconds') ~ '^[0-9]+$' then (s.step_obj->>'time_limit_seconds')::int
                  else null
                end
              ) > 60 then 15
              else (
                case
                  when jsonb_typeof(s.step_obj->'timeLimitSeconds') = 'number' then (s.step_obj->>'timeLimitSeconds')::int
                  when jsonb_typeof(s.step_obj->'timeLimitSeconds') = 'string' and (s.step_obj->>'timeLimitSeconds') ~ '^[0-9]+$' then (s.step_obj->>'timeLimitSeconds')::int
                  when jsonb_typeof(s.step_obj->'time_limit_seconds') = 'number' then (s.step_obj->>'time_limit_seconds')::int
                  when jsonb_typeof(s.step_obj->'time_limit_seconds') = 'string' and (s.step_obj->>'time_limit_seconds') ~ '^[0-9]+$' then (s.step_obj->>'time_limit_seconds')::int
                  else 15
                end
              )
            end
          )
        )
        ||
        -- subSteps[] (preferred)
        case
          when (s.step_obj ? 'subSteps') and jsonb_typeof(s.step_obj->'subSteps') = 'array' then
            jsonb_build_object(
              'subSteps',
              (
                select jsonb_agg(
                  sub.sub_obj
                  ||
                  jsonb_build_object(
                    'timeLimitSeconds',
                    (
                      case
                        when (
                          case
                            when jsonb_typeof(sub.sub_obj->'timeLimitSeconds') = 'number' then (sub.sub_obj->>'timeLimitSeconds')::int
                            when jsonb_typeof(sub.sub_obj->'timeLimitSeconds') = 'string' and (sub.sub_obj->>'timeLimitSeconds') ~ '^[0-9]+$' then (sub.sub_obj->>'timeLimitSeconds')::int
                            when jsonb_typeof(sub.sub_obj->'time_limit_seconds') = 'number' then (sub.sub_obj->>'time_limit_seconds')::int
                            when jsonb_typeof(sub.sub_obj->'time_limit_seconds') = 'string' and (sub.sub_obj->>'time_limit_seconds') ~ '^[0-9]+$' then (sub.sub_obj->>'time_limit_seconds')::int
                            else null
                          end
                        ) is null then 15
                        when (
                          case
                            when jsonb_typeof(sub.sub_obj->'timeLimitSeconds') = 'number' then (sub.sub_obj->>'timeLimitSeconds')::int
                            when jsonb_typeof(sub.sub_obj->'timeLimitSeconds') = 'string' and (sub.sub_obj->>'timeLimitSeconds') ~ '^[0-9]+$' then (sub.sub_obj->>'timeLimitSeconds')::int
                            when jsonb_typeof(sub.sub_obj->'time_limit_seconds') = 'number' then (sub.sub_obj->>'time_limit_seconds')::int
                            when jsonb_typeof(sub.sub_obj->'time_limit_seconds') = 'string' and (sub.sub_obj->>'time_limit_seconds') ~ '^[0-9]+$' then (sub.sub_obj->>'time_limit_seconds')::int
                            else null
                          end
                        ) <= 0 then 15
                        when (
                          case
                            when jsonb_typeof(sub.sub_obj->'timeLimitSeconds') = 'number' then (sub.sub_obj->>'timeLimitSeconds')::int
                            when jsonb_typeof(sub.sub_obj->'timeLimitSeconds') = 'string' and (sub.sub_obj->>'timeLimitSeconds') ~ '^[0-9]+$' then (sub.sub_obj->>'timeLimitSeconds')::int
                            when jsonb_typeof(sub.sub_obj->'time_limit_seconds') = 'number' then (sub.sub_obj->>'time_limit_seconds')::int
                            when jsonb_typeof(sub.sub_obj->'time_limit_seconds') = 'string' and (sub.sub_obj->>'time_limit_seconds') ~ '^[0-9]+$' then (sub.sub_obj->>'time_limit_seconds')::int
                            else null
                          end
                        ) = 5 then 15
                        when (
                          case
                            when jsonb_typeof(sub.sub_obj->'timeLimitSeconds') = 'number' then (sub.sub_obj->>'timeLimitSeconds')::int
                            when jsonb_typeof(sub.sub_obj->'timeLimitSeconds') = 'string' and (sub.sub_obj->>'timeLimitSeconds') ~ '^[0-9]+$' then (sub.sub_obj->>'timeLimitSeconds')::int
                            when jsonb_typeof(sub.sub_obj->'time_limit_seconds') = 'number' then (sub.sub_obj->>'time_limit_seconds')::int
                            when jsonb_typeof(sub.sub_obj->'time_limit_seconds') = 'string' and (sub.sub_obj->>'time_limit_seconds') ~ '^[0-9]+$' then (sub.sub_obj->>'time_limit_seconds')::int
                            else null
                          end
                        ) > 60 then 15
                        else (
                          case
                            when jsonb_typeof(sub.sub_obj->'timeLimitSeconds') = 'number' then (sub.sub_obj->>'timeLimitSeconds')::int
                            when jsonb_typeof(sub.sub_obj->'timeLimitSeconds') = 'string' and (sub.sub_obj->>'timeLimitSeconds') ~ '^[0-9]+$' then (sub.sub_obj->>'timeLimitSeconds')::int
                            when jsonb_typeof(sub.sub_obj->'time_limit_seconds') = 'number' then (sub.sub_obj->>'time_limit_seconds')::int
                            when jsonb_typeof(sub.sub_obj->'time_limit_seconds') = 'string' and (sub.sub_obj->>'time_limit_seconds') ~ '^[0-9]+$' then (sub.sub_obj->>'time_limit_seconds')::int
                            else 15
                          end
                        )
                      end
                    )
                  )
                  order by sub.sub_ord
                )
                from jsonb_array_elements(s.step_obj->'subSteps') with ordinality as sub(sub_obj, sub_ord)
              )
            )
          else '{}'::jsonb
        end
        ||
        -- legacy subStep (object)
        case
          when (s.step_obj ? 'subStep') and jsonb_typeof(s.step_obj->'subStep') = 'object' then
            jsonb_build_object(
              'subStep',
              (
                (s.step_obj->'subStep')
                ||
                jsonb_build_object(
                  'timeLimitSeconds',
                  (
                    case
                      when (
                        case
                          when jsonb_typeof((s.step_obj->'subStep')->'timeLimitSeconds') = 'number' then ((s.step_obj->'subStep')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'subStep')->'timeLimitSeconds') = 'string' and ((s.step_obj->'subStep')->>'timeLimitSeconds') ~ '^[0-9]+$' then ((s.step_obj->'subStep')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'subStep')->'time_limit_seconds') = 'number' then ((s.step_obj->'subStep')->>'time_limit_seconds')::int
                          when jsonb_typeof((s.step_obj->'subStep')->'time_limit_seconds') = 'string' and ((s.step_obj->'subStep')->>'time_limit_seconds') ~ '^[0-9]+$' then ((s.step_obj->'subStep')->>'time_limit_seconds')::int
                          else null
                        end
                      ) is null then 15
                      when (
                        case
                          when jsonb_typeof((s.step_obj->'subStep')->'timeLimitSeconds') = 'number' then ((s.step_obj->'subStep')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'subStep')->'timeLimitSeconds') = 'string' and ((s.step_obj->'subStep')->>'timeLimitSeconds') ~ '^[0-9]+$' then ((s.step_obj->'subStep')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'subStep')->'time_limit_seconds') = 'number' then ((s.step_obj->'subStep')->>'time_limit_seconds')::int
                          when jsonb_typeof((s.step_obj->'subStep')->'time_limit_seconds') = 'string' and ((s.step_obj->'subStep')->>'time_limit_seconds') ~ '^[0-9]+$' then ((s.step_obj->'subStep')->>'time_limit_seconds')::int
                          else null
                        end
                      ) <= 0 then 15
                      when (
                        case
                          when jsonb_typeof((s.step_obj->'subStep')->'timeLimitSeconds') = 'number' then ((s.step_obj->'subStep')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'subStep')->'timeLimitSeconds') = 'string' and ((s.step_obj->'subStep')->>'timeLimitSeconds') ~ '^[0-9]+$' then ((s.step_obj->'subStep')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'subStep')->'time_limit_seconds') = 'number' then ((s.step_obj->'subStep')->>'time_limit_seconds')::int
                          when jsonb_typeof((s.step_obj->'subStep')->'time_limit_seconds') = 'string' and ((s.step_obj->'subStep')->>'time_limit_seconds') ~ '^[0-9]+$' then ((s.step_obj->'subStep')->>'time_limit_seconds')::int
                          else null
                        end
                      ) = 5 then 15
                      when (
                        case
                          when jsonb_typeof((s.step_obj->'subStep')->'timeLimitSeconds') = 'number' then ((s.step_obj->'subStep')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'subStep')->'timeLimitSeconds') = 'string' and ((s.step_obj->'subStep')->>'timeLimitSeconds') ~ '^[0-9]+$' then ((s.step_obj->'subStep')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'subStep')->'time_limit_seconds') = 'number' then ((s.step_obj->'subStep')->>'time_limit_seconds')::int
                          when jsonb_typeof((s.step_obj->'subStep')->'time_limit_seconds') = 'string' and ((s.step_obj->'subStep')->>'time_limit_seconds') ~ '^[0-9]+$' then ((s.step_obj->'subStep')->>'time_limit_seconds')::int
                          else null
                        end
                      ) > 60 then 15
                      else (
                        case
                          when jsonb_typeof((s.step_obj->'subStep')->'timeLimitSeconds') = 'number' then ((s.step_obj->'subStep')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'subStep')->'timeLimitSeconds') = 'string' and ((s.step_obj->'subStep')->>'timeLimitSeconds') ~ '^[0-9]+$' then ((s.step_obj->'subStep')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'subStep')->'time_limit_seconds') = 'number' then ((s.step_obj->'subStep')->>'time_limit_seconds')::int
                          when jsonb_typeof((s.step_obj->'subStep')->'time_limit_seconds') = 'string' and ((s.step_obj->'subStep')->>'time_limit_seconds') ~ '^[0-9]+$' then ((s.step_obj->'subStep')->>'time_limit_seconds')::int
                          else 15
                        end
                      )
                    end
                  )
                )
              )
            )
          else '{}'::jsonb
        end
        ||
        -- legacy sub_step (object)
        case
          when (s.step_obj ? 'sub_step') and jsonb_typeof(s.step_obj->'sub_step') = 'object' then
            jsonb_build_object(
              'sub_step',
              (
                (s.step_obj->'sub_step')
                ||
                jsonb_build_object(
                  'timeLimitSeconds',
                  (
                    case
                      when (
                        case
                          when jsonb_typeof((s.step_obj->'sub_step')->'timeLimitSeconds') = 'number' then ((s.step_obj->'sub_step')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'sub_step')->'timeLimitSeconds') = 'string' and ((s.step_obj->'sub_step')->>'timeLimitSeconds') ~ '^[0-9]+$' then ((s.step_obj->'sub_step')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'sub_step')->'time_limit_seconds') = 'number' then ((s.step_obj->'sub_step')->>'time_limit_seconds')::int
                          when jsonb_typeof((s.step_obj->'sub_step')->'time_limit_seconds') = 'string' and ((s.step_obj->'sub_step')->>'time_limit_seconds') ~ '^[0-9]+$' then ((s.step_obj->'sub_step')->>'time_limit_seconds')::int
                          else null
                        end
                      ) is null then 15
                      when (
                        case
                          when jsonb_typeof((s.step_obj->'sub_step')->'timeLimitSeconds') = 'number' then ((s.step_obj->'sub_step')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'sub_step')->'timeLimitSeconds') = 'string' and ((s.step_obj->'sub_step')->>'timeLimitSeconds') ~ '^[0-9]+$' then ((s.step_obj->'sub_step')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'sub_step')->'time_limit_seconds') = 'number' then ((s.step_obj->'sub_step')->>'time_limit_seconds')::int
                          when jsonb_typeof((s.step_obj->'sub_step')->'time_limit_seconds') = 'string' and ((s.step_obj->'sub_step')->>'time_limit_seconds') ~ '^[0-9]+$' then ((s.step_obj->'sub_step')->>'time_limit_seconds')::int
                          else null
                        end
                      ) <= 0 then 15
                      when (
                        case
                          when jsonb_typeof((s.step_obj->'sub_step')->'timeLimitSeconds') = 'number' then ((s.step_obj->'sub_step')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'sub_step')->'timeLimitSeconds') = 'string' and ((s.step_obj->'sub_step')->>'timeLimitSeconds') ~ '^[0-9]+$' then ((s.step_obj->'sub_step')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'sub_step')->'time_limit_seconds') = 'number' then ((s.step_obj->'sub_step')->>'time_limit_seconds')::int
                          when jsonb_typeof((s.step_obj->'sub_step')->'time_limit_seconds') = 'string' and ((s.step_obj->'sub_step')->>'time_limit_seconds') ~ '^[0-9]+$' then ((s.step_obj->'sub_step')->>'time_limit_seconds')::int
                          else null
                        end
                      ) = 5 then 15
                      when (
                        case
                          when jsonb_typeof((s.step_obj->'sub_step')->'timeLimitSeconds') = 'number' then ((s.step_obj->'sub_step')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'sub_step')->'timeLimitSeconds') = 'string' and ((s.step_obj->'sub_step')->>'timeLimitSeconds') ~ '^[0-9]+$' then ((s.step_obj->'sub_step')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'sub_step')->'time_limit_seconds') = 'number' then ((s.step_obj->'sub_step')->>'time_limit_seconds')::int
                          when jsonb_typeof((s.step_obj->'sub_step')->'time_limit_seconds') = 'string' and ((s.step_obj->'sub_step')->>'time_limit_seconds') ~ '^[0-9]+$' then ((s.step_obj->'sub_step')->>'time_limit_seconds')::int
                          else null
                        end
                      ) > 60 then 15
                      else (
                        case
                          when jsonb_typeof((s.step_obj->'sub_step')->'timeLimitSeconds') = 'number' then ((s.step_obj->'sub_step')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'sub_step')->'timeLimitSeconds') = 'string' and ((s.step_obj->'sub_step')->>'timeLimitSeconds') ~ '^[0-9]+$' then ((s.step_obj->'sub_step')->>'timeLimitSeconds')::int
                          when jsonb_typeof((s.step_obj->'sub_step')->'time_limit_seconds') = 'number' then ((s.step_obj->'sub_step')->>'time_limit_seconds')::int
                          when jsonb_typeof((s.step_obj->'sub_step')->'time_limit_seconds') = 'string' and ((s.step_obj->'sub_step')->>'time_limit_seconds') ~ '^[0-9]+$' then ((s.step_obj->'sub_step')->>'time_limit_seconds')::int
                          else 15
                        end
                      )
                    end
                  )
                )
              )
            )
          else '{}'::jsonb
        end
      )
      order by s.step_ord
    ) as steps_new
  from public.questions_v2 q
  cross join lateral jsonb_array_elements(q.steps) with ordinality as s(step_obj, step_ord)
  where jsonb_typeof(q.steps) = 'array'
  group by q.id
)
update public.questions_v2 q
set steps = p.steps_new
from per_question p
where q.id = p.id
  and jsonb_typeof(q.steps) = 'array'
  and q.steps is distinct from p.steps_new;

commit;


