import { StepBasedQuestion, QuestionStep } from '@/types/questions';

export type RawQuestionPayload = any; // from WS / RPC

export function mapRawQuestionToStepBasedQuestion(
  raw: RawQuestionPayload
): StepBasedQuestion {
  // `raw` may be either the full WS event or just `event.question`.
  const q = (raw && (raw.question ?? raw)) as any;
  if (!q) {
    throw new Error('mapRawQuestionToStepBasedQuestion: invalid payload');
  }

  const rawSteps: any[] = Array.isArray(q.steps) ? q.steps : [];

  const steps: QuestionStep[] = rawSteps.map((s, i) => ({
    id: String(s.id ?? s.step_id ?? `${q.id}-step-${i}`),
    index: typeof s.index === 'number' ? s.index : (s.step_index ?? i),
    title: s.title ?? null,
    prompt: s.prompt ?? s.question ?? '',
    options: Array.isArray(s.options) ? s.options : [],
    correctAnswer:
      typeof s.correctAnswer === 'number'
        ? s.correctAnswer
        : typeof s.correctAnswerIndex === 'number'
          ? s.correctAnswerIndex
          : typeof s.correct_answer === 'number'
            ? s.correct_answer
            : undefined,
    timeLimitSeconds: s.timeLimitSeconds ?? s.time_limit_seconds ?? null,
    marks: s.marks ?? null,
    explanation: s.explanation ?? null,
  }));

  // IMPORTANT:
  // Backend might send final step first (for scoring: steps[0] = final).
  // For the UI we ALWAYS sort by index ASC.
  steps.sort((a, b) => a.index - b.index);

  return {
    id: String(q.id),
    title: q.title ?? '',
    subject: q.subject ?? '',
    chapter: q.chapter ?? '',
    rank_tier: q.rank_tier ?? q.rankTier ?? '',
    level: q.level ?? '',
    difficulty: q.difficulty ?? '',
    stem: q.stem ?? q.question_text ?? '',
    total_marks: q.total_marks ?? q.base_marks ?? 0,
    topic_tags: q.topic_tags ?? [],
    steps,
    imageUrl: q.image_url ?? q.imageUrl,
  };
}

import { QuestionDBRow, QuestionInput } from '@/types/questions';

/**
 * Batch convert multiple DB rows
 */
export function dbRowsToQuestions(rows: QuestionDBRow[]): StepBasedQuestion[] {
  return rows.map(row => mapRawQuestionToStepBasedQuestion(row));
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
    rank_tier: question.rank_tier || null,
    question_text: question.stem,
    total_marks: question.total_marks,
    topic_tags: question.topic_tags || [],
    steps: question.steps as any, // Cast to any for JSON compatibility
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

  if (!question.stem?.trim()) {
    errors.push('Question stem is required');
  }

  if (!question.steps || question.steps.length === 0) {
    errors.push('At least one step is required');
  } else {
    question.steps.forEach((step, index) => {
      if (!step.prompt?.trim()) {
        errors.push(`Step ${index + 1}: prompt is required`);
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

      if (step.correctAnswer === undefined || step.correctAnswer < 0 || step.correctAnswer > 3) {
        errors.push(`Step ${index + 1}: correctAnswer must be 0, 1, 2, or 3`);
      }

      if (!step.marks || step.marks <= 0) {
        errors.push(`Step ${index + 1}: marks must be a positive number`);
      }
    });
  }

  // Calculate total marks
  if (question.steps && question.steps.length > 0) {
    const calculatedMarks = question.steps.reduce((sum, s) => sum + (s.marks || 0), 0);
    if (question.total_marks !== calculatedMarks) {
      errors.push(`Total marks (${question.total_marks}) doesn't match sum of step marks (${calculatedMarks})`);
    }
  }

  return errors;
}
