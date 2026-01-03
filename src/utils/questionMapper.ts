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

import { StepBasedQuestion, QuestionStep, GraphConfig, GraphColor, GraphPoint } from '@/types/questions';

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
   * Normalize options array.
   * - True/False: exactly 2 options
   * - MCQ: 2–6 options
   *
   * Note: We trim empty strings and preserve ordering (no padding/truncation to 4).
   */
  const normalizeOptions = (step: any): string[] => {
    let opts: string[] = []
    
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
    
    // ✅ If TF type, always return exactly 2 options (no padding)
    if (step.type === 'true_false') {
      const two = opts.slice(0, 2)
      while (two.length < 2) two.push('')
      return two
    }
    
    // ✅ If it *looks* TF (exactly 2 options that are "True"/"False"), don't pad
    if (opts.length === 2) {
      const norm = opts.map(o => String(o).trim().toLowerCase()).sort();
      if (norm[0] === 'false' && norm[1] === 'true') {
        return opts;
      }
    }
    
    // 🟦 Otherwise MCQ rules: keep up to 6 options, no padding
    const mcq = [...opts].slice(0, 6)
    while (mcq.length < 2) mcq.push('')
    return mcq
  };

  const steps: QuestionStep[] = rawSteps.map((s: any, fallbackIndex: number) => {
    // Map step index: prefer step_index, then index, then fallbackIndex
    const stepIndex = typeof s.step_index === 'number' 
      ? s.step_index 
      : (typeof s.index === 'number' ? s.index : fallbackIndex);
    
    // Normalize options (handles TF vs MCQ)
    const optionsArray = normalizeOptions(s);
    
    // Map all possible field name variations
    const stepType = (s.type === 'true_false' || s.type === 'mcq') ? s.type : 'mcq';
    const step: QuestionStep = {
      id: String(s.id || s.step_id || `${id}-step-${fallbackIndex}`),
      index: stepIndex,
      type: stepType,
      title: String(s.title || ''),
      prompt: String(s.prompt || s.question || ''),
      diagramSmiles: s.diagramSmiles || s.diagram_smiles || undefined,
      diagramImageUrl: s.diagramImageUrl || s.diagram_image_url || undefined,
      options: optionsArray,
      correctAnswer: extractCorrectAnswer(s, optionsArray.length),
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
    structureSmiles: q.structureSmiles || q.structure_smiles || undefined,
    graph: mapGraphConfig(q) || undefined,
  };

  return question;
}

function normalizeGraphColor(raw: any): GraphColor {
  const c = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return c === 'black' ? 'black' : 'white'
}

function coerceNumber(n: any): number | undefined {
  if (typeof n === 'number' && Number.isFinite(n)) return n
  if (typeof n === 'string' && n.trim() !== '') {
    const v = Number(n)
    return Number.isFinite(v) ? v : undefined
  }
  return undefined
}

function parseGraphPoints(raw: any): GraphPoint[] | null {
  if (!Array.isArray(raw)) return null
  const pts: GraphPoint[] = []
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue
    const x = coerceNumber((p as any).x)
    const y = coerceNumber((p as any).y)
    if (typeof x === 'number' && typeof y === 'number') pts.push({ x, y })
  }
  return pts.length >= 2 ? pts : null
}

function mapGraphConfig(q: any): GraphConfig | null {
  // 1) New graph JSONB column
  const rawGraph = q?.graph ?? null
  if (rawGraph) {
    let g: any = rawGraph
    if (typeof g === 'string') {
      try { g = JSON.parse(g) } catch { g = null }
    }
    if (g && typeof g === 'object') {
      const type = typeof g.type === 'string' ? g.type.trim().toLowerCase() : ''
      const color = normalizeGraphColor(g.color)
      const xMin = coerceNumber(g.xMin)
      const xMax = coerceNumber(g.xMax)
      const yMin = coerceNumber(g.yMin)
      const yMax = coerceNumber(g.yMax)

      if (type === 'function') {
        const equation = typeof g.equation === 'string' ? g.equation.trim() : ''
        if (equation) return { type: 'function', equation, color, xMin, xMax, yMin, yMax }
      }

      if (type === 'points') {
        const points = parseGraphPoints(g.points)
        if (points) return { type: 'points', points, color, xMin, xMax, yMin, yMax }
      }
    }
  }

  // 2) Legacy question-level columns
  const legacyEq = q?.graphEquation ?? q?.graph_equation ?? null
  if (typeof legacyEq === 'string' && legacyEq.trim()) {
    const legacyColor = q?.graphColor ?? q?.graph_color ?? 'white'
    return { type: 'function', equation: legacyEq.trim(), color: normalizeGraphColor(legacyColor), xMin: -10, xMax: 10 }
  }

  // 3) Legacy step-level fields (best-effort)
  try {
    const rawSteps = Array.isArray(q?.steps) ? q.steps : []
    for (const s of rawSteps) {
      const eq = s?.graphEquation ?? s?.graph_equation
      if (typeof eq === 'string' && eq.trim()) {
        const c = s?.graphColor ?? s?.graph_color ?? 'white'
        return { type: 'function', equation: eq.trim(), color: normalizeGraphColor(c), xMin: -10, xMax: 10 }
      }
    }
  } catch {
    // ignore
  }

  return null
}

/**
 * Extract correctAnswer from various possible formats.
 */
function extractCorrectAnswer(step: any, optionsLength: number): number {
  // Try direct number field
  if (typeof step.correctAnswer === 'number') {
    return clampAnswer(step.correctAnswer, optionsLength);
  }

  // Try snake_case
  if (typeof step.correct_answer === 'number') {
    return clampAnswer(step.correct_answer, optionsLength);
  }

  // Try JSONB object format: { correctIndex: N }
  if (step.correct_answer && typeof step.correct_answer === 'object') {
    const idx = step.correct_answer.correctIndex;
    if (typeof idx === 'number') {
      return clampAnswer(idx, optionsLength);
    }
  }

  // Try legacy field
  if (typeof step.correctAnswerIndex === 'number') {
    return clampAnswer(step.correctAnswerIndex, optionsLength);
  }

  // Default to 0 if no valid answer found
  console.warn('[questionMapper] Could not extract correctAnswer, defaulting to 0');
  return 0;
}

/**
 * Clamp answer to valid range for the current options array.
 * For MCQ we support up to 6 options (0-5). For TF we expect 2 (0-1).
 */
function clampAnswer(value: number, optionsLength: number): number {
  const hardMax = 5
  const maxIndex = Math.max(0, Math.min(hardMax, Math.floor(optionsLength - 1)))
  const clamped = Math.max(0, Math.min(maxIndex, Math.floor(value)))
  return clamped
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
 * Steps are stored as JSONB array in the questions_v2 table.
 */
export function questionToDBRow(question: StepBasedQuestion): any {
  // Convert steps to database format (ensure index field is used, not stepIndex)
  const dbSteps = question.steps.map(step => ({
    id: step.id,
    index: step.index, // Use 'index' field
    type: step.type,
    title: step.title,
    prompt: step.prompt,
    diagramSmiles: step.diagramSmiles,
    diagramImageUrl: step.diagramImageUrl,
    options: step.options,
    correctAnswer: step.correctAnswer,
    timeLimitSeconds: step.timeLimitSeconds,
    marks: step.marks,
    explanation: step.explanation
  }));

  return {
    id: question.id,
    title: question.title,
    subject: question.subject,
    chapter: question.chapter,
    level: question.level,
    difficulty: question.difficulty,
    rank_tier: question.rankTier || null,
    stem: question.stem, // Use 'stem' not 'question_text' for questions_v2
    total_marks: question.totalMarks,
    topic_tags: question.topicTags,
    steps: dbSteps, // Include steps as JSONB
    image_url: question.imageUrl || null,
    structure_smiles: question.structureSmiles || null,
    graph: question.graph || null,
  };
}

/**
 * Export validation functions from types for convenience.
 */
export { validateQuestion, validateQuestionStep } from '@/types/questions';
