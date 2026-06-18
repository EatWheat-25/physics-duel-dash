/**
 * STEP-BATTLE QUESTION FETCHER
 *
 * Fetches questions from Supabase for step-battle modes (A1-Only, A2-Only, All-Maths).
 * Uses centralized questionMapper for type-safe DB→UI conversion.
 *
 * DO NOT hardcode questions here - they all come from the database!
 */

import { StepBasedQuestion, QuestionFilters } from '@/types/questions';
import { supabase } from '@/integrations/supabase/client';
import {
  getSeenQuestionIds,
  markQuestionIdsSeen,
  pickQuestionsWithHistory,
  shuffleItems,
  type QuestionSelectionHistoryScope,
} from '@/lib/questionSelectionHistory';
import { dbRowsToQuestions } from '@/utils/questionMapper';

export interface StepQuestionSelectionOptions {
  useSelectionHistory?: boolean;
  userId?: string | null;
}

async function resolveSelectionHistoryScope(
  filters: QuestionFilters,
  options: StepQuestionSelectionOptions,
): Promise<QuestionSelectionHistoryScope | null> {
  if (!options.useSelectionHistory) return null;

  let userId = options.userId ?? null;
  if (options.userId === undefined) {
    const { data } = await supabase.auth.getSession();
    userId = data.session?.user?.id ?? null;
  }

  return {
    userId,
    source: 'step-battle',
    subject: filters.subject || 'math',
    level: filters.level ?? null,
    chapter: filters.chapter ?? null,
    difficulty: filters.difficulty ?? null,
    rankTier: filters.rankTier ?? null,
  };
}

/**
 * Get step-based math questions from database with filters
 *
 * @param filters - Query filters (subject, level, chapter, difficulty, etc.)
 * @returns Array of StepBasedQuestions, shuffled and limited
 */
export async function getStepMathQuestions(
  filters: QuestionFilters,
  options: StepQuestionSelectionOptions = {},
): Promise<StepBasedQuestion[]> {
  // Sanitized server-side fetch (steps come back without answer keys).
  const { data, error } = await (supabase.rpc as any)('get_questions_for_play_v1', {
    p_subject: filters.subject || 'math',
    p_level: filters.level ?? null,
    p_chapter: filters.chapter ?? null,
    p_difficulty: filters.difficulty ?? null,
    p_rank_tier: filters.rankTier ?? null,
  });

  if (error) {
    console.error('Error fetching questions from Supabase:', error);
    return [];
  }

  if (!data || data.length === 0) {
    console.warn('No questions found for filters:', filters);
    return [];
  }

  // Convert DB rows to StepBasedQuestions using centralized mapper
  const questions = dbRowsToQuestions(data);
  const limit = filters.limit || questions.length;
  const historyScope = await resolveSelectionHistoryScope(filters, options);

  if (!historyScope) {
    const shuffled = shuffleItems(questions);
    return shuffled.slice(0, Math.min(limit, shuffled.length));
  }

  const selected = pickQuestionsWithHistory({
    questions,
    count: limit,
    seenQuestionIds: getSeenQuestionIds(historyScope),
    allowDuplicateFallback: true,
  });

  markQuestionIdsSeen(historyScope, selected.picked.map((question) => question.id));
  return selected.picked;
}

/**
 * Convenience function for A1-Only mode
 */
export async function getA1Questions(
  count: number = 5,
  options: StepQuestionSelectionOptions = {},
): Promise<StepBasedQuestion[]> {
  return getStepMathQuestions({
    subject: 'math',
    level: 'A1',
    limit: count,
  }, options);
}

/**
 * Convenience function for A2-Only mode
 */
export async function getA2Questions(
  count: number = 5,
  options: StepQuestionSelectionOptions = {},
): Promise<StepBasedQuestion[]> {
  return getStepMathQuestions({
    subject: 'math',
    level: 'A2',
    limit: count,
  }, options);
}

/**
 * Convenience function for All-Maths mode (mix of A1 and A2)
 */
export async function getAllMathsQuestions(
  count: number = 5,
  options: StepQuestionSelectionOptions = {},
): Promise<StepBasedQuestion[]> {
  // Get mix of A1 and A2
  const a1Count = Math.ceil(count / 2);
  const a2Count = Math.floor(count / 2);

  const [a1Questions, a2Questions] = await Promise.all([
    getA1Questions(a1Count, options),
    getA2Questions(a2Count, options),
  ]);

  // Combine and shuffle
  const combined = [...a1Questions, ...a2Questions];
  return shuffleItems(combined).slice(0, count);
}