// Archetype classification layer.
//
// An "archetype" describes the specific mechanical operation a question asks the
// player to perform (e.g. for Completing the Square: find_constants vs
// find_vertex vs solve_equation), independent of the coarse chapter/topic.
//
// Archetypes are encoded as a single `archetype_<value>` entry inside the
// existing `questions_v2.topic_tags TEXT[]` column, so no schema change is
// required. The engine groups questions by archetype to avoid serving multiple
// mechanically-identical questions back-to-back ("clumping").

export const ARCHETYPE_PREFIX = 'archetype_'

/** Stable value used when a question carries no archetype tag. */
export const UNCLASSIFIED_ARCHETYPE_VALUE = 'unclassified'
export const UNCLASSIFIED_ARCHETYPE_TAG = `${ARCHETYPE_PREFIX}${UNCLASSIFIED_ARCHETYPE_VALUE}`

export const isArchetypeTag = (tag: unknown): tag is string =>
  typeof tag === 'string' && tag.startsWith(ARCHETYPE_PREFIX) && tag.length > ARCHETYPE_PREFIX.length

/**
 * Returns the full archetype tag for a question (e.g. `archetype_find_vertex`).
 * Falls back to `archetype_unclassified` so grouping is always well-defined.
 */
export const getArchetype = (topicTags: readonly string[] | null | undefined): string => {
  if (Array.isArray(topicTags)) {
    const found = topicTags.find(isArchetypeTag)
    if (found) return found
  }
  return UNCLASSIFIED_ARCHETYPE_TAG
}

/** Returns the bare archetype value (e.g. `find_vertex`, or `unclassified`). */
export const getArchetypeValue = (topicTags: readonly string[] | null | undefined): string =>
  getArchetype(topicTags).slice(ARCHETYPE_PREFIX.length)

/**
 * Replaces any existing `archetype_*` entry with a single new one (used on save).
 * Passing an empty value strips the archetype tag entirely.
 */
export const setArchetypeTag = (tags: readonly string[], value: string): string[] => {
  const withoutArchetype = (Array.isArray(tags) ? tags : []).filter((tag) => !isArchetypeTag(tag))
  const trimmed = (value ?? '').trim()
  if (!trimmed) return withoutArchetype
  const normalized = trimmed.startsWith(ARCHETYPE_PREFIX) ? trimmed : `${ARCHETYPE_PREFIX}${trimmed}`
  return [...withoutArchetype, normalized]
}

export interface ArchetypeOption {
  value: string
  label: string
}

export interface ArchetypeFamily {
  /** Human-readable family label, shown as an <optgroup> in the admin UI. */
  label: string
  /** Lowercase substrings matched against a question's chapter for suggestions. */
  chapterKeywords: string[]
  archetypes: ArchetypeOption[]
}

// Starter taxonomy for A-Level Mathematics. Extend as new chapters are authored.
export const ARCHETYPE_FAMILIES: ArchetypeFamily[] = [
  {
    label: 'Completing the Square',
    chapterKeywords: ['complet', 'square'],
    archetypes: [
      { value: 'find_constants', label: 'Find constants (express as a(x+b)^2 + c)' },
      { value: 'find_vertex', label: 'Find vertex (min/max coordinates)' },
      { value: 'solve_equation', label: 'Solve equation (equate & solve for x)' },
    ],
  },
  {
    label: 'Quadratics',
    chapterKeywords: ['quadratic'],
    archetypes: [
      { value: 'discriminant', label: 'Use the discriminant (nature of roots)' },
      { value: 'solve_roots', label: 'Solve for roots (factorise/formula)' },
      { value: 'sum_product_roots', label: 'Sum & product of roots' },
      { value: 'sketch_parabola', label: 'Sketch / interpret the parabola' },
    ],
  },
  {
    label: 'Differentiation',
    chapterKeywords: ['differen', 'derivative', 'calculus'],
    archetypes: [
      { value: 'differentiate_expression', label: 'Differentiate an expression' },
      { value: 'find_gradient', label: 'Find gradient at a point' },
      { value: 'tangent_normal', label: 'Equation of tangent / normal' },
      { value: 'stationary_points', label: 'Find / classify stationary points' },
      { value: 'rates_of_change', label: 'Connected rates of change' },
    ],
  },
  {
    label: 'Integration',
    chapterKeywords: ['integrat'],
    archetypes: [
      { value: 'indefinite_integral', label: 'Indefinite integral' },
      { value: 'definite_integral', label: 'Definite integral (evaluate)' },
      { value: 'area_under_curve', label: 'Area under a curve' },
      { value: 'integration_by_parts', label: 'Integration by parts' },
      { value: 'integration_by_substitution', label: 'Integration by substitution' },
    ],
  },
  {
    label: 'Trigonometry',
    chapterKeywords: ['trig'],
    archetypes: [
      { value: 'solve_trig_equation', label: 'Solve a trig equation' },
      { value: 'prove_identity', label: 'Prove / use a trig identity' },
      { value: 'evaluate_exact', label: 'Evaluate exact value' },
    ],
  },
  {
    label: 'General',
    chapterKeywords: [],
    archetypes: [
      { value: 'evaluate', label: 'Evaluate / compute a value' },
      { value: 'solve', label: 'Solve for an unknown' },
      { value: 'simplify', label: 'Simplify an expression' },
      { value: 'interpret', label: 'Interpret / reason about a result' },
    ],
  },
]

/** All archetype values known to the registry (used for validation/backfill). */
export const ALL_ARCHETYPE_VALUES: string[] = Array.from(
  new Set(ARCHETYPE_FAMILIES.flatMap((family) => family.archetypes.map((a) => a.value)))
)

/**
 * Suggests archetype families whose chapter keywords match the given chapter.
 * Always includes the "General" family as a fallback.
 */
export const getSuggestedFamilies = (chapter: string | null | undefined): ArchetypeFamily[] => {
  const normalized = (chapter ?? '').toLowerCase()
  const matched = ARCHETYPE_FAMILIES.filter(
    (family) =>
      family.chapterKeywords.length > 0 &&
      family.chapterKeywords.some((keyword) => normalized.includes(keyword))
  )
  const general = ARCHETYPE_FAMILIES.filter((family) => family.chapterKeywords.length === 0)
  return [...matched, ...general]
}
