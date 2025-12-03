-- Diagnostic Query: Check Question Structure
-- Run this in Supabase SQL Editor to see how questions are stored

-- Check if questions have steps in JSONB or question_steps table
SELECT 
  q.id,
  q.title,
  q.subject,
  q.level,
  CASE 
    WHEN q.steps IS NOT NULL AND jsonb_array_length(q.steps) > 0 
    THEN 'Has steps in JSONB'
    ELSE 'No steps in JSONB'
  END as steps_location,
  -- Show first step structure if exists
  CASE 
    WHEN q.steps IS NOT NULL AND jsonb_array_length(q.steps) > 0 
    THEN q.steps->0
    ELSE NULL
  END as first_step_sample,
  -- Check question_steps table
  (SELECT COUNT(*) FROM question_steps WHERE question_id = q.id) as question_steps_count
FROM questions q
WHERE subject = 'math' AND level = 'A2'
ORDER BY q.created_at DESC
LIMIT 5;

-- Check a specific question's correct answer format
-- Replace 'YOUR_QUESTION_ID' with an actual question ID from above
/*
SELECT 
  qs.step_index,
  qs.correct_answer,
  qs.correct_answer->>'correctIndex' as correct_index_extracted,
  qs.marks
FROM question_steps qs
WHERE qs.question_id = 'YOUR_QUESTION_ID'
ORDER BY qs.step_index;
*/

-- Check recent match rounds to see if scores are being calculated
SELECT 
  mr.id,
  mr.round_number,
  mr.player1_round_score,
  mr.player2_round_score,
  mr.player1_answer_payload,
  mr.player2_answer_payload,
  q.id as question_id,
  q.steps IS NOT NULL as has_steps_jsonb,
  (SELECT COUNT(*) FROM question_steps WHERE question_id = q.id) as has_question_steps
FROM match_rounds mr
JOIN questions q ON q.id = mr.question_id
ORDER BY mr.created_at DESC
LIMIT 10;


