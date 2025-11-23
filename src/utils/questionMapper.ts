import { StepBasedQuestion, QuestionStep, QuestionSubject, QuestionLevel, QuestionDifficulty, RankTier, QuestionInput, QuestionDBRow } from '@/types/questions';

/**
 * IMPORTANT: Backend Compatibility Hack
 * 
 * The backend (game-ws) expects the "Final Step" (the one that triggers scoring)
 * to be at index 0 of the `steps` array.
 * 
 * The database RPC `pick_next_question_v2` constructs the array this way:
 * steps[0] = Step with highest step_index (Final Step)
 * steps[1..N] = Other steps
 * 
 * THIS MAPPER MUST ALWAYS BE USED to restore the correct logical order
 * for the Frontend UI.
 * 
 * IT SORTS STEPS BY `step_index` ASCENDING.
 */

export interface RawQuestionStep {
  id: string;
  index: number; // step_index from DB
  type: string;
  title?: string;
  prompt: string; // DB uses 'prompt' or 'question' depending on RPC alias, we aliased to 'prompt' in RPC
  question?: string; // Legacy fallback
  options: string[];
  correctAnswer: number;
  timeLimitSeconds: number;
  marks: number;
  explanation?: string;
}

export interface RawQuestion {
  id: string;
  subject: string;
  level: string;
  chapter: string;
  difficulty: string;
  rank_tier?: string;
  title: string;
  stem?: string; // New field from RPC
  question_text?: string; // Legacy field
  base_marks?: number;
  total_marks?: number;
  working_time_seconds?: number;
  steps: RawQuestionStep[];
  topic_tags?: string[];
}

export function mapRawQuestionToStepBasedQuestion(raw: RawQuestion): StepBasedQuestion {
  // 1. Sort steps by index to restore logical order (0, 1, 2, 3...)
  const sortedSteps = [...raw.steps].sort((a, b) => a.index - b.index);

  // 2. Map to internal QuestionStep type
  const mappedSteps: QuestionStep[] = sortedSteps.map(step => {
    // Ensure options is a tuple of 4 strings if possible, or just string[] cast
    // The canonical type expects [string, string, string, string]
    // We will pad or slice if necessary to avoid runtime errors, though DB should be correct.
    const opts = step.options || [];
    const paddedOptions = [
      opts[0] || '',
      opts[1] || '',
      opts[2] || '',
      opts[3] || ''
    ] as [string, string, string, string];

    return {
      id: step.id,
      // Canonical type uses 'question' for the text
      question: step.prompt || step.question || '',
      options: paddedOptions,
      correctAnswer: (step.correctAnswer as 0 | 1 | 2 | 3) || 0,
      marks: step.marks || 1,
      explanation: step.explanation || '',
      timeLimitSeconds: step.timeLimitSeconds || 15,
      title: step.title || `Part ${step.index + 1}`
    };
  });

  return {
    id: raw.id,
    title: raw.title,
    subject: raw.subject as QuestionSubject,
    chapter: raw.chapter,
    level: raw.level as QuestionLevel,
    difficulty: raw.difficulty as QuestionDifficulty,
    rankTier: (raw.rank_tier || 'Bronze') as RankTier,
    totalMarks: raw.base_marks || raw.total_marks || 0,
    // Use stem as the main question text context
    questionText: raw.stem || raw.question_text || '',
    topicTags: raw.topic_tags || [],
    steps: mappedSteps
  };
}

/**
 * Converts DB rows (from 'questions' table select) to StepBasedQuestion objects.
 * Handles both legacy 'steps' JSON column and joined 'question_steps' table.
 */
export function dbRowsToQuestions(rows: any[]): StepBasedQuestion[] {
  return rows.map(row => {
    let steps: RawQuestionStep[] = [];

    // Case 1: Joined question_steps (preferred)
    if (row.question_steps && Array.isArray(row.question_steps) && row.question_steps.length > 0) {
      steps = row.question_steps.map((qs: any) => ({
        id: qs.id,
        index: qs.step_index,
        type: qs.step_type,
        title: qs.title,
        prompt: qs.prompt,
        options: qs.options,
        correctAnswer: qs.correct_answer?.correctIndex ?? 0,
        timeLimitSeconds: qs.time_limit_seconds,
        marks: qs.marks,
        explanation: '' // Not in DB yet
      }));
    }
    // Case 2: Legacy steps JSON column
    else if (row.steps && Array.isArray(row.steps)) {
      steps = row.steps.map((s: any, idx: number) => ({
        ...s,
        index: s.index ?? idx, // Fallback to array index if missing
        prompt: s.question || s.prompt // Handle legacy field name
      }));
    }

    const raw: RawQuestion = {
      id: row.id,
      subject: row.subject,
      level: row.level,
      chapter: row.chapter,
      difficulty: row.difficulty,
      rank_tier: row.rank_tier,
      title: row.title,
      stem: row.question_text, // DB 'question_text' is the stem
      question_text: row.question_text,
      base_marks: row.base_marks,
      total_marks: row.total_marks,
      working_time_seconds: row.working_time_seconds,
      steps: steps,
      topic_tags: row.topic_tags
    };

    return mapRawQuestionToStepBasedQuestion(raw);
  });
}

/**
 * Converts a QuestionInput object to a DB row for the 'questions' table.
 * NOTE: This only handles the main question record. Steps should be inserted separately into 'question_steps'.
 * For backward compatibility, we also populate the 'steps' JSON column.
 */
export function questionToDBRow(q: QuestionInput): Partial<QuestionDBRow> {
  // Map steps back to raw format for JSON column
  const rawSteps = q.steps.map((s, idx) => ({
    id: s.id,
    index: idx,
    type: 'mcq',
    title: s.title,
    question: s.question,
    options: s.options,
    correctAnswer: s.correctAnswer,
    marks: s.marks,
    timeLimitSeconds: s.timeLimitSeconds,
    explanation: s.explanation
  }));

  return {
    title: q.title,
    subject: q.subject,
    chapter: q.chapter,
    level: q.level,
    difficulty: q.difficulty,
    rank_tier: q.rankTier,
    question_text: q.questionText,
    total_marks: q.totalMarks,
    topic_tags: q.topicTags,
    steps: rawSteps, // Legacy JSON
    image_url: q.imageUrl
  };
}

/**
 * Validates a question input object.
 */
export function validateQuestion(q: QuestionInput): string[] {
  const errors: string[] = [];
  if (!q.title) errors.push('Title is required');
  if (!q.questionText) errors.push('Question text (stem) is required');
  if (!q.steps || q.steps.length === 0) errors.push('At least one step is required');

  q.steps.forEach((step, idx) => {
    if (!step.question) errors.push(`Step ${idx + 1}: Question prompt is required`);
    if (!step.options || step.options.length !== 4) errors.push(`Step ${idx + 1}: Must have exactly 4 options`);
    if (step.correctAnswer < 0 || step.correctAnswer > 3) errors.push(`Step ${idx + 1}: Invalid correct answer index`);
  });

  return errors;
}
