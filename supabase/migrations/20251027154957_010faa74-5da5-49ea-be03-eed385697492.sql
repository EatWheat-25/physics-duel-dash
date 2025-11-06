-- Create players table for user profiles and MMR
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  mmr INTEGER NOT NULL DEFAULT 1000,
  region TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create queue table for matchmaking
CREATE TABLE IF NOT EXISTS public.queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID UNIQUE NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  mmr INTEGER NOT NULL,
  region TEXT,
  enqueued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create matches table
CREATE TABLE IF NOT EXISTS public.matches_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  p1 UUID NOT NULL REFERENCES public.players(id),
  p2 UUID NOT NULL REFERENCES public.players(id),
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'active', 'ended')),
  p1_score INTEGER DEFAULT 0,
  p2_score INTEGER DEFAULT 0,
  winner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- Create match_events table for audit trail
CREATE TABLE IF NOT EXISTS public.match_events (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches_new(id) ON DELETE CASCADE,
  sender UUID NOT NULL REFERENCES public.players(id),
  type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_queue_subject_chapter_mmr ON public.queue(subject, chapter, mmr);
CREATE INDEX IF NOT EXISTS idx_queue_region ON public.queue(region);
CREATE INDEX IF NOT EXISTS idx_queue_heartbeat ON public.queue(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON public.matches_new(created_at);
CREATE INDEX IF NOT EXISTS idx_matches_players ON public.matches_new(p1, p2);
CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON public.match_events(match_id);

-- Enable RLS
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for players
CREATE POLICY "Users can read their own player profile"
  ON public.players FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own player profile"
  ON public.players FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own player profile"
  ON public.players FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for queue
CREATE POLICY "Users can insert into queue"
  ON public.queue FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can update their own queue entry"
  ON public.queue FOR UPDATE
  USING (auth.uid() = player_id);

CREATE POLICY "Users can delete their own queue entry"
  ON public.queue FOR DELETE
  USING (auth.uid() = player_id);

CREATE POLICY "Users can view their own queue entry"
  ON public.queue FOR SELECT
  USING (auth.uid() = player_id);

-- RLS Policies for matches
CREATE POLICY "Users can view their own matches"
  ON public.matches_new FOR SELECT
  USING (auth.uid() = p1 OR auth.uid() = p2);

CREATE POLICY "Service role can manage matches"
  ON public.matches_new FOR ALL
  USING (true);

-- RLS Policies for match_events
CREATE POLICY "Users can view events from their matches"
  ON public.match_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches_new
      WHERE matches_new.id = match_events.match_id
      AND (matches_new.p1 = auth.uid() OR matches_new.p2 = auth.uid())
    )
  );

CREATE POLICY "Users can insert events into their matches"
  ON public.match_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches_new
      WHERE matches_new.id = match_events.match_id
      AND (matches_new.p1 = auth.uid() OR matches_new.p2 = auth.uid())
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_players_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for players table
CREATE TRIGGER update_players_timestamp
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.update_players_updated_at();