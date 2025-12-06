-- Rename old questions table to questions_legacy
-- This freezes the old table and prevents accidental use
ALTER TABLE IF EXISTS public.questions RENAME TO questions_legacy;

