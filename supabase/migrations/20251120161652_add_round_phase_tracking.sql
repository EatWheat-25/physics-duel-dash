/*
  # Add Round Phase Tracking

  1. Schema Changes
    - Add phase tracking columns to match_questions table
    - Add player answer tracking columns
    - Add timestamp columns for phase transitions

  2. New Columns
    - phase: Current phase of the round (thinking, choosing, result)
    - thinking_started_at: When thinking phase began
    - choosing_started_at: When choosing phase began  
    - thinking_ends_at: Deadline for thinking phase
    - choosing_ends_at: Deadline for choosing phase
    - p1_answer: Player 1's selected option index
    - p2_answer: Player 2's selected option index
    - p1_answered_at: When player 1 submitted
    - p2_answered_at: When player 2 submitted
    - p1_correct: Whether player 1 answered correctly
    - p2_correct: Whether player 2 answered correctly
*/

-- Add phase tracking columns to match_questions
ALTER TABLE public.match_questions
  ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'thinking' 
    CHECK (phase IN ('thinking', 'choosing', 'result')),
  ADD COLUMN IF NOT EXISTS thinking_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS choosing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS thinking_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS choosing_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS p1_answer INTEGER,
  ADD COLUMN IF NOT EXISTS p2_answer INTEGER,
  ADD COLUMN IF NOT EXISTS p1_answered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS p2_answered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS p1_correct BOOLEAN,
  ADD COLUMN IF NOT EXISTS p2_correct BOOLEAN;

-- Create index for efficient phase queries
CREATE INDEX IF NOT EXISTS match_questions_phase_idx ON public.match_questions(match_id, phase);
CREATE INDEX IF NOT EXISTS match_questions_deadlines_idx ON public.match_questions(match_id, thinking_ends_at, choosing_ends_at);