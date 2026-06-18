-- Archetype anti-clumping: best-effort heuristic backfill for math questions.
--
-- Encodes a single `archetype_<value>` entry into questions_v2.topic_tags based
-- on chapter + title + stem + existing tags keyword matches. Only confident
-- matches are tagged; everything else stays untagged (the engine treats those as
-- `archetype_unclassified`) so they surface in admin for manual tagging.
--
-- Idempotent: rows that already carry any `archetype_*` tag are skipped, so this
-- migration can be re-run safely.

with candidates as (
  select
    q.id,
    lower(
      coalesce(q.chapter, '') || ' ' ||
      coalesce(q.title, '') || ' ' ||
      coalesce(q.stem, '') || ' ' ||
      coalesce(array_to_string(q.topic_tags, ' '), '')
    ) as searchable,
    lower(coalesce(q.chapter, '')) as chapter_l
  from public.questions_v2 q
  where q.subject = 'math'
    and not exists (
      select 1 from unnest(q.topic_tags) as t where t like 'archetype\_%'
    )
),
classified as (
  select
    c.id,
    case
      -- Completing the square
      when (c.chapter_l like '%complet%' or c.chapter_l like '%square%') then
        case
          when c.searchable ~ '(vertex|turning point|minimum point|maximum point|min point|max point)' then 'find_vertex'
          when c.searchable ~ '(express|constant| a\(| p, q|p and q)' then 'find_constants'
          when c.searchable ~ '(solve|= 0|equation)' then 'solve_equation'
          else 'find_constants'
        end
      -- Quadratics
      when c.chapter_l like '%quadratic%' then
        case
          when c.searchable ~ '(discriminant|b\^2|real roots|nature of)' then 'discriminant'
          when c.searchable ~ '(sum of roots|product of roots|alpha.*beta)' then 'sum_product_roots'
          when c.searchable ~ '(sketch|parabola|graph)' then 'sketch_parabola'
          when c.searchable ~ '(solve|roots|factor)' then 'solve_roots'
          else 'solve_roots'
        end
      -- Differentiation
      when (c.chapter_l like '%differ%' or c.chapter_l like '%derivative%') then
        case
          when c.searchable ~ '(tangent|normal)' then 'tangent_normal'
          when c.searchable ~ '(stationary|turning point|maximum|minimum)' then 'stationary_points'
          when c.searchable ~ '(rate of change|rates of change|connected rate)' then 'rates_of_change'
          when c.searchable ~ 'gradient' then 'find_gradient'
          when c.searchable ~ '(differentiate|dy/dx|derivative)' then 'differentiate_expression'
          else 'differentiate_expression'
        end
      -- Integration
      when c.chapter_l like '%integrat%' then
        case
          when c.searchable ~ 'by parts' then 'integration_by_parts'
          when c.searchable ~ 'substitution' then 'integration_by_substitution'
          when c.searchable ~ 'area' then 'area_under_curve'
          when c.searchable ~ '(definite|evaluate|∫_)' then 'definite_integral'
          when c.searchable ~ '(integrate|indefinite|integral)' then 'indefinite_integral'
          else 'indefinite_integral'
        end
      -- Trigonometry
      when c.chapter_l like '%trig%' then
        case
          when c.searchable ~ '(identity|prove)' then 'prove_identity'
          when c.searchable ~ 'exact value' then 'evaluate_exact'
          when c.searchable ~ '(solve|equation)' then 'solve_trig_equation'
          else 'solve_trig_equation'
        end
      else null
    end as archetype
  from candidates c
)
update public.questions_v2 q
set topic_tags = array_append(q.topic_tags, 'archetype_' || cl.archetype)
from classified cl
where q.id = cl.id
  and cl.archetype is not null;
