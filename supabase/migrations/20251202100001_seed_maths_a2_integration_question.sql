-- Seed one Maths A2 integration question with 4 parts
-- Note: This uses the 4-part structure specified in the plan
-- Current UI may not display all parts yet (that's Stage 2), but subject/level filtering will work

-- Delete any existing question with this ID to avoid conflicts
DELETE FROM public.questions_v2 WHERE id = '3f4f0350-ccac-43b2-a1c3-b1ba62519c00';

-- Insert the question with correct schema
INSERT INTO public.questions_v2 (
  id,
  title,
  subject,
  chapter,
  level,
  difficulty,
  rank_tier,
  stem,
  total_marks,
  topic_tags,
  steps
)
VALUES (
  '3f4f0350-ccac-43b2-a1c3-b1ba62519c00',
  'Evaluate the Definite Integral',
  'math',
  'Integration',
  'A2',
  'medium',
  'Bronze',
  'Evaluate the definite integral ∫₀² (x² - 4x + 1) dx.',
  4,
  ARRAY['integration', 'definite-integrals', 'antiderivatives'],
  '[
    {
      "id": "step-1",
      "index": 0,
      "type": "mcq",
      "title": "Find the Antiderivative",
      "prompt": "What is an antiderivative F(x) of f(x) = x² - 4x + 1?",
      "options": [
        "F(x) = x³/3 - 2x² + x",
        "F(x) = x³ - 2x² + x",
        "F(x) = x³/3 - 4x²/2 + x",
        "F(x) = 2x - 4"
      ],
      "correctAnswer": 0,
      "timeLimitSeconds": 60,
      "marks": 1,
      "explanation": "The antiderivative of x² is x³/3, of -4x is -2x², and of 1 is x. So F(x) = x³/3 - 2x² + x + C. For definite integrals, we can use C = 0."
    },
    {
      "id": "step-2",
      "index": 1,
      "type": "mcq",
      "title": "Evaluate F(2)",
      "prompt": "What is F(2) for the antiderivative F(x) = x³/3 - 2x² + x?",
      "options": [
        "2/3",
        "4",
        "8/3",
        "2"
      ],
      "correctAnswer": 0,
      "timeLimitSeconds": 45,
      "marks": 1,
      "explanation": "F(2) = (2)³/3 - 2(2)² + 2 = 8/3 - 8 + 2 = 8/3 - 6 = 2/3"
    },
    {
      "id": "step-3",
      "index": 2,
      "type": "mcq",
      "title": "Evaluate F(0)",
      "prompt": "What is F(0) for the same antiderivative F(x) = x³/3 - 2x² + x?",
      "options": [
        "0",
        "1",
        "-1",
        "2"
      ],
      "correctAnswer": 0,
      "timeLimitSeconds": 30,
      "marks": 1,
      "explanation": "F(0) = (0)³/3 - 2(0)² + 0 = 0 - 0 + 0 = 0"
    },
    {
      "id": "step-4",
      "index": 3,
      "type": "mcq",
      "title": "Calculate the Definite Integral",
      "prompt": "So what is the value of ∫₀² (x² - 4x + 1) dx = F(2) - F(0)?",
      "options": [
        "2/3",
        "4",
        "6",
        "8/3"
      ],
      "correctAnswer": 0,
      "timeLimitSeconds": 45,
      "marks": 1,
      "explanation": "Using the Fundamental Theorem of Calculus: ∫₀² (x² - 4x + 1) dx = F(2) - F(0) = 2/3 - 0 = 2/3"
    }
  ]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  subject = EXCLUDED.subject,
  chapter = EXCLUDED.chapter,
  level = EXCLUDED.level,
  difficulty = EXCLUDED.difficulty,
  rank_tier = EXCLUDED.rank_tier,
  stem = EXCLUDED.stem,
  total_marks = EXCLUDED.total_marks,
  topic_tags = EXCLUDED.topic_tags,
  steps = EXCLUDED.steps,
  updated_at = NOW();

