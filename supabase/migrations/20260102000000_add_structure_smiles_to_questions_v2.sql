-- Add optional SMILES string for skeletal/structure diagrams on the main question.
-- Used by the client to render chemistry structures (SMILES -> SVG).

ALTER TABLE public.questions_v2
  ADD COLUMN IF NOT EXISTS structure_smiles text;

COMMENT ON COLUMN public.questions_v2.structure_smiles IS 'Optional SMILES string for a main-question skeletal/structure diagram (client-rendered).';


