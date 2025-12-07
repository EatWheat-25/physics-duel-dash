/**
 * QUESTION MAPPER - ZERO AMBIGUITY
 *
 * This mapper converts raw data from RPC/WebSocket into StepBasedQuestion.
 * It handles ALL field name variations but always outputs clean camelCase.
 *
 * Rules:
 * 1. Always sort steps by index ascending (0, 1, 2, ...)
 * 2. Always validate structure
 * 3. No guessing - use explicit fallbacks
 */

import { StepBasedQuestion, QuestionStep } from '@/types/questions';

/**
 * Maps raw RPC/WebSocket payload to StepBasedQuestion.
 *
 * Accepts:
 * - Direct question object: { id, title, steps, ... }
 * - Wrapped format: { question: { id, title, steps, ... } }
 * - Mixed snake_case/camelCase fields
 *
 * Returns: Clean StepBasedQuestion with steps sorted by index ASC.
 */
export function mapRawToQuestion(raw: any): StepBasedQuestion {
  // Handle wrapped format
  const q = raw?.question ?? raw;

  if (!q || typeof q !== 'object') {
    throw new Error('[questionMapper] Invalid payload: expected object with question data');
  }

  // Extract and validate ID
  const id = String(q.id || '');
  if (!id) {
    throw new Error('[questionMapper] Missing question id');
  }

  // Map steps
  const rawSteps = Array.isArray(q.steps) ? q.steps : [];
  if (rawSteps.length === 0) {
    throw new Error(`[questionMapper] Question ${id} has no steps`);
  }

  /**
   * Normalize options array - handles TF vs MCQ differently
   */
  const normalizeOptions = (step: any): string[] => {
    let opts: string[] = [];
    
    if (Array.isArray(step.options) && step.options.length > 0) {
      const firstOpt = step.options[0];
      // Check if first element is an object with 'text' property
      if (typeof firstOpt === 'object' && firstOpt !== null && !Array.isArray(firstOpt) && ('text' in firstOpt || 'answer_text' in firstOpt)) {
        // New format: [{ answer_index, text }] or [{ answer_index, answer_text }]
        opts = step.options
          .map((opt: any) => {
            if (typeof opt === 'object' && opt !== null) {
              return String(opt.text || opt.answer_text || '');
            }
            return String(opt || '');
          })
          .filter((opt: string) => opt.trim() !== ''); // Remove empty strings
      } else {
        // Old format: [string, string, ...]
        opts = step.options
          .map((opt: any) => String(opt || ''))
          .filter((opt: string) => opt.trim() !== ''); // Remove empty strings
      }
    }
    
    // ✅ If TF type, NEVER pad
    if (step.type === 'true_false') {
      return opts.slice(0, 2);
    }
    
    // ✅ If it *looks* TF (exactly 2 options that are "True"/"False"), don't pad
    if (opts.length === 2) {
      const norm = opts.map(o => String(o).trim().toLowerCase()).sort();
      if (norm[0] === 'false' && norm[1] === 'true') {
        return opts;
      }
    }
    
    // 🟦 Otherwise MCQ rules: pad to 4
    const padded = [...opts];
    while (padded.length < 4) {
      padded.push('');
    }
    return padded.slice(0, 4);
  };

  const steps: QuestionStep[] = rawSteps.map((s: any, fallbackIndex: number) => {
    // Map step index: prefer step_index, then index, then fallbackIndex
    const stepIndex = typeof s.step_index === 'number' 
      ? s.step_index 
      : (typeof s.index === 'number' ? s.index : fallbackIndex);
    
    // Normalize options (handles TF vs MCQ)
    const optionsArray = normalizeOptions(s);
    
    // Map all possible field name variations
    // Note: For TF questions, normalizeOptions returns exactly 2 options (no padding)
    // We pad to 4 only for type compatibility, but the actual meaningful options are only 2
    // The UI will filter out empty options to get the real count
    const step: QuestionStep = {
      id: String(s.id || s.step_id || `${id}-step-${fallbackIndex}`),
      index: stepIndex,
      type: 'mcq' as const,
      title: String(s.title || ''),
      prompt: String(s.prompt || s.question || ''),
      // Pad to 4 only for type safety - UI will filter empty strings
      options: (optionsArray.length === 2 
        ? [...optionsArray, '', ''] as [string, string, string, string]
        : optionsArray as [string, string, string, string]),
      correctAnswer: extractCorrectAnswer(s),
      timeLimitSeconds: s.timeLimitSeconds ?? s.time_limit_seconds ?? null,
      marks: Number(s.marks || 1),
      explanation: s.explanation || null,
    };

    return step;
  });

  // CRITICAL: Sort steps by index ascending
  steps.sort((a, b) => a.index - b.index);

  // Validate step indices are contiguous
  steps.forEach((step, i) => {
    if (step.index !== i) {
      console.warn(`[questionMapper] Step index mismatch at position ${i}: expected ${i}, got ${step.index}`);
    }
  });

  // Map question fields
  const question: StepBasedQuestion = {
    id,
    title: String(q.title || 'Untitled Question'),
    subject: (q.subject as any) || 'math',
    chapter: String(q.chapter || ''),
    level: (q.level as any) || 'A1',
    difficulty: (q.difficulty as any) || 'medium',
    rankTier: q.rankTier || q.rank_tier || undefined,
    stem: String(q.stem || q.question_text || q.text || ''),
    totalMarks: Number(q.totalMarks || q.total_marks || steps.reduce((sum, s) => sum + s.marks, 0)),
    topicTags: Array.isArray(q.topicTags) ? q.topicTags : (Array.isArray(q.topic_tags) ? q.topic_tags : []),
    steps,
    imageUrl: q.imageUrl || q.image_url || undefined,
  };

  return question;
}

/**
 * Extract correctAnswer from various possible formats.
 */
function extractCorrectAnswer(step: any): 0 | 1 | 2 | 3 {
  // Try direct number field
  if (typeof step.correctAnswer === 'number') {
    return clampAnswer(step.correctAnswer);
  }

  // Try snake_case
  if (typeof step.correct_answer === 'number') {
    return clampAnswer(step.correct_answer);
  }

  // Try JSONB object format: { correctIndex: N }
  if (step.correct_answer && typeof step.correct_answer === 'object') {
    const idx = step.correct_answer.correctIndex;
    if (typeof idx === 'number') {
      return clampAnswer(idx);
    }
  }

  // Try legacy field
  if (typeof step.correctAnswerIndex === 'number') {
    return clampAnswer(step.correctAnswerIndex);
  }

  // Default to 0 if no valid answer found
  console.warn('[questionMapper] Could not extract correctAnswer, defaulting to 0');
  return 0;
}

/**
 * Clamp answer to valid range 0-3.
 */
function clampAnswer(value: number): 0 | 1 | 2 | 3 {
  const clamped = Math.max(0, Math.min(3, Math.floor(value)));
  return clamped as 0 | 1 | 2 | 3;
}

/**
 * Batch convert multiple raw payloads.
 */
export function mapRawToQuestions(raws: any[]): StepBasedQuestion[] {
  if (!Array.isArray(raws)) {
    return [];
  }

  return raws
    .map((raw, i) => {
      try {
        return mapRawToQuestion(raw);
      } catch (error) {
        console.error(`[questionMapper] Failed to map question at index ${i}:`, error);
        return null;
      }
    })
    .filter((q): q is StepBasedQuestion => q !== null);
}

/**
 * Legacy alias for backward compatibility.
 */
export function mapRawQuestionToStepBasedQuestion(raw: any): StepBasedQuestion {
  return mapRawToQuestion(raw);
}

/**
 * Legacy alias for backward compatibility.
 */
export function dbRowToQuestion(raw: any): StepBasedQuestion {
  return mapRawToQuestion(raw);
}

/**
 * Legacy alias for backward compatibility.
 */
export function dbRowsToQuestions(raws: any[]): StepBasedQuestion[] {
  return mapRawToQuestions(raws);
}

/**
 * Convert StepBasedQuestion to database insert/update format.
 * Note: Steps should be inserted separately into question_steps table.
 */
export function questionToDBRow(question: StepBasedQuestion): any {
  return {
    id: question.id,
    title: question.title,
    subject: question.subject,
    chapter: question.chapter,
    level: question.level,
    difficulty: question.difficulty,
    rank_tier: question.rankTier || null,
    question_text: question.stem,
    total_marks: question.totalMarks,
    topic_tags: question.topicTags,
    image_url: question.imageUrl || null,
  };
}

/**
 * Export validation functions from types for convenience.
 */
export { validateQuestion, validateQuestionStep } from '@/types/questions';
