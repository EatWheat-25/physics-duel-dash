export type RankBasedDifficulty = 'easy' | 'medium' | 'hard'

// Keep these cutoffs aligned with the point bands in src/types/ranking.ts.
const EASY_MAX_POINTS = 248
const MEDIUM_MAX_POINTS = 799
const MIN_RANK_POINTS = 0
const MAX_RANK_POINTS = 2000

const clampRankPoints = (rankPoints: number) => {
  if (!Number.isFinite(rankPoints)) return MIN_RANK_POINTS
  return Math.max(MIN_RANK_POINTS, Math.min(MAX_RANK_POINTS, Math.floor(rankPoints)))
}

export const getDifficultyForRankPoints = (rankPoints: number): RankBasedDifficulty => {
  const safePoints = clampRankPoints(rankPoints)
  if (safePoints <= EASY_MAX_POINTS) return 'easy'
  if (safePoints <= MEDIUM_MAX_POINTS) return 'medium'
  return 'hard'
}

export const getAverageRankPoints = (rankPoints: number[]): number => {
  const safePoints = rankPoints
    .filter((value) => Number.isFinite(value))
    .map((value) => clampRankPoints(value))

  if (safePoints.length === 0) return MIN_RANK_POINTS

  const total = safePoints.reduce((sum, value) => sum + value, 0)
  return Math.round(total / safePoints.length)
}

export const getDifficultyForAverageRankPoints = (rankPoints: number[]): RankBasedDifficulty =>
  getDifficultyForRankPoints(getAverageRankPoints(rankPoints))

export const getDifficultyFallbackOrder = (
  difficulty: RankBasedDifficulty
): RankBasedDifficulty[] => {
  switch (difficulty) {
    case 'easy':
      return ['easy', 'medium', 'hard']
    case 'medium':
      return ['medium', 'easy', 'hard']
    case 'hard':
      return ['hard', 'medium', 'easy']
    default:
      return ['easy', 'medium', 'hard']
  }
}

export const formatDifficultyLabel = (difficulty: RankBasedDifficulty) =>
  `${difficulty.charAt(0).toUpperCase()}${difficulty.slice(1)}`
