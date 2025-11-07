/*
  # Event-Driven Matchmaking System (CORRECTED)

  1. Schema Changes
    - Augment queue table with status, region, acceptable_mmr_range
    - Create match_offers table for offer/accept flow
    - Add RPC functions for atomic matching and offer handling
    - Add advisory lock helpers

  2. Security
    - RLS policies ONLY for authenticated users (service role bypasses automatically)
    - NO "USING (true)" policies that open tables to everyone

  3. Indexes
    - Composite index on (subject, region, status, enqueued_at)
    - Index on (status, subject, mmr)
*/

-- Step 1: Augment queue table (add columns if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'queue' AND column_name = 'status') THEN
    ALTER TABLE public.queue ADD COLUMN status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','offered','paired','left'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'queue' AND column_name = 'acceptable_mmr_range') THEN
    ALTER TABLE public.queue ADD COLUMN acceptable_mmr_range INTEGER DEFAULT 50;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'queue' AND column_name = 'region') THEN
    ALTER TABLE public.queue ADD COLUMN region TEXT DEFAULT 'pk';
  END IF;
END $$;

-- Step 2: Create match_offers table
CREATE TABLE IF NOT EXISTS public.match_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL,
  subject TEXT NOT NULL,
  region TEXT NOT NULL,
  p1 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  p2 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  p1_accept BOOLEAN DEFAULT false,
  p2_accept BOOLEAN DEFAULT false,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','confirmed','expired','declined'))
);

ALTER TABLE public.match_offers ENABLE ROW LEVEL SECURITY;

-- RLS for match_offers: participants can view their own offers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'match_offers' AND policyname = 'Participants can view their offers') THEN
    CREATE POLICY "Participants can view their offers"
      ON public.match_offers FOR SELECT
      USING (auth.uid() = p1 OR auth.uid() = p2);
  END IF;
END $$;

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_queue_matchmaking ON public.queue(subject, region, status, enqueued_at);
CREATE INDEX IF NOT EXISTS idx_queue_mmr_status ON public.queue(status, subject, mmr);
CREATE INDEX IF NOT EXISTS idx_match_offers_state ON public.match_offers(state, expires_at);
CREATE INDEX IF NOT EXISTS idx_match_offers_players ON public.match_offers(p1, p2);

-- Step 4: Advisory lock helpers
CREATE OR REPLACE FUNCTION public.try_lock(lock_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pg_try_advisory_lock(hashtext(lock_key));
END;
$$;

CREATE OR REPLACE FUNCTION public.unlock(lock_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM pg_advisory_unlock(hashtext(lock_key));
END;
$$;

-- Step 5: match_players RPC (atomic matching with dynamic MMR)
CREATE OR REPLACE FUNCTION public.match_players(subject_in TEXT, region_in TEXT)
RETURNS TABLE(offer_id UUID, match_id UUID, p1_id UUID, p2_id UUID, p1_name TEXT, p2_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_candidate RECORD;
  v_partner RECORD;
  v_mmr_range INTEGER;
  v_wait_seconds INTEGER;
  v_match_id UUID;
  v_offer_id UUID;
BEGIN
  -- Select head candidate (first in queue for this subject/region)
  SELECT q.*, pl.display_name
  INTO v_candidate
  FROM public.queue q
  JOIN public.players pl ON pl.id = q.player_id
  WHERE q.subject = subject_in
    AND q.region = region_in
    AND q.status = 'waiting'
  ORDER BY q.enqueued_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_candidate IS NULL THEN
    RETURN;
  END IF;

  -- Calculate dynamic MMR range based on wait time
  v_wait_seconds := EXTRACT(EPOCH FROM (now() - v_candidate.enqueued_at))::INTEGER;
  IF v_wait_seconds < 30 THEN
    v_mmr_range := 50;
  ELSIF v_wait_seconds < 60 THEN
    v_mmr_range := 100;
  ELSIF v_wait_seconds < 120 THEN
    v_mmr_range := 200;
  ELSE
    v_mmr_range := 300;
  END IF;

  -- Find best partner within MMR range
  SELECT q.*, pl.display_name
  INTO v_partner
  FROM public.queue q
  JOIN public.players pl ON pl.id = q.player_id
  WHERE q.subject = subject_in
    AND q.region = region_in
    AND q.status = 'waiting'
    AND q.player_id != v_candidate.player_id
    AND ABS(q.mmr - v_candidate.mmr) <= v_mmr_range
  ORDER BY ABS(q.mmr - v_candidate.mmr) ASC, q.enqueued_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_partner IS NULL THEN
    RETURN;
  END IF;

  -- Create match and offer
  v_match_id := gen_random_uuid();

  INSERT INTO public.match_offers (id, match_id, subject, region, p1, p2, expires_at)
  VALUES (gen_random_uuid(), v_match_id, subject_in, region_in, v_candidate.player_id, v_partner.player_id, now() + interval '15 seconds')
  RETURNING id INTO v_offer_id;

  -- Update queue status
  UPDATE public.queue SET status = 'offered' WHERE player_id IN (v_candidate.player_id, v_partner.player_id);

  -- Return offer info
  RETURN QUERY SELECT v_offer_id, v_match_id, v_candidate.player_id, v_partner.player_id, v_candidate.display_name, v_partner.display_name;
END;
$$;

-- Step 6: accept_offer RPC (idempotent, race-safe)
CREATE OR REPLACE FUNCTION public.accept_offer(offer_id_in UUID, player_id_in UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offer RECORD;
BEGIN
  -- Lock and get offer
  SELECT * INTO v_offer
  FROM public.match_offers
  WHERE id = offer_id_in
  FOR UPDATE;

  IF v_offer IS NULL THEN
    RETURN 'not_found';
  END IF;

  IF v_offer.state != 'pending' THEN
    RETURN v_offer.state;
  END IF;

  IF now() > v_offer.expires_at THEN
    UPDATE public.match_offers SET state = 'expired' WHERE id = offer_id_in;
    UPDATE public.queue SET status = 'waiting' WHERE player_id IN (v_offer.p1, v_offer.p2);
    RETURN 'expired';
  END IF;

  -- Mark player accepted
  IF v_offer.p1 = player_id_in THEN
    UPDATE public.match_offers SET p1_accept = true WHERE id = offer_id_in;
  ELSIF v_offer.p2 = player_id_in THEN
    UPDATE public.match_offers SET p2_accept = true WHERE id = offer_id_in;
  ELSE
    RETURN 'unauthorized';
  END IF;

  -- Reselect row to get fresh state after update
  SELECT * INTO v_offer FROM public.match_offers WHERE id = offer_id_in FOR UPDATE;

  -- If both accepted, create match
  IF v_offer.p1_accept AND v_offer.p2_accept THEN
    UPDATE public.match_offers SET state = 'confirmed' WHERE id = offer_id_in;
    UPDATE public.queue SET status = 'paired' WHERE player_id IN (v_offer.p1, v_offer.p2);

    INSERT INTO public.matches_new (id, p1, p2, subject, chapter, state)
    VALUES (v_offer.match_id, v_offer.p1, v_offer.p2, v_offer.subject, 'default', 'active')
    ON CONFLICT DO NOTHING;

    RETURN 'confirmed';
  END IF;

  RETURN 'pending';
END;
$$;

-- Step 7: decline_offer RPC
CREATE OR REPLACE FUNCTION public.decline_offer(offer_id_in UUID, player_id_in UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offer RECORD;
BEGIN
  SELECT * INTO v_offer FROM public.match_offers WHERE id = offer_id_in FOR UPDATE;

  IF v_offer IS NULL OR v_offer.state != 'pending' THEN
    RETURN;
  END IF;

  UPDATE public.match_offers SET state = 'declined' WHERE id = offer_id_in;

  -- Return both players to waiting
  UPDATE public.queue SET status = 'waiting' WHERE player_id IN (v_offer.p1, v_offer.p2);
END;
$$;
