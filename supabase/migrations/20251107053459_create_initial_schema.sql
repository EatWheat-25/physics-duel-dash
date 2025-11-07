/*
  # Create Initial Schema for Math Battle App

  1. New Tables
    - `profiles` - User profiles
    - `user_roles` - User role assignments  
    - `questions` - Question bank
    - `players` - Player profiles for matchmaking
    - `queue` - Matchmaking queue
    - `matches_new` - Match records
    - `match_events` - Match event logs

  2. Security
    - Enable RLS on all tables
    - Add restrictive policies for each table
    
  3. Indexes
    - Performance indexes for queries
  
  4. Functions
    - Helper functions for timestamps and role checks
*/

-- Create enum for user roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  age INTEGER,
  subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create security definer function to check roles (after user_roles table exists)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create questions table
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL CHECK (subject IN ('math', 'physics', 'chemistry')),
  chapter TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_text TEXT NOT NULL,
  total_marks INTEGER NOT NULL,
  topic_tags TEXT[] DEFAULT '{}',
  steps JSONB NOT NULL,
  rank_tier TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create players table
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  mmr INTEGER NOT NULL DEFAULT 1000,
  region TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create queue table
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

-- Create match_events table
CREATE TABLE IF NOT EXISTS public.match_events (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches_new(id) ON DELETE CASCADE,
  sender UUID NOT NULL REFERENCES public.players(id),
  type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_queue_subject_chapter_mmr ON public.queue(subject, chapter, mmr);
CREATE INDEX IF NOT EXISTS idx_queue_region ON public.queue(region);
CREATE INDEX IF NOT EXISTS idx_queue_heartbeat ON public.queue(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON public.matches_new(created_at);
CREATE INDEX IF NOT EXISTS idx_matches_players ON public.matches_new(p1, p2);
CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON public.match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_questions_rank_tier ON public.questions(rank_tier);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view their own profile') THEN
    CREATE POLICY "Users can view their own profile"
      ON public.profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update their own profile') THEN
    CREATE POLICY "Users can update their own profile"
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert their own profile') THEN
    CREATE POLICY "Users can insert their own profile"
      ON public.profiles FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- RLS Policies for user_roles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Users can view their own roles') THEN
    CREATE POLICY "Users can view their own roles"
      ON public.user_roles FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Admins can manage all roles') THEN
    CREATE POLICY "Admins can manage all roles"
      ON public.user_roles FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- RLS Policies for questions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'questions' AND policyname = 'Anyone can view questions') THEN
    CREATE POLICY "Anyone can view questions"
      ON public.questions FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'questions' AND policyname = 'Admins can insert questions') THEN
    CREATE POLICY "Admins can insert questions"
      ON public.questions FOR INSERT
      TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'questions' AND policyname = 'Admins can update questions') THEN
    CREATE POLICY "Admins can update questions"
      ON public.questions FOR UPDATE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'questions' AND policyname = 'Admins can delete questions') THEN
    CREATE POLICY "Admins can delete questions"
      ON public.questions FOR DELETE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- RLS Policies for players
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'players' AND policyname = 'Users can read their own player profile') THEN
    CREATE POLICY "Users can read their own player profile"
      ON public.players FOR SELECT
      USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'players' AND policyname = 'Users can insert their own player profile') THEN
    CREATE POLICY "Users can insert their own player profile"
      ON public.players FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'players' AND policyname = 'Users can update their own player profile') THEN
    CREATE POLICY "Users can update their own player profile"
      ON public.players FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END $$;

-- RLS Policies for queue
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'queue' AND policyname = 'Users can insert into queue') THEN
    CREATE POLICY "Users can insert into queue"
      ON public.queue FOR INSERT
      WITH CHECK (auth.uid() = player_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'queue' AND policyname = 'Users can update their own queue entry') THEN
    CREATE POLICY "Users can update their own queue entry"
      ON public.queue FOR UPDATE
      USING (auth.uid() = player_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'queue' AND policyname = 'Users can delete their own queue entry') THEN
    CREATE POLICY "Users can delete their own queue entry"
      ON public.queue FOR DELETE
      USING (auth.uid() = player_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'queue' AND policyname = 'Users can view their own queue entry') THEN
    CREATE POLICY "Users can view their own queue entry"
      ON public.queue FOR SELECT
      USING (auth.uid() = player_id);
  END IF;
END $$;

-- RLS Policies for matches
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matches_new' AND policyname = 'Users can view their own matches') THEN
    CREATE POLICY "Users can view their own matches"
      ON public.matches_new FOR SELECT
      USING (auth.uid() = p1 OR auth.uid() = p2);
  END IF;
END $$;

-- RLS Policies for match_events
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'match_events' AND policyname = 'Users can view events from their matches') THEN
    CREATE POLICY "Users can view events from their matches"
      ON public.match_events FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.matches_new
          WHERE matches_new.id = match_events.match_id
          AND (matches_new.p1 = auth.uid() OR matches_new.p2 = auth.uid())
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'match_events' AND policyname = 'Users can insert events into their matches') THEN
    CREATE POLICY "Users can insert events into their matches"
      ON public.match_events FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.matches_new
          WHERE matches_new.id = match_events.match_id
          AND (matches_new.p1 = auth.uid() OR matches_new.p2 = auth.uid())
        )
      );
  END IF;
END $$;

-- Create triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_questions_updated_at ON public.questions;
CREATE TRIGGER update_questions_updated_at
  BEFORE UPDATE ON public.questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_players_timestamp ON public.players;
CREATE TRIGGER update_players_timestamp
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
