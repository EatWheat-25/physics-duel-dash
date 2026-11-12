-- Diagram library for the admin "Diagram Library" page.
-- Stores reusable, code-addressable diagrams (e.g. "0101") generated from
-- pasted matplotlib Python, rendered to SVG in-browser via Pyodide. Questions
-- point at a diagram by setting image_url to the diagram's public URL.

CREATE TABLE IF NOT EXISTS public.question_diagrams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text,
  python_source text,
  svg text NOT NULL,
  public_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.question_diagrams IS 'Reusable admin-authored diagrams, addressed by short code and referenced from questions via image_url.';
COMMENT ON COLUMN public.question_diagrams.code IS 'Short human code used to reference the diagram (e.g. "0101").';
COMMENT ON COLUMN public.question_diagrams.python_source IS 'The pasted matplotlib Python source, kept so the diagram can be reloaded and tweaked.';
COMMENT ON COLUMN public.question_diagrams.svg IS 'The rendered SVG markup produced by the script.';
COMMENT ON COLUMN public.question_diagrams.public_url IS 'Public storage URL of the uploaded SVG (question-images bucket).';

-- Keep updated_at fresh on every update.
CREATE OR REPLACE FUNCTION public.set_question_diagrams_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_question_diagrams_updated_at ON public.question_diagrams;
CREATE TRIGGER trg_question_diagrams_updated_at
  BEFORE UPDATE ON public.question_diagrams
  FOR EACH ROW
  EXECUTE FUNCTION public.set_question_diagrams_updated_at();

-- RLS: everyone authenticated can read; only admins can write.
-- Mirrors the questions_v2 policies (JWT user_metadata.role = 'admin').
ALTER TABLE public.question_diagrams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_question_diagrams" ON public.question_diagrams;
CREATE POLICY "anyone_can_read_question_diagrams"
  ON public.question_diagrams
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admins_can_insert_question_diagrams" ON public.question_diagrams;
CREATE POLICY "admins_can_insert_question_diagrams"
  ON public.question_diagrams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "admins_can_update_question_diagrams" ON public.question_diagrams;
CREATE POLICY "admins_can_update_question_diagrams"
  ON public.question_diagrams
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "admins_can_delete_question_diagrams" ON public.question_diagrams;
CREATE POLICY "admins_can_delete_question_diagrams"
  ON public.question_diagrams
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
  );
