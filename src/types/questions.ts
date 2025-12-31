/**
 * CANONICAL QUESTION TYPES - SINGLE SOURCE OF TRUTH
 *
 * This is the ONLY place where question types are defined.
 * All other code (DB, RPC, mapper, UI) must use these types.
 *
 * DO NOT create duplicate types elsewhere!
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export type QuestionSubject = 'math' | 'physics' | 'chemistry';
export type QuestionLevel = 'A1' | 'A2';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Unbeatable' | 'Pocket Calculator';

/**
 * A single step in a multi-step question.
 * Steps are ordered by `index` (0, 1, 2, ..., n).
 * The final answer step has the highest index.
 */
export interface QuestionStep {
  id: string;
  index: number;                    // 0-based display order
  type: 'mcq' | 'true_false';        // Multiple choice question or True/False
  title: string;                     // Step heading (e.g., "Find the derivative")
  prompt: string;                    // The actual question text for this step
  options: string[];                 // MCQ: 2–6 options, True/False: exactly 2 options
  correctAnswer: number;             // Index of correct option (0 <= correctAnswer < options.length)
  timeLimitSeconds: number | null;   // Time limit for this step (null = no limit)
  marks: number;                     // Points awarded for this step
  explanation: string | null;        // Explanation shown after answering
}

/**
 * Complete question structure.
 * Can be single-step (steps.length === 1) or multi-step (steps.length > 1).
 */
export interface StepBasedQuestion {
  id: string;
  title: string;                     // Question title
  subject: QuestionSubject;
  chapter: string;                   // e.g., "Integration", "Kinematics"
  level: QuestionLevel;
  difficulty: QuestionDifficulty;
  rankTier?: RankTier;
  stem: string;                      // Main question context/setup
  totalMarks: number;                // Sum of all step marks
  topicTags: string[];               // e.g., ["integration", "by-parts"]
  steps: QuestionStep[];             // ALWAYS sorted by index (0..n)
  imageUrl?: string;                 // Optional question image
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

/**
 * Raw database row from questions table.
 * Uses snake_case to match Supabase conventions.
 */
export interface QuestionDBRow {
  id: string;
  title: string;
  subject: string;
  chapter: string;
  level: string;
  difficulty: string;
  rank_tier: string | null;
  question_text: string;             // Maps to `stem`
  total_marks: number;
  topic_tags: string[];
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Raw database row from question_steps table.
 * Uses snake_case to match Supabase conventions.
 */
export interface QuestionStepDBRow {
  id: string;
  question_id: string;
  step_index: number;                // 0-based order
  step_type: string;
  title: string;
  prompt: string;
  options: string[];                 // JSONB array
  correct_answer: { correctIndex: number };  // JSONB object
  time_limit_seconds: number | null;
  marks: number;
  explanation: string | null;
  created_at?: string;
}

// ============================================================================
// INPUT TYPES (for creating/updating)
// ============================================================================

export type QuestionInput = Omit<StepBasedQuestion, 'id'> & {
  id?: string;  // Optional for new questions
};

export type QuestionStepInput = Omit<QuestionStep, 'id'> & {
  id?: string;  // Optional for new steps
};

/**
 * Filters for querying questions from database.
 */
export interface QuestionFilters {
  subject?: QuestionSubject;
  chapter?: string;
  level?: QuestionLevel;
  difficulty?: QuestionDifficulty;
  rankTier?: RankTier;
  limit?: number;
}

// ============================================================================
// WEBSOCKET MESSAGE TYPES
// ============================================================================

/**
 * Client sends this to submit an answer.
 * Uses snake_case to match server expectations.
 */
export interface AnswerSubmitPayload {
  type: 'answer_submit';
  question_id: string;
  step_id: string;
  answer: number;  // 0-5 (A-F) depending on option count
}

/**
 * Server sends this when answer is validated and scored.
 */
export interface AnswerResultPayload {
  type: 'answer_result';
  question_id: string;
  step_id: string;
  is_correct: boolean;
  correct_answer: number;
  marks_earned: number;
  explanation: string | null;
}

/**
 * Server sends this when client message is invalid.
 */
export interface ValidationErrorPayload {
  type: 'validation_error';
  message: string;
  details: Array<{
    code: string;
    path: string[];
    message: string;
  }>;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate that a QuestionStep has correct structure.
 */
export function validateQuestionStep(step: QuestionStep, stepIndex: number): string[] {
  const errors: string[] = [];

  if (step.index !== stepIndex) {
    errors.push(`Step ${stepIndex}: index mismatch (expected ${stepIndex}, got ${step.index})`);
  }

  if (step.type !== 'mcq' && step.type !== 'true_false') {
    errors.push(`Step ${stepIndex}: type must be 'mcq' or 'true_false', got '${step.type}'`);
  }

  if (!step.title?.trim()) {
    errors.push(`Step ${stepIndex}: title is required`);
  }

  if (!step.prompt?.trim()) {
    errors.push(`Step ${stepIndex}: prompt is required`);
  }

  if (!Array.isArray(step.options)) {
    errors.push(`Step ${stepIndex}: options must be an array`);
  } else {
    const optionCount = step.options.length;
    const optionCountOk = step.type === 'true_false'
      ? optionCount === 2
      : optionCount >= 2 && optionCount <= 6;
    if (!optionCountOk) {
      errors.push(`Step ${stepIndex}: invalid option count for type "${step.type}" (got ${optionCount})`);
    }

    step.options.forEach((opt, i) => {
      if (typeof opt !== 'string' || !opt.trim()) {
        errors.push(`Step ${stepIndex}, option ${i}: must be non-empty string`);
      }
    });

    if (!Number.isInteger(step.correctAnswer)) {
      errors.push(`Step ${stepIndex}: correctAnswer must be an integer`);
    } else if (step.correctAnswer < 0 || step.correctAnswer >= optionCount) {
      errors.push(`Step ${stepIndex}: correctAnswer out of range (0-${Math.max(0, optionCount - 1)})`);
    }
  }

  if (step.marks <= 0) {
    errors.push(`Step ${stepIndex}: marks must be positive`);
  }

  return errors;
}

/**
 * Validate that a StepBasedQuestion has correct structure.
 */
export function validateQuestion(question: StepBasedQuestion): string[] {
  const errors: string[] = [];

  if (!question.id?.trim()) {
    errors.push('Question id is required');
  }

  if (!question.title?.trim()) {
    errors.push('Question title is required');
  }

  if (!['math', 'physics', 'chemistry'].includes(question.subject)) {
    errors.push('Question subject must be math, physics, or chemistry');
  }

  if (!question.chapter?.trim()) {
    errors.push('Question chapter is required');
  }

  if (!['A1', 'A2'].includes(question.level)) {
    errors.push('Question level must be A1 or A2');
  }

  if (!['easy', 'medium', 'hard'].includes(question.difficulty)) {
    errors.push('Question difficulty must be easy, medium, or hard');
  }

  if (!question.stem?.trim()) {
    errors.push('Question stem is required');
  }

  if (!Array.isArray(question.steps) || question.steps.length === 0) {
    errors.push('Question must have at least one step');
  } else {
    // Validate each step
    question.steps.forEach((step, i) => {
      const stepErrors = validateQuestionStep(step, i);
      errors.push(...stepErrors);
    });

    // Validate total marks
    const calculatedMarks = question.steps.reduce((sum, s) => sum + s.marks, 0);
    if (question.totalMarks !== calculatedMarks) {
      errors.push(`Total marks mismatch: declared ${question.totalMarks}, calculated ${calculatedMarks}`);
    }
  }

  return errors;
}
