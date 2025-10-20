-- Create enum for match status
CREATE TYPE match_status AS ENUM ('waiting', 'active', 'completed', 'abandoned');

-- Matchmaking queue table
CREATE TABLE public.matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  mode TEXT NOT NULL,
  rank_tier TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert themselves into queue"
  ON public.matchmaking_queue
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view queue"
  ON public.matchmaking_queue
  FOR SELECT
  USING (true);

CREATE POLICY "Users can delete themselves from queue"
  ON public.matchmaking_queue
  FOR DELETE
  USING (auth.uid() = user_id);

-- Matches table
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  mode TEXT NOT NULL,
  status match_status NOT NULL DEFAULT 'waiting',
  questions JSONB NOT NULL,
  player1_score INTEGER DEFAULT 0,
  player2_score INTEGER DEFAULT 0,
  winner_id UUID REFERENCES auth.users(id),
  current_question_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their own matches"
  ON public.matches
  FOR SELECT
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Players can update their own matches"
  ON public.matches
  FOR UPDATE
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Player actions table (for real-time answer submission)
CREATE TABLE public.player_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL,
  step_index INTEGER NOT NULL,
  answer INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  marks_earned INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.player_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can insert their own actions"
  ON public.player_actions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Players can view actions in their matches"
  ON public.player_actions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE matches.id = player_actions.match_id
      AND (matches.player1_id = auth.uid() OR matches.player2_id = auth.uid())
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_actions;