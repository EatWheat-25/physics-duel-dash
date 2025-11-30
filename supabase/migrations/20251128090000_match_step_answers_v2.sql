-- Create match_step_answers_v2 table for per-step answer tracking
CREATE TABLE IF NOT EXISTS match_step_answers_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  round_index integer NOT NULL,
  question_id uuid NOT NULL,
  player_id uuid NOT NULL,
  step_index integer NOT NULL,
  selected_option integer NOT NULL,
  is_correct boolean NOT NULL,
  response_time_ms integer NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now()
);

-- One answer per player per step per round
ALTER TABLE match_step_answers_v2
  ADD CONSTRAINT match_step_answers_v2_unique_answer
  UNIQUE (match_id, round_index, player_id, question_id, step_index);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_match_step_answers_v2_match_round
  ON match_step_answers_v2 (match_id, round_index);

CREATE INDEX IF NOT EXISTS idx_match_step_answers_v2_player
  ON match_step_answers_v2 (player_id);

-- Enable RLS
ALTER TABLE match_step_answers_v2 ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Players can read their own step answers"
  ON match_step_answers_v2
  FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

CREATE POLICY "Service role can do anything with step answers"
  ON match_step_answers_v2
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
