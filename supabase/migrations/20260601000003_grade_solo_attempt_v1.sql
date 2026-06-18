-- 20260601000003_grade_solo_attempt_v1.sql
-- Security hardening, phase 2 (continued):
-- Server-side grading for solo/campaign runs. The client submits the answer
-- indices it chose; the server re-grades them against the stored answer keys
-- and applies rank points internally, so accuracy can no longer be spoofed.

begin;

create or replace function public.grade_solo_attempt_v1(
  p_mode text,            -- 'solo' | 'campaign'
  p_subject text,
  p_level text,
  p_answers jsonb,        -- [{"question_id": "<uuid>", "answers": [0, 2, null, ...]}, ...]
  p_topic_kind text default null,
  p_topic_key text default null,
  p_topic_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid := auth.uid();
  v_entry jsonb;
  v_question_id uuid;
  v_submitted jsonb;
  v_steps jsonb;
  v_step jsonb;
  v_step_pos int;
  v_correct_idx int;
  v_submitted_answer jsonb;
  v_correct_parts int := 0;
  v_total_parts int := 0;
  v_result jsonb;
begin
  if v_player_id is null then
    raise exception 'grade_solo_attempt_v1: not authenticated';
  end if;

  if p_mode not in ('solo', 'campaign') then
    raise exception 'grade_solo_attempt_v1: invalid mode %', p_mode;
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'grade_solo_attempt_v1: answers must be an array';
  end if;

  if jsonb_array_length(p_answers) < 1 or jsonb_array_length(p_answers) > 10 then
    raise exception 'grade_solo_attempt_v1: expected 1-10 graded questions';
  end if;

  for v_entry in select * from jsonb_array_elements(p_answers) loop
    if jsonb_typeof(v_entry) <> 'object' then
      raise exception 'grade_solo_attempt_v1: malformed answer entry';
    end if;

    begin
      v_question_id := (v_entry->>'question_id')::uuid;
    exception when others then
      raise exception 'grade_solo_attempt_v1: invalid question_id';
    end;

    v_submitted := v_entry->'answers';
    if v_submitted is null or jsonb_typeof(v_submitted) <> 'array' then
      raise exception 'grade_solo_attempt_v1: missing answers for question %', v_question_id;
    end if;

    select q.steps into v_steps
    from public.questions_v2 q
    where q.id = v_question_id
      and q.is_enabled = true;

    if v_steps is null then
      raise exception 'grade_solo_attempt_v1: question % not found', v_question_id;
    end if;

    -- Grade each main step in client display order (sorted by index field,
    -- falling back to array position) against the submitted answer at the
    -- same position. Sub-steps never count toward the score.
    v_step_pos := 0;
    for v_step in
      select t.step
      from jsonb_array_elements(v_steps) with ordinality as t(step, ord)
      order by coalesce(
        case when jsonb_typeof(t.step->'index') = 'number'
          then floor((t.step->>'index')::numeric)::int end,
        t.ord::int - 1
      ), t.ord
    loop
      v_total_parts := v_total_parts + 1;
      v_correct_idx := public._question_node_correct_answer(v_step);
      v_submitted_answer := v_submitted->v_step_pos;

      if v_submitted_answer is not null
         and jsonb_typeof(v_submitted_answer) = 'number'
         and floor(v_submitted_answer::text::numeric)::int = v_correct_idx then
        v_correct_parts := v_correct_parts + 1;
      end if;

      v_step_pos := v_step_pos + 1;
    end loop;
  end loop;

  if v_total_parts = 0 then
    raise exception 'grade_solo_attempt_v1: nothing to grade';
  end if;

  if p_mode = 'campaign' then
    v_result := public.record_campaign_challenge_v1(
      v_player_id,
      p_subject,
      p_level,
      p_topic_kind,
      p_topic_key,
      p_topic_label,
      v_correct_parts,
      v_total_parts
    );
  else
    v_result := public.record_solo_challenge_v1(
      v_player_id,
      p_subject,
      p_level,
      v_correct_parts,
      v_total_parts
    );
  end if;

  return v_result || jsonb_build_object(
    'correct_parts', v_correct_parts,
    'total_parts', v_total_parts
  );
end;
$$;

grant execute on function public.grade_solo_attempt_v1(text, text, text, jsonb, text, text, text) to authenticated;

commit;
