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
import { dbRowsToQuestions } from '@/utils/questionMapper';

/**
 * Get step-based math questions from database with filters
 *
 * @param filters - Query filters (subject, level, chapter, difficulty, etc.)
 * @returns Array of StepBasedQuestions, shuffled and limited
 */
export async function getStepMathQuestions(filters: QuestionFilters): Promise<StepBasedQuestion[]> {
  let query = supabase.from('questions').select('*');

  // Always filter by math (this file is for math questions)
  query = query.eq('subject', filters.subject || 'math');

  // Apply optional filters
  if (filters.level) {
    query = query.eq('level', filters.level);
  }

  if (filters.chapter) {
    query = query.eq('chapter', filters.chapter);
  }

  if (filters.difficulty) {
    query = query.eq('difficulty', filters.difficulty);
  }

  if (filters.rankTier) {
    query = query.eq('rank_tier', filters.rankTier);
  }

  // Fetch from database
  const { data, error } = await query;

  if (error) {
    console.error('Error fetching questions from Supabase:', error);
    return [];
  }

  if (!data || data.length === 0) {
    console.warn('No questions found for filters:', filters);
    return [];
  }

  // Convert DB rows to StepBasedQuestions using centralized mapper
  const questions = dbRowsToQuestions(data as any);

  // Shuffle and limit
  const shuffled = [...questions].sort(() => 0.5 - Math.random());
  const limit = filters.limit || questions.length;

  return shuffled.slice(0, Math.min(limit, shuffled.length));
}

/**
 * Convenience function for A1-Only mode
 */
export async function getA1Questions(count: number = 5): Promise<StepBasedQuestion[]> {
  return getStepMathQuestions({
    subject: 'math',
    level: 'A1',
    limit: count,
  });
}

/**
 * Convenience function for A2-Only mode
 */
export async function getA2Questions(count: number = 5): Promise<StepBasedQuestion[]> {
  return getStepMathQuestions({
    subject: 'math',
    level: 'A2',
    limit: count,
  });
}

/**
 * Convenience function for All-Maths mode (mix of A1 and A2)
 */
export async function getAllMathsQuestions(count: number = 5): Promise<StepBasedQuestion[]> {
  // Get mix of A1 and A2
  const a1Count = Math.ceil(count / 2);
  const a2Count = Math.floor(count / 2);

  const [a1Questions, a2Questions] = await Promise.all([
    getA1Questions(a1Count),
    getA2Questions(a2Count),
  ]);

  // Combine and shuffle
  const combined = [...a1Questions, ...a2Questions];
  return combined.sort(() => 0.5 - Math.random()).slice(0, count);
}