-- 20260603000001_check_step_answer_guard_v1.sql
-- check_step_answer_v1 returned the correct answer for any question/step to
-- any logged-in user and recorded nothing, so it could be used to look up the
-- answer to a question that is live in a ranked round.
--
-- This version:
--   * refuses while the question is in play in ANY unfinished match round
--     (not just the caller's, so a second account can't do the lookup);
--   * logs every check and rate-limits per player, so the answer bank can't
--     be bulk-harvested ahead of time;
--   * only serves enabled questions.

begin;

create table if not exists public.solo_answer_checks (
  id bigint generated always as identity primary key,
  player_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null,
  step_index int not null,
  sub_index int,
  answer int,
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists solo_answer_checks_player_created_idx
  on public.solo_answer_checks (player_id, created_at desc);

create index if not exists match_rounds_question_id_created_idx
  on public.match_rounds (question_id, created_at desc);

-- No client policies: only the SECURITY DEFINER function below writes here.
alter table public.solo_answer_checks enable row level security;

create or replace function public.check_step_answer_v1(
  p_question_id uuid,
  p_step_index int,
  p_answer int,
  p_sub_index int default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_player_id uuid := auth.uid();
  v_is_service boolean := public._is_service_role();
  v_steps jsonb;
  v_node jsonb;
  v_correct int;
  v_is_correct boolean;
  v_recent int;
  -- A normal solo/campaign run is 3 questions; this leaves generous headroom.
  v_max_checks_per_window int := 60;
  v_window interval := interval '10 minutes';
  -- Rounds older than this are treated as abandoned, not live.
  v_live_round_ttl interval := interval '30 minutes';
begin
  if v_player_id is null and not v_is_service then
    raise exception 'check_step_answer_v1: not authenticated';
  end if;

  if not v_is_service then
    -- Question is currently being played in a match round: no reveal.
    if exists (
      select 1
      from public.match_rounds r
      join public.matches m on m.id = r.match_id
      where r.question_id = p_question_id
        and r.status <> 'results'
        and r.created_at > now() - v_live_round_ttl
        and m.status <> 'finished'
    ) then
      raise exception 'check_step_answer_v1: question is locked while in play'
        using errcode = 'P0001';
    end if;

    select count(*) into v_recent
    from public.solo_answer_checks c
    where c.player_id = v_player_id
      and c.created_at > now() - v_window;

    if v_recent >= v_max_checks_per_window then
      raise exception 'check_step_answer_v1: too many answer checks, slow down'
        using errcode = 'P0001';
    end if;
  end if;

  select q.steps into v_steps
  from public.questions_v2 q
  where q.id = p_question_id
    and q.is_enabled = true;

  if v_steps is null then
    raise exception 'check_step_answer_v1: question not found';
  end if;

  -- Locate the step the same way the client mapper does: sort by the declared
  -- index field (falling back to array position), then re-index contiguously.
  select ranked.step into v_node
  from (
    select
      t.step,
      row_number() over (
        order by coalesce(
          case when jsonb_typeof(t.step->'index') = 'number'
            then floor((t.step->>'index')::numeric)::int end,
          t.ord::int - 1
        ), t.ord
      ) - 1 as norm_idx
    from jsonb_array_elements(v_steps) with ordinality as t(step, ord)
  ) ranked
  where ranked.norm_idx = p_step_index
  limit 1;

  if v_node is null then
    raise exception 'check_step_answer_v1: step % not found', p_step_index;
  end if;

  if p_sub_index is not null then
    select s.sub into v_node
    from jsonb_array_elements(
      case
        when jsonb_typeof(v_node->'subSteps') = 'array' then v_node->'subSteps'
        when jsonb_typeof(v_node->'sub_steps') = 'array' then v_node->'sub_steps'
        else '[]'::jsonb
      end
    ) with ordinality as s(sub, ord)
    where s.ord::int - 1 = p_sub_index
    limit 1;

    if v_node is null then
      raise exception 'check_step_answer_v1: sub-step % not found', p_sub_index;
    end if;
  end if;

  v_correct := public._question_node_correct_answer(v_node);
  v_is_correct := p_answer is not null and p_answer = v_correct;

  if v_player_id is not null then
    insert into public.solo_answer_checks (
      player_id, question_id, step_index, sub_index, answer, is_correct
    ) values (
      v_player_id, p_question_id, p_step_index, p_sub_index, p_answer, v_is_correct
    );
  end if;

  return jsonb_build_object(
    'is_correct', v_is_correct,
    'correct_answer', v_correct,
    'explanation', v_node->'explanation'
  );
end;
$$;

revoke all on function public.check_step_answer_v1(uuid, int, int, int) from public;
revoke all on function public.check_step_answer_v1(uuid, int, int, int) from anon;
grant execute on function public.check_step_answer_v1(uuid, int, int, int) to authenticated;
grant execute on function public.check_step_answer_v1(uuid, int, int, int) to service_role;

commit;
