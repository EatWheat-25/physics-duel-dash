/**
 * QUESTION STEP HELPERS
 *
 * Utilities for working with step-based questions
 */

import { StepBasedQuestion, QuestionStep } from '@/types/questions';

/**
 * Get the primary step to display (first step)
 * In step-based questions, we typically show one step at a time
 */
export function getPrimaryDisplayStep(question: StepBasedQuestion): QuestionStep | null {
  if (!question.steps || question.steps.length === 0) {
    return null;
  }
  return question.steps[0];
}

/**
 * Get all steps for multi-step navigation
 */
export function getAllSteps(question: StepBasedQuestion): QuestionStep[] {
  return question.steps || [];
}

/**
 * Get step by index with bounds checking
 */
export function getStepByIndex(question: StepBasedQuestion, index: number): QuestionStep | null {
  const steps = getAllSteps(question);
  if (index < 0 || index >= steps.length) {
    return null;
  }
  return steps[index];
}
