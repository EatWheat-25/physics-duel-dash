-- ========================================
-- Submit Round Answer RPC
-- 
-- Stores a player's answer payload for a round.
-- Called by the WebSocket edge function with explicit p_player_id.
-- 
-- TODO: Full scoring logic (correctness + speed bonus) will be implemented later.
-- Structure is ready - currently sets playerX_round_score = 0 as placeholder.
-- ========================================

-- Drop existing function if it exists (to handle return type changes)
DROP FUNCTION IF EXISTS public.submit_round_answer(UUID, UUID, UUID, JSONB);

CREATE OR REPLACE FUNCTION public.submit_round_answer(
  p_match_id UUID,
  p_round_id UUID,
  p_player_id UUID,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match RECORD;
  v_round RECORD;
  v_is_player1 BOOLEAN;
  v_round_score INT := 0;
  v_question RECORD;
  v_steps JSONB;
  v_step JSONB;
  v_payload_steps JSONB;
  v_step_index INT;
  v_answer_index INT;
  v_correct_answer INT;
  v_step_marks INT;
  v_step_result JSONB;
  v_step_results JSONB := '[]'::jsonb;
BEGIN
  -- Verify match exists and is 'in_progress'
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found: %', p_match_id;
  END IF;
  
  IF v_match.status != 'in_progress' THEN
    RAISE EXCEPTION 'Match is not in progress. Current status: %', v_match.status;
  END IF;
  
  -- Verify round exists and is 'active'
  SELECT * INTO v_round
  FROM public.match_rounds
  WHERE id = p_round_id AND match_id = p_match_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round not found: % for match %', p_round_id, p_match_id;
  END IF;
  
  IF v_round.status != 'active' THEN
    RAISE EXCEPTION 'Round is not active. Current status: %', v_round.status;
  END IF;
  
  -- Verify p_player_id is player1_id or player2_id for that match
  IF p_player_id != v_match.player1_id AND p_player_id != v_match.player2_id THEN
    RAISE EXCEPTION 'Player % is not a participant in match %', p_player_id, p_match_id;
  END IF;
  
  -- Check if round deadline has passed
  IF v_round.round_deadline IS NOT NULL AND now() > v_round.round_deadline THEN
    RAISE EXCEPTION 'Round deadline has passed';
  END IF;
  
  -- Determine if player is player1
  v_is_player1 := (p_player_id = v_match.player1_id);
  
  -- Verify player has not already answered this round
  IF v_is_player1 THEN
    IF v_round.player1_answered_at IS NOT NULL THEN
      RAISE EXCEPTION 'Player1 has already answered this round';
    END IF;
  ELSE
    IF v_round.player2_answered_at IS NOT NULL THEN
      RAISE EXCEPTION 'Player2 has already answered this round';
    END IF;
  END IF;
  
  -- Implement scoring logic: evaluate correctness per step
  -- Get the question for this round
  SELECT * INTO v_question
  FROM public.questions
  WHERE id = v_round.question_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found: %', v_round.question_id;
  END IF;
  
  -- Get steps from question (can be in questions.steps JSONB or question_steps table)
  -- Try questions.steps first (JSONB format)
  v_steps := v_question.steps;
  
  -- If steps is null or empty, try to get from question_steps table
  IF v_steps IS NULL OR jsonb_array_length(COALESCE(v_steps, '[]'::jsonb)) = 0 THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'index', qs.step_index,
        'step_index', qs.step_index,
        'correctAnswer', (qs.correct_answer->>'correctIndex')::int,
        'marks', qs.marks
      ) ORDER BY qs.step_index
    ) INTO v_steps
    FROM public.question_steps qs
    WHERE qs.question_id = v_question.id;
  ELSE
    -- Normalize steps JSONB to ensure consistent field names
    -- Map existing steps to have both 'index' and 'step_index', and 'correctAnswer'
    SELECT jsonb_agg(
      jsonb_build_object(
        'index', COALESCE((step->>'index')::int, (step->>'step_index')::int, ordinality - 1),
        'step_index', COALESCE((step->>'step_index')::int, (step->>'index')::int, ordinality - 1),
        'correctAnswer', COALESCE(
          (step->>'correctAnswer')::int,
          (step->>'correct_answer')::int,
          CASE 
            WHEN jsonb_typeof(step->'correct_answer') = 'object' 
            THEN ((step->'correct_answer')->>'correctIndex')::int
            ELSE NULL
          END
        ),
        'marks', COALESCE((step->>'marks')::int, 1)
      ) ORDER BY ordinality
    ) INTO v_steps
    FROM jsonb_array_elements(v_steps) WITH ORDINALITY AS t(step, ordinality);
  END IF;
  
  -- Extract steps array from payload
  v_payload_steps := p_payload->'steps';
  
  IF v_payload_steps IS NULL OR jsonb_array_length(v_payload_steps) = 0 THEN
    RAISE EXCEPTION 'Payload must contain at least one step answer';
  END IF;
  
  -- Evaluate each step
  FOR v_step IN SELECT * FROM jsonb_array_elements(v_payload_steps)
  LOOP
    v_step_index := (v_step->>'step_index')::int;
    v_answer_index := (v_step->>'answer_index')::int;
    
    -- Find the corresponding step in question steps
    -- Match by step_index or index field
    SELECT 
      COALESCE(
        (step->>'correctAnswer')::int,
        (step->>'correct_answer')::int,
        ((step->'correct_answer')->>'correctIndex')::int
      ),
      COALESCE((step->>'marks')::int, 1)
    INTO v_correct_answer, v_step_marks
    FROM jsonb_array_elements(v_steps) step
    WHERE COALESCE((step->>'step_index')::int, (step->>'index')::int) = v_step_index
    LIMIT 1;
    
    -- If step not found, skip it (shouldn't happen, but be defensive)
    IF v_correct_answer IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Check if answer is correct
    IF v_answer_index = v_correct_answer THEN
      -- Correct answer: add marks to score
      v_round_score := v_round_score + v_step_marks;
      v_step_result := jsonb_build_object(
        'step_index', v_step_index,
        'correct', true,
        'marks_earned', v_step_marks
      );
    ELSE
      -- Wrong answer: 0 points
      v_step_result := jsonb_build_object(
        'step_index', v_step_index,
        'correct', false,
        'marks_earned', 0
      );
    END IF;
    
    -- Add to step_results array
    v_step_results := v_step_results || jsonb_build_array(v_step_result);
  END LOOP;
  
  -- Update match_rounds with answer and calculated score
  IF v_is_player1 THEN
    UPDATE public.match_rounds
    SET 
      player1_answered_at = now(),
      player1_answer_payload = p_payload,
      player1_round_score = v_round_score
    WHERE id = p_round_id;
  ELSE
    UPDATE public.match_rounds
    SET 
      player2_answered_at = now(),
      player2_answer_payload = p_payload,
      player2_round_score = v_round_score
    WHERE id = p_round_id;
  END IF;
  
  -- Return response with round_score and step_results
  RETURN jsonb_build_object(
    'round_score', v_round_score,
    'step_results', v_step_results
  );
END;
$$;

-- Grant execute permission to authenticated users (called via service role in practice)
GRANT EXECUTE ON FUNCTION public.submit_round_answer(UUID, UUID, UUID, JSONB) TO authenticated;

