-- ============================================================================
-- Add Physics Questions to questions_v2
-- ============================================================================
-- This migration adds two Physics questions (Projectile Motion and Kinematics)
-- to the questions_v2 table with properly transformed step formats.

-- Enable pgcrypto extension if not exists (for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insert questions with transformed data
INSERT INTO public.questions_v2 (
  id, 
  title, 
  subject, 
  chapter, 
  level, 
  difficulty, 
  stem, 
  total_marks, 
  topic_tags, 
  steps
)
VALUES
  -- Question 1: Projectile Motion
  (
    gen_random_uuid(),
    'Projectile Motion: Horizontal Range',
    'physics',
    'AS Projectile Motion',
    'A1',
    'medium',
    'A football is kicked from ground level with a speed of 20 m s⁻¹ at an angle of 30° above the horizontal. Ignoring air resistance and taking g = 9.8 m s⁻², what is the horizontal range of the ball when it lands back at the same level?',
    4, -- total_marks (4 steps × 1 mark each)
    ARRAY['projectile-motion', 'kinematics']::TEXT[],
    jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'index', 0,
        'type', 'mcq',
        'title', 'Step 1: Choose Method',
        'prompt', 'Which is the fastest correct method for horizontal range here?',
        'options', jsonb_build_array(
          'Use R = u^2 sin(2θ) / g',
          'Use R = ut only, without finding t',
          'Use v = u + at in the horizontal direction',
          'Use R = u cos(θ) t'
        ),
        'correctAnswer', 0,
        'timeLimitSeconds', 15,
        'marks', 1,
        'explanation', null
      ),
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'index', 1,
        'type', 'mcq',
        'title', 'Step 2: Identify Values',
        'prompt', 'Which pair of values is needed directly for the range formula?',
        'options', jsonb_build_array(
          'u and sin(2θ)',
          'uy and t only',
          'ax and vx',
          'v and θ only'
        ),
        'correctAnswer', 0,
        'timeLimitSeconds', 15,
        'marks', 1,
        'explanation', null
      ),
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'index', 2,
        'type', 'mcq',
        'title', 'Step 3: Setup Formula',
        'prompt', 'Which setup is correct?',
        'options', jsonb_build_array(
          'R = 20^2 sin 60° / 9.8',
          'R = 20^2 sin 30° / 9.8',
          'R = 20^2 cos 60° / 9.8',
          'R = 20 sin 30° / 9.8'
        ),
        'correctAnswer', 0,
        'timeLimitSeconds', 15,
        'marks', 1,
        'explanation', null
      ),
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'index', 3,
        'type', 'mcq',
        'title', 'Step 4: Final Answer',
        'prompt', 'What is the horizontal range?',
        'options', jsonb_build_array(
          '35.4 m',
          '20.4 m',
          '50.0 m',
          '40.0 m'
        ),
        'correctAnswer', 0,
        'timeLimitSeconds', 15,
        'marks', 1,
        'explanation', null
      )
    )
  ),
  -- Question 2: Kinematics
  (
    gen_random_uuid(),
    'Kinematics: Multi-Stage Motion',
    'physics',
    'AS Kinematics',
    'A1',
    'hard',
    'A car starts from rest, accelerates uniformly to 20 m s⁻¹ in 5.0 s, continues at 20 m s⁻¹ for 8.0 s, then decelerates uniformly to rest in 4.0 s. Find the total distance travelled.',
    4, -- total_marks (4 steps × 1 mark each)
    ARRAY['kinematics', 'suvat']::TEXT[],
    jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'index', 0,
        'type', 'mcq',
        'title', 'Step 1: Choose Approach',
        'prompt', 'Best approach?',
        'options', jsonb_build_array(
          'Split into 3 stages and add distances',
          'Use one SUVAT equation for the whole motion',
          'Only use s = vt',
          'Use average speed for entire journey'
        ),
        'correctAnswer', 0,
        'timeLimitSeconds', 15,
        'marks', 1,
        'explanation', null
      ),
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'index', 1,
        'type', 'mcq',
        'title', 'Step 2: Distance Formula',
        'prompt', 'Which expression gives distance in a uniform acceleration stage?',
        'options', jsonb_build_array(
          's = (u + v) t / 2',
          's = vt',
          's = at',
          's = ut + ½at²'
        ),
        'correctAnswer', 0,
        'timeLimitSeconds', 15,
        'marks', 1,
        'explanation', null
      ),
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'index', 2,
        'type', 'mcq',
        'title', 'Step 3: Symbolic Setup',
        'prompt', 'Which symbolic setup is correct?',
        'options', jsonb_build_array(
          's_total = (0+V)t1/2 + Vt2 + (V+0)t3/2',
          's_total = V(t1 + t2 + t3)',
          's_total = V(t1 + t3)/2',
          's_total = Vt1 + Vt2 + Vt3'
        ),
        'correctAnswer', 0,
        'timeLimitSeconds', 15,
        'marks', 1,
        'explanation', null
      ),
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'index', 3,
        'type', 'mcq',
        'title', 'Step 4: Calculate Total Distance',
        'prompt', 'Total distance?',
        'options', jsonb_build_array(
          '250 m',
          '240 m',
          '260 m',
          '270 m'
        ),
        'correctAnswer', 0,
        'timeLimitSeconds', 15,
        'marks', 1,
        'explanation', null
      )
    )
  );

