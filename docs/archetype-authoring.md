## Archetype authoring (Anti-Clumping Engine)

An **archetype** describes the *specific mechanical operation* a question asks the
player to perform - independent of its chapter or topic. Two questions can share
the same chapter (e.g. "Completing the Square") yet have very different
archetypes (`find_constants` vs `find_vertex` vs `solve_equation`).

The engine uses archetypes to prevent **clumping** - several mechanically
identical questions in a row. There are two consumers:

- **System A - Tetris Bag** (Campaign + Solo Challenge): builds a deck by taking
  one question per archetype, round-robined, so consecutive questions differ.
- **System B - Exclusion Memory** (online Battle): the next question is filtered
  to exclude the archetype of the previous round.

### How archetypes are stored

There is **no new column**. The archetype is a single entry in the existing
`questions_v2.topic_tags TEXT[]` array, prefixed with `archetype_`:

```text
topic_tags = ARRAY['quadratics', 'completing-the-square', 'archetype_find_constants']
```

Rules:

1. **Exactly one** `archetype_*` entry per question. A question with none is
   treated as `archetype_unclassified` by the engine and will surface in admin
   for manual tagging.
2. The value after the prefix is `snake_case` (e.g. `archetype_find_vertex`).
3. All other tags stay free-form for searchability.

### Tagging in the admin UI

In **Admin → Question editor** use the **Archetype (Anti-Clumping)** dropdown
(below Topic Tags). It is filtered to suggest archetypes relevant to the chosen
chapter, plus a "General" group. On save, the selection is folded into
`topic_tags` via `setArchetypeTag`, replacing any existing `archetype_*` entry,
so you never get duplicates.

### Taxonomy (starter set)

Defined in [`src/lib/archetypes.ts`](../src/lib/archetypes.ts) - extend it as new
chapters are authored.

| Family | Archetype values |
| --- | --- |
| Completing the Square | `find_constants`, `find_vertex`, `solve_equation` |
| Quadratics | `discriminant`, `solve_roots`, `sum_product_roots`, `sketch_parabola` |
| Differentiation | `differentiate_expression`, `find_gradient`, `tangent_normal`, `stationary_points`, `rates_of_change` |
| Integration | `indefinite_integral`, `definite_integral`, `area_under_curve`, `integration_by_parts`, `integration_by_substitution` |
| Trigonometry | `solve_trig_equation`, `prove_identity`, `evaluate_exact` |
| General (fallback) | `evaluate`, `solve`, `simplify`, `interpret` |

### Authoring a new question (checklist)

1. Pick the family that matches the **operation**, not just the chapter.
2. Add exactly one `archetype_<value>` to `topic_tags`.
3. If no existing value fits, add a new one to `ARCHETYPE_FAMILIES` in
   `src/lib/archetypes.ts` first, then tag the question with it.

### Formatting rules (important)

- Archetype values are lowercase `snake_case`, always prefixed `archetype_`.
- When writing SQL seed/migration arrays, keep it a plain array literal:
  `ARRAY['quadratics','completing-the-square','archetype_find_constants']`.
- **Never** put SQL `--` comments *inside* a JSON/JSONB block (e.g. inside the
  `steps` payload) - it corrupts the JSON. Keep comments outside the literal.

### Backfill

[`supabase/migrations/20260601000009_archetype_backfill_v1.sql`](../supabase/migrations/20260601000009_archetype_backfill_v1.sql)
performs a best-effort, idempotent heuristic tag of existing `subject='math'`
questions based on chapter + title + stem keywords. Only confident matches are
tagged; the rest remain unclassified for manual review. Re-running is safe -
rows that already carry an `archetype_*` tag are skipped.
