-- Stage 1a: Rename questions table to questions_legacy
-- This makes rollback easier (just rename back)
-- After this migration, any leftover .from('questions') will hard-fail (intended)

ALTER TABLE IF EXISTS public.questions RENAME TO questions_legacy;

