-- Add rank_tier column to questions table
ALTER TABLE public.questions
ADD COLUMN rank_tier TEXT NOT NULL DEFAULT 'Bronze';

-- Add a check constraint to ensure valid rank tiers
ALTER TABLE public.questions
ADD CONSTRAINT valid_rank_tier CHECK (
  rank_tier IN ('Bronze', 'Silver', 'Gold', 'Diamond', 'Unbeatable', 'Pocket Calculator')
);

-- Create index for better filtering performance
CREATE INDEX idx_questions_rank_tier ON public.questions(rank_tier);