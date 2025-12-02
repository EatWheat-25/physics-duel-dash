-- Seed one Maths A2 integration question with 4 parts
-- Note: This uses the 4-part structure specified in the plan
-- Current UI may not display all parts yet (that's Stage 2), but subject/level filtering will work
INSERT INTO public.questions (id, text, subject, level, steps, created_at)
VALUES (
  gen_random_uuid(),
  'Evaluate the definite integral ∫₀² (3x² − 4x + 1) dx.',
  'maths',
  'a2',
  '[
    {
      "index": 0,
      "prompt": "What is an antiderivative F(x) of f(x) = 3x² − 4x + 1?",
      "options": ["F(x) = x³ − 2x² + x", "F(x) = x³ − 4x² + x", "F(x) = 3x³ − 2x² + x"],
      "correctIndex": 0
    },
    {
      "index": 1,
      "prompt": "What is F(2) for the antiderivative F(x) = x³ − 2x² + x?",
      "options": ["2", "4", "0"],
      "correctIndex": 0
    },
    {
      "index": 2,
      "prompt": "What is F(0) for the same F(x) = x³ − 2x² + x?",
      "options": ["0", "1", "−1"],
      "correctIndex": 0
    },
    {
      "index": 3,
      "prompt": "So what is the value of ∫₀² (3x² − 4x + 1) dx = F(2) − F(0)?",
      "options": ["2", "4", "6"],
      "correctIndex": 0
    }
  ]'::jsonb,
  now()
);

