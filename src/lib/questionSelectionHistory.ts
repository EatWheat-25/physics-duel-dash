import type { QuestionDifficulty, QuestionLevel, QuestionSubject, RankTier } from '@/types/questions'

const STORAGE_PREFIX = 'battle-nerds:question-selection-history'
const STORAGE_VERSION = 1
const MAX_SEEN_QUESTION_IDS = 5000

interface QuestionSelectionHistoryRecord {
  version: number
  seenQuestionIds: string[]
  updatedAt: string
}

interface QuestionWithId {
  id: string
}

export interface QuestionSelectionHistoryScope {
  userId?: string | null
  source: string
  subject?: QuestionSubject | string | null
  level?: QuestionLevel | string | null
  chapter?: string | null
  difficulty?: QuestionDifficulty | string | null
  rankTier?: RankTier | string | null
}

export interface PickQuestionsWithHistoryOptions<T extends QuestionWithId> {
  questions: readonly T[]
  count: number
  seenQuestionIds?: ReadonlySet<string>
  allowDuplicateFallback?: boolean
}

export interface PickQuestionsWithHistoryResult<T extends QuestionWithId> {
  picked: T[]
  freshAvailableCount: number
  reusedSeenQuestionCount: number
  duplicateQuestionCount: number
}

const normalizeScopePart = (value?: string | null) => {
  if (typeof value !== 'string') return '_'
  const trimmed = value.trim()
  return encodeURIComponent(trimmed.length > 0 ? trimmed.toLowerCase() : '_')
}

const getStorageKey = (scope: QuestionSelectionHistoryScope) =>
  [
    STORAGE_PREFIX,
    normalizeScopePart(scope.userId ?? 'guest'),
    normalizeScopePart(scope.source),
    normalizeScopePart(scope.subject ?? null),
    normalizeScopePart(scope.level ?? null),
    normalizeScopePart(scope.chapter ?? null),
    normalizeScopePart(scope.difficulty ?? null),
    normalizeScopePart(scope.rankTier ?? null),
  ].join(':')

const readRecord = (scope: QuestionSelectionHistoryScope): QuestionSelectionHistoryRecord => {
  if (typeof window === 'undefined') {
    return {
      version: STORAGE_VERSION,
      seenQuestionIds: [],
      updatedAt: new Date(0).toISOString(),
    }
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(scope))
    if (!raw) {
      return {
        version: STORAGE_VERSION,
        seenQuestionIds: [],
        updatedAt: new Date(0).toISOString(),
      }
    }

    const parsed = JSON.parse(raw) as Partial<QuestionSelectionHistoryRecord>
    const seenQuestionIds = Array.isArray(parsed.seenQuestionIds)
      ? parsed.seenQuestionIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : []

    return {
      version: typeof parsed.version === 'number' ? parsed.version : STORAGE_VERSION,
      seenQuestionIds,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    }
  } catch (error) {
    console.warn('[questionSelectionHistory] Failed to read history:', error)
    return {
      version: STORAGE_VERSION,
      seenQuestionIds: [],
      updatedAt: new Date(0).toISOString(),
    }
  }
}

const writeRecord = (scope: QuestionSelectionHistoryScope, seenQuestionIds: string[]) => {
  if (typeof window === 'undefined') return

  const deduped: string[] = []
  const seen = new Set<string>()

  for (const questionId of seenQuestionIds) {
    if (!questionId || seen.has(questionId)) continue
    seen.add(questionId)
    deduped.push(questionId)
  }

  const payload: QuestionSelectionHistoryRecord = {
    version: STORAGE_VERSION,
    seenQuestionIds: deduped.slice(-MAX_SEEN_QUESTION_IDS),
    updatedAt: new Date().toISOString(),
  }

  try {
    window.localStorage.setItem(getStorageKey(scope), JSON.stringify(payload))
  } catch (error) {
    console.warn('[questionSelectionHistory] Failed to write history:', error)
  }
}

const dedupeQuestions = <T extends QuestionWithId>(questions: readonly T[]) => {
  const uniqueQuestions: T[] = []
  const seenIds = new Set<string>()

  for (const question of questions) {
    const questionId = String(question?.id ?? '')
    if (!questionId || seenIds.has(questionId)) continue
    seenIds.add(questionId)
    uniqueQuestions.push(question)
  }

  return uniqueQuestions
}

export const shuffleItems = <T>(items: readonly T[]): T[] => {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export const getSeenQuestionIds = (scope: QuestionSelectionHistoryScope): Set<string> => {
  return new Set(readRecord(scope).seenQuestionIds)
}

export const markQuestionIdsSeen = (scope: QuestionSelectionHistoryScope, questionIds: string[]) => {
  if (questionIds.length === 0) return

  const existing = readRecord(scope).seenQuestionIds
  writeRecord(scope, [...existing, ...questionIds])
}

export const pickQuestionsWithHistory = <T extends QuestionWithId>({
  questions,
  count,
  seenQuestionIds = new Set<string>(),
  allowDuplicateFallback = false,
}: PickQuestionsWithHistoryOptions<T>): PickQuestionsWithHistoryResult<T> => {
  const uniqueQuestions = dedupeQuestions(questions)
  const unseenQuestions = shuffleItems(uniqueQuestions.filter((question) => !seenQuestionIds.has(question.id)))
  const seenQuestions = shuffleItems(uniqueQuestions.filter((question) => seenQuestionIds.has(question.id)))
  const picked = unseenQuestions.slice(0, Math.max(0, count))

  let reusedSeenQuestionCount = 0
  if (picked.length < count) {
    const seenFallback = seenQuestions.slice(0, count - picked.length)
    reusedSeenQuestionCount = seenFallback.length
    picked.push(...seenFallback)
  }

  let duplicateQuestionCount = 0
  if (allowDuplicateFallback && picked.length < count && uniqueQuestions.length > 0) {
    const duplicatePool = shuffleItems(uniqueQuestions)
    let duplicateCursor = 0

    while (picked.length < count && duplicatePool.length > 0) {
      picked.push(duplicatePool[duplicateCursor % duplicatePool.length])
      duplicateCursor += 1
      duplicateQuestionCount += 1
    }
  }

  return {
    picked,
    freshAvailableCount: unseenQuestions.length,
    reusedSeenQuestionCount,
    duplicateQuestionCount,
  }
}
