import {
  normalizeCampaignTopicValue,
  type CampaignLevel,
  type CampaignTopicKind,
} from '@/lib/campaignMode'
import type { QuestionSubject } from '@/types/questions'

const STORAGE_PREFIX = 'battle-nerds:campaign-question-history'
const STORAGE_VERSION = 1
const MAX_SEEN_QUESTION_IDS = 5000

interface CampaignQuestionHistoryRecord {
  version: number
  seenQuestionIds: string[]
  updatedAt: string
}

export interface CampaignQuestionHistoryScope {
  userId: string
  subject: QuestionSubject
  level: CampaignLevel
  topicKind: CampaignTopicKind
  topicValue: string
}

const getStorageKey = (scope: CampaignQuestionHistoryScope) =>
  [
    STORAGE_PREFIX,
    scope.userId,
    scope.subject,
    scope.level,
    scope.topicKind,
    normalizeCampaignTopicValue(scope.topicValue),
  ].join(':')

const readRecord = (scope: CampaignQuestionHistoryScope): CampaignQuestionHistoryRecord => {
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

    const parsed = JSON.parse(raw) as Partial<CampaignQuestionHistoryRecord>
    const seenQuestionIds = Array.isArray(parsed.seenQuestionIds)
      ? parsed.seenQuestionIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : []

    return {
      version: typeof parsed.version === 'number' ? parsed.version : STORAGE_VERSION,
      seenQuestionIds,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    }
  } catch (error) {
    console.warn('[campaignQuestionHistory] Failed to read history:', error)
    return {
      version: STORAGE_VERSION,
      seenQuestionIds: [],
      updatedAt: new Date(0).toISOString(),
    }
  }
}

const writeRecord = (scope: CampaignQuestionHistoryScope, seenQuestionIds: string[]) => {
  if (typeof window === 'undefined') return

  const deduped: string[] = []
  const seen = new Set<string>()

  for (const questionId of seenQuestionIds) {
    if (!questionId || seen.has(questionId)) continue
    seen.add(questionId)
    deduped.push(questionId)
  }

  const payload: CampaignQuestionHistoryRecord = {
    version: STORAGE_VERSION,
    seenQuestionIds: deduped.slice(-MAX_SEEN_QUESTION_IDS),
    updatedAt: new Date().toISOString(),
  }

  try {
    window.localStorage.setItem(getStorageKey(scope), JSON.stringify(payload))
  } catch (error) {
    console.warn('[campaignQuestionHistory] Failed to write history:', error)
  }
}

export const getSeenCampaignQuestionIds = (scope: CampaignQuestionHistoryScope): Set<string> => {
  return new Set(readRecord(scope).seenQuestionIds)
}

export const markCampaignQuestionIdsSeen = (
  scope: CampaignQuestionHistoryScope,
  questionIds: string[],
) => {
  if (questionIds.length === 0) return

  const existing = readRecord(scope).seenQuestionIds
  writeRecord(scope, [...existing, ...questionIds])
}
