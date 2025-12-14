-- Create RPC function to safely delete questions with cascade deletion
-- This function handles all foreign key relationships in a transaction

CREATE OR REPLACE FUNCTION public.delete_question_cascade(p_question_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_error_message TEXT;
  v_result JSONB;
BEGIN
  -- Start transaction (implicit in function)
  
  -- Delete match_answers that reference this question
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'match_answers') THEN
    DELETE FROM public.match_answers WHERE question_id = p_question_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % match_answers', v_deleted_count;
  END IF;

  -- Delete match_rounds that reference this question
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'match_rounds') THEN
    DELETE FROM public.match_rounds WHERE question_id = p_question_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % match_rounds', v_deleted_count;
  END IF;

  -- Delete match_questions that reference this question (if table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'match_questions') THEN
    DELETE FROM public.match_questions WHERE question_id = p_question_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % match_questions', v_deleted_count;
  END IF;

  -- Finally, delete the question itself
  DELETE FROM public.questions_v2 WHERE id = p_question_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Question not found',
      'question_id', p_question_id
    );
  END IF;

  -- Success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Question and all related records deleted successfully',
    'question_id', p_question_id
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback is automatic in function
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    RETURN jsonb_build_object(
      'success', false,
      'error', v_error_message,
      'question_id', p_question_id
    );
END;
$$;

-- Grant execute permission to authenticated users (admins will use this)
GRANT EXECUTE ON FUNCTION public.delete_question_cascade(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.delete_question_cascade(UUID) IS 
  'Safely deletes a question and all related records (match_answers, match_rounds, match_questions) in a transaction. Returns JSONB with success status.';

