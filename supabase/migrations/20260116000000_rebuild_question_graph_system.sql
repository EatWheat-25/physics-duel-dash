-- Rebuild Question Graph System (v1)
-- One graph per question stored in questions_v2.graph (JSONB).
-- Supports:
--  - function graphs: { type: "function", equation, xMin, xMax, color }
--  - points graphs:   { type: "points", points: [{x,y},...], color }
--
-- Also migrates legacy columns graph_equation/graph_color (if present) into graph,
-- and then drops the legacy columns.

begin;

-- 1) Add graph column (JSONB)
alter table public.questions_v2
  add column if not exists graph jsonb;

-- 2) Guardrail: graph must be an object when present
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_v2_graph_is_object'
  ) then
    alter table public.questions_v2
      add constraint questions_v2_graph_is_object
      check (graph is null or jsonb_typeof(graph) = 'object');
  end if;
end $$;

comment on column public.questions_v2.graph is
  'Optional graph config JSON. One graph per question. {type:function|points, ...}';

-- 3) Migrate legacy question-level columns (if they exist)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'questions_v2'
      and column_name = 'graph_equation'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'questions_v2'
        and column_name = 'graph_color'
    ) then
      execute $sql$
        update public.questions_v2
        set graph = jsonb_build_object(
          'type', 'function',
          'equation', graph_equation,
          'xMin', -10,
          'xMax', 10,
          'color',
            case
              when graph_color is null or btrim(graph_color) = '' then 'white'
              when lower(btrim(graph_color)) in ('white','black') then lower(btrim(graph_color))
              else 'white'
            end
        )
        where graph is null
          and graph_equation is not null
          and btrim(graph_equation) <> '';
      $sql$;
    else
      execute $sql$
        update public.questions_v2
        set graph = jsonb_build_object(
          'type', 'function',
          'equation', graph_equation,
          'xMin', -10,
          'xMax', 10,
          'color', 'white'
        )
        where graph is null
          and graph_equation is not null
          and btrim(graph_equation) <> '';
      $sql$;
    end if;
  end if;
end $$;

-- 4) Best-effort migration from legacy STEP-level graphEquation into question graph (if question graph still null)
-- This preserves previously-entered graph equations even if they were stored on a step.
update public.questions_v2 q
set graph = jsonb_build_object(
  'type', 'function',
  'equation',
    (
      select step->>'graphEquation'
      from jsonb_array_elements(q.steps) as step
      where step ? 'graphEquation'
        and btrim(coalesce(step->>'graphEquation','')) <> ''
      limit 1
    ),
  'xMin', -10,
  'xMax', 10,
  'color',
    (
      case
        when (
          select lower(btrim(step->>'graphColor'))
          from jsonb_array_elements(q.steps) as step
          where step ? 'graphColor'
            and btrim(coalesce(step->>'graphColor','')) <> ''
          limit 1
        ) in ('white','black')
          then (
            select lower(btrim(step->>'graphColor'))
            from jsonb_array_elements(q.steps) as step
            where step ? 'graphColor'
              and btrim(coalesce(step->>'graphColor','')) <> ''
            limit 1
          )
        else 'white'
      end
    )
)
where q.graph is null
  and exists (
    select 1
    from jsonb_array_elements(q.steps) as step
    where step ? 'graphEquation'
      and btrim(coalesce(step->>'graphEquation','')) <> ''
  );

-- 5) Drop legacy question-level columns (they are replaced by graph JSON)
alter table public.questions_v2
  drop column if exists graph_equation,
  drop column if exists graph_color;

commit;

