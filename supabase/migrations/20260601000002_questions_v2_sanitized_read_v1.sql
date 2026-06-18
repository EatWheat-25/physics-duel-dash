-- 20260601000002_questions_v2_sanitized_read_v1.sql
-- Security hardening, phase 2:
--   * questions_v2: drop public SELECT; admins only.
--   * get_questions_for_play_v1: sanitized rows (steps stripped of answer keys)
--     for player-facing fetches.
--   * get_question_topics_v1: lightweight chapter/topic metadata for the
--     campaign topic picker.
--   * check_step_answer_v1: per-step grading + reveal (correct answer and
--     explanation are returned only after the player has committed an answer).

begin;

-- ----------------------------------------------------------------------------
-- RLS: questions_v2 readable by admins only (service_role keeps its policy).
-- ----------------------------------------------------------------------------
drop policy if exists "questions_v2_select_all" on public.questions_v2;

drop policy if exists "questions_v2_select_admin" on public.questions_v2;
create policy "questions_v2_select_admin"
  on public.questions_v2
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------------------------------------------
-- Helper: strip answer keys / explanations from a steps jsonb array.
-- Handles steps, subSteps / sub_steps arrays, and legacy subStep / sub_step
-- single objects.
-- ----------------------------------------------------------------------------
create or replace function public._sanitize_question_steps(p_steps jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_result jsonb := '[]'::jsonb;
  v_step jsonb;
  v_clean jsonb;
  v_sub jsonb;
  v_clean_subs jsonb;
  v_key text;
begin
  if p_steps is null or jsonb_typeof(p_steps) <> 'array' then
    return '[]'::jsonb;
  end if;

  for v_step in select * from jsonb_array_elements(p_steps) loop
    if jsonb_typeof(v_step) <> 'object' then
      v_result := v_result || jsonb_build_array(v_step);
      continue;
    end if;

    v_clean := v_step - 'correctAnswer' - 'correct_answer' - 'explanation';

    foreach v_key in array array['subSteps', 'sub_steps'] loop
      if v_clean ? v_key and jsonb_typeof(v_clean->v_key) = 'array' then
        v_clean_subs := '[]'::jsonb;
        for v_sub in select * from jsonb_array_elements(v_clean->v_key) loop
          if jsonb_typeof(v_sub) = 'object' then
            v_clean_subs := v_clean_subs
              || jsonb_build_array(v_sub - 'correctAnswer' - 'correct_answer' - 'explanation');
          else
            v_clean_subs := v_clean_subs || jsonb_build_array(v_sub);
          end if;
        end loop;
        v_clean := jsonb_set(v_clean, array[v_key], v_clean_subs);
      end if;
    end loop;

    foreach v_key in array array['subStep', 'sub_step'] loop
      if v_clean ? v_key and jsonb_typeof(v_clean->v_key) = 'object' then
        v_clean := jsonb_set(
          v_clean,
          array[v_key],
          (v_clean->v_key) - 'correctAnswer' - 'correct_answer' - 'explanation'
        );
      end if;
    end loop;

    v_result := v_result || jsonb_build_array(v_clean);
  end loop;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- Helper: extract the correct answer index from a step / sub-step node,
-- mirroring the client contract mapper (correctAnswer | correct_answer |
-- correct_answer.correctIndex, defaulting to 0).
-- ----------------------------------------------------------------------------
create or replace function public._question_node_correct_answer(p_node jsonb)
returns int
language sql
immutable
set search_path = public
as $$
  select case
    when jsonb_typeof(p_node->'correctAnswer') = 'number'
      then floor((p_node->>'correctAnswer')::numeric)::int
    when jsonb_typeof(p_node->'correct_answer') = 'number'
      then floor((p_node->>'correct_answer')::numeric)::int
    when jsonb_typeof(p_node->'correct_answer') = 'object'
         and jsonb_typeof(p_node->'correct_answer'->'correctIndex') = 'number'
      then floor((p_node->'correct_answer'->>'correctIndex')::numeric)::int
    else 0
  end;
$$;

-- ----------------------------------------------------------------------------
-- Sanitized player-facing question fetch.
-- ----------------------------------------------------------------------------
create or replace function public.get_questions_for_play_v1(
  p_subject text default null,
  p_level text default null,
  p_chapter text default null,
  p_topic_tag text default null,
  p_difficulty text default null,
  p_rank_tier text default null,
  p_limit int default 500,
  p_offset int default 0
)
returns table (
  id uuid,
  title text,
  subject text,
  chapter text,
  level text,
  difficulty text,
  rank_tier text,
  stem text,
  total_marks integer,
  topic_tags text[],
  steps jsonb,
  image_url text,
  structure_smiles text,
  graph jsonb,
  main_question_timer_seconds integer,
  is_enabled boolean,
  is_done boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id,
    q.title,
    q.subject,
    q.chapter,
    q.level,
    q.difficulty,
    q.rank_tier,
    q.stem,
    q.total_marks,
    q.topic_tags,
    public._sanitize_question_steps(q.steps) as steps,
    q.image_url,
    q.structure_smiles,
    q.graph,
    q.main_question_timer_seconds,
    q.is_enabled,
    q.is_done,
    q.created_at,
    q.updated_at
  from public.questions_v2 q
  where q.is_enabled = true
    and (p_subject is null or q.subject = p_subject)
    and (p_level is null or q.level = p_level)
    and (p_chapter is null or q.chapter = p_chapter)
    and (p_topic_tag is null or q.topic_tags @> array[p_topic_tag])
    and (p_difficulty is null or q.difficulty = p_difficulty)
    and (p_rank_tier is null or q.rank_tier = p_rank_tier)
  order by q.id
  limit least(greatest(coalesce(p_limit, 500), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.get_questions_for_play_v1(text, text, text, text, text, text, int, int) to authenticated;

-- ----------------------------------------------------------------------------
-- Lightweight topic metadata for the campaign picker (no question content).
-- ----------------------------------------------------------------------------
create or replace function public.get_question_topics_v1(
  p_subject text default null,
  p_level text default null
)
returns table (
  chapter text,
  topic_tags text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select q.chapter, q.topic_tags
  from public.questions_v2 q
  where q.is_enabled = true
    and (p_subject is null or q.subject = p_subject)
    and (p_level is null or q.level = p_level);
$$;

grant execute on function public.get_question_topics_v1(text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Per-step answer check (reveal-after-commit). Returns correctness plus the
-- correct index and explanation so the client can show feedback.
-- ----------------------------------------------------------------------------
create or replace function public.check_step_answer_v1(
  p_question_id uuid,
  p_step_index int,
  p_answer int,
  p_sub_index int default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_steps jsonb;
  v_node jsonb;
  v_correct int;
begin
  if auth.uid() is null and not public._is_service_role() then
    raise exception 'check_step_answer_v1: not authenticated';
  end if;

  select q.steps into v_steps
  from public.questions_v2 q
  where q.id = p_question_id;

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

  return jsonb_build_object(
    'is_correct', p_answer is not null and p_answer = v_correct,
    'correct_answer', v_correct,
    'explanation', v_node->'explanation'
  );
end;
$$;

grant execute on function public.check_step_answer_v1(uuid, int, int, int) to authenticated;

commit;
