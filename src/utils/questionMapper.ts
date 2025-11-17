/**
 * CENTRALIZED QUESTION MAPPER
 *
 * This module provides type-safe mapping between database rows and
 * application question types. Use these functions EVERYWHERE to ensure
 * consistent data transformation.
 *
 * Used by:
 * - getStepMathQuestions (step-battle fetcher)
 * - OnlineBattle (WebSocket handler)
 * - Admin UI (question list/edit)
 * - Any other component that reads questions from DB
 */

import {
  StepBasedQuestion,
  QuestionDBRow,
  QuestionInput,
  QuestionStep,
} from '@/types/questions';

/**
 * Convert database row to StepBasedQuestion
 * Handles all field name conversions and type casting
 */
export function dbRowToQuestion(row: QuestionDBRow): StepBasedQuestion {
  // Parse steps from JSONB
  let steps: QuestionStep[] = [];
  try {
    if (Array.isArray(row.steps)) {
      steps = row.steps as QuestionStep[];
    } else if (row.steps && typeof row.steps === 'object') {
      // Handle case where steps might be wrapped or malformed
      steps = Object.values(row.steps);
    }
  } catch (error) {
    console.error('Error parsing steps for question', row.id, error);
    steps = [];
  }

  return {
    id: row.id,
    title: row.title,
    subject: row.subject as any,
    chapter: row.chapter,
    level: row.level as any,
    difficulty: row.difficulty as any,
    rankTier: row.rank_tier as any,
    totalMarks: row.total_marks,
    questionText: row.question_text,
    topicTags: row.topic_tags || [],
    steps: steps,
    imageUrl: row.image_url || undefined,
  };
}

/**
 * Convert StepBasedQuestion to database row shape
 * For inserts/updates
 */
export function questionToDBRow(question: QuestionInput): Omit<QuestionDBRow, 'created_at' | 'updated_at'> {
  return {
    id: question.id || crypto.randomUUID(),
    title: question.title,
    subject: question.subject,
    chapter: question.chapter,
    level: question.level,
    difficulty: question.difficulty,
    rank_tier: question.rankTier || null,
    question_text: question.questionText,
    total_marks: question.totalMarks,
    topic_tags: question.topicTags || [],
    steps: question.steps as unknown,
    image_url: question.imageUrl || null,
  };
}

/**
 * Validate question structure
 * Returns array of error messages (empty if valid)
 */
export function validateQuestion(question: QuestionInput): string[] {
  const errors: string[] = [];

  if (!question.title?.trim()) {
    errors.push('Title is required');
  }

  if (!question.subject) {
    errors.push('Subject is required');
  }

  if (!question.chapter?.trim()) {
    errors.push('Chapter is required');
  }

  if (!question.level) {
    errors.push('Level (A1/A2) is required');
  }

  if (!question.difficulty) {
    errors.push('Difficulty is required');
  }

  if (!question.questionText?.trim()) {
    errors.push('Question text is required');
  }

  if (!question.steps || question.steps.length === 0) {
    errors.push('At least one step is required');
  } else {
    question.steps.forEach((step, index) => {
      if (!step.question?.trim()) {
        errors.push(`Step ${index + 1}: question text is required`);
      }

      if (!step.options || step.options.length !== 4) {
        errors.push(`Step ${index + 1}: exactly 4 options required (found ${step.options?.length || 0})`);
      } else {
        step.options.forEach((opt, optIndex) => {
          if (!opt?.trim()) {
            errors.push(`Step ${index + 1}: option ${optIndex + 1} is empty`);
          }
        });
      }

      if (step.correctAnswer < 0 || step.correctAnswer > 3) {
        errors.push(`Step ${index + 1}: correctAnswer must be 0, 1, 2, or 3`);
      }

      if (!step.marks || step.marks <= 0) {
        errors.push(`Step ${index + 1}: marks must be a positive number`);
      }

      if (!step.explanation?.trim()) {
        errors.push(`Step ${index + 1}: explanation is required`);
      }
    });
  }

  // Calculate total marks
  if (question.steps && question.steps.length > 0) {
    const calculatedMarks = question.steps.reduce((sum, s) => sum + (s.marks || 0), 0);
    if (question.totalMarks !== calculatedMarks) {
      errors.push(`Total marks (${question.totalMarks}) doesn't match sum of step marks (${calculatedMarks})`);
    }
  }

  return errors;
}

/**
 * Batch convert multiple DB rows
 */
export function dbRowsToQuestions(rows: QuestionDBRow[]): StepBasedQuestion[] {
  return rows.map(dbRowToQuestion).filter(q => q.steps && q.steps.length > 0);
}
