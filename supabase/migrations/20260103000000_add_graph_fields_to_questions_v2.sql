-- Add optional graph equation and color fields for rendering mathematical graphs.
-- Used by the client to render function graphs from equations (e.g., "x^2", "sin(x)").

ALTER TABLE public.questions_v2
  ADD COLUMN IF NOT EXISTS graph_equation text;

ALTER TABLE public.questions_v2
  ADD COLUMN IF NOT EXISTS graph_color text DEFAULT 'yellow';

COMMENT ON COLUMN public.questions_v2.graph_equation IS 'Optional equation string for rendering a graph (e.g., "x^2", "sin(x)", "x^2 + 2x + 1").';
COMMENT ON COLUMN public.questions_v2.graph_color IS 'Color for the graph line (default: "yellow"). Supports theme color names or hex codes.';

