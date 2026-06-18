// System A: the "Tetris Bag" deck builder.
//
// Groups the available pool by archetype, then round-robins across archetype
// groups so consecutive picks are mechanically different whenever two or more
// archetypes still have stock. Within each group it prefers unseen questions and
// (optionally) a difficulty fallback order, preserving the existing
// exclusion-memory behaviour.

import { getArchetype } from './archetypes'
import { shuffleItems } from './questionSelectionHistory'
import type { RankBasedDifficulty } from '../../shared/rankDifficulty'

export interface ArchetypeBagQuestion {
  id: string
  difficulty?: string
  topicTags?: string[]
}

export interface BuildArchetypeBagOptions<T extends ArchetypeBagQuestion> {
  questions: readonly T[]
  count: number
  seenQuestionIds?: ReadonlySet<string>
  /** Difficulty preference within each archetype group (most preferred first). */
  difficultyFallbackOrder?: RankBasedDifficulty[]
  /** When the unique pool is exhausted, repeat questions to reach `count`. */
  allowDuplicateFallback?: boolean
}

export interface BuildArchetypeBagResult<T> {
  picked: T[]
  /** Archetype tag of each picked question, in order (for diagnostics/tests). */
  archetypeSequence: string[]
  distinctArchetypeCount: number
  freshAvailableCount: number
  reusedSeenQuestionCount: number
  duplicateQuestionCount: number
  usedFallbackDifficulty: boolean
}

const dedupeById = <T extends ArchetypeBagQuestion>(questions: readonly T[]): T[] => {
  const out: T[] = []
  const seen = new Set<string>()
  for (const question of questions) {
    const id = String(question?.id ?? '')
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(question)
  }
  return out
}

// Orders a group's questions: unseen before seen, then by difficulty preference,
// with random tie-breaks (shuffle first, then a stable sort by difficulty rank).
const orderGroup = <T extends ArchetypeBagQuestion>(
  items: T[],
  seenQuestionIds: ReadonlySet<string>,
  difficultyRank: (difficulty: string | undefined) => number
): T[] => {
  const byDifficulty = (list: T[]) =>
    shuffleItems(list).sort((a, b) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty))

  const unseen = byDifficulty(items.filter((q) => !seenQuestionIds.has(q.id)))
  const seen = byDifficulty(items.filter((q) => seenQuestionIds.has(q.id)))
  return [...unseen, ...seen]
}

export const buildArchetypeBag = <T extends ArchetypeBagQuestion>({
  questions,
  count,
  seenQuestionIds = new Set<string>(),
  difficultyFallbackOrder,
  allowDuplicateFallback = false,
}: BuildArchetypeBagOptions<T>): BuildArchetypeBagResult<T> => {
  const unique = dedupeById(questions)
  const target = Math.max(0, count)

  const difficultyRank = (difficulty: string | undefined): number => {
    if (!difficultyFallbackOrder || difficultyFallbackOrder.length === 0) return 0
    const idx = difficultyFallbackOrder.indexOf(difficulty as RankBasedDifficulty)
    return idx === -1 ? difficultyFallbackOrder.length : idx
  }

  // Group by archetype.
  const groups = new Map<string, T[]>()
  for (const question of unique) {
    const archetype = getArchetype(question.topicTags)
    const bucket = groups.get(archetype)
    if (bucket) bucket.push(question)
    else groups.set(archetype, [question])
  }

  // Stable, shuffled group order so consecutive picks differ in archetype.
  const queues = shuffleItems([...groups.entries()]).map(([archetype, items]) => ({
    archetype,
    items: orderGroup(items, seenQuestionIds, difficultyRank),
    cursor: 0,
  }))

  const picked: T[] = []
  const pickedIds = new Set<string>()
  const archetypeSequence: string[] = []
  let reusedSeenQuestionCount = 0
  let usedFallbackDifficulty = false
  const preferredDifficulty = difficultyFallbackOrder?.[0]

  // Round-robin across groups (a "bag"), refilling until target reached.
  let progressed = true
  while (picked.length < target && progressed) {
    progressed = false
    for (const queue of queues) {
      if (picked.length >= target) break
      while (queue.cursor < queue.items.length) {
        const candidate = queue.items[queue.cursor]
        queue.cursor += 1
        if (pickedIds.has(candidate.id)) continue

        picked.push(candidate)
        pickedIds.add(candidate.id)
        archetypeSequence.push(queue.archetype)
        if (seenQuestionIds.has(candidate.id)) reusedSeenQuestionCount += 1
        if (preferredDifficulty && candidate.difficulty && candidate.difficulty !== preferredDifficulty) {
          usedFallbackDifficulty = true
        }
        progressed = true
        break
      }
    }
  }

  // Duplicate fallback: cycle the unique pool, preferring a different archetype
  // than the previously picked one to keep variety even when repeating.
  let duplicateQuestionCount = 0
  if (allowDuplicateFallback && picked.length < target && unique.length > 0) {
    const pool = shuffleItems(unique)
    let guard = 0
    const maxGuard = target * Math.max(1, unique.length) + unique.length
    while (picked.length < target && guard < maxGuard) {
      guard += 1
      const lastArchetype = archetypeSequence[archetypeSequence.length - 1]
      const candidate =
        pool.find((q) => getArchetype(q.topicTags) !== lastArchetype) ?? pool[guard % pool.length]
      picked.push(candidate)
      archetypeSequence.push(getArchetype(candidate.topicTags))
      duplicateQuestionCount += 1
    }
  }

  return {
    picked,
    archetypeSequence,
    distinctArchetypeCount: groups.size,
    freshAvailableCount: unique.filter((q) => !seenQuestionIds.has(q.id)).length,
    reusedSeenQuestionCount,
    duplicateQuestionCount,
    usedFallbackDifficulty,
  }
}
