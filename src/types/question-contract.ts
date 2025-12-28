/**
 * ═══════════════════════════════════════════════════════════════════════
 * CANONICAL QUESTION CONTRACT
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * This is the SINGLE SOURCE OF TRUTH for question data shape.
 * 
 * ⚠️ RULES:
 * 1. This is the ONLY question type used in online battles
 * 2. DO NOT create other Question interfaces elsewhere
 * 3. DO NOT add defensive fallbacks when mapping to this type
 * 4. If data doesn't match this shape, FAIL LOUDLY
 * 
 * Last updated: 2025-11-27
 * ═══════════════════════════════════════════════════════════════════════
 */

/**
 * A single step in a multi-step question.
 * Steps are ordered by `index` (0, 1, 2, ...).
 */
export interface QuestionStep {
    /** Unique identifier for this step */
    id: string;

    /** 0-based display order (0 = first step) */
    index?: number;

    /** Step type - MCQ or True/False */
    type: 'mcq' | 'true_false';

    /** Step heading/title (e.g., "Find the derivative") */
    title: string;

    /** The actual question text for this step */
    prompt: string;

    /**
     * Answer options.
     * - MCQ: 2–6 options
     * - True/False: exactly 2 options
     */
    options: string[];

    /** Index of correct option (0 <= correctAnswer < options.length) */
    correctAnswer: number;

    /** Time limit for this step in seconds (null = no limit) */
    timeLimitSeconds: number | null;

    /** Points awarded for correct answer */
    marks: number;

    /** Explanation shown after answering (null = no explanation) */
    explanation: string | null;

    /**
     * Optional sub-steps inside this step.
     * - NOT extra steps/parts (still counts toward the same step)
     * - If present and ANY are failed, the whole step awards 0 marks (server enforces)
     */
    subSteps?: QuestionSubStep[];
}

/**
 * Optional sub-step inside a step.
 * Same answer shape as a normal step, but it awards no marks by itself.
 */
export interface QuestionSubStep {
    /** Sub-step type - MCQ or True/False */
    type: 'mcq' | 'true_false';

    /** The actual question text for the sub-step */
    prompt: string;

    /**
     * Answer options.
     * - MCQ: 2–6 options
     * - True/False: exactly 2 options
     */
    options: string[];

    /** Index of correct option (0 <= correctAnswer < options.length) */
    correctAnswer: number;

    /** Time limit for this sub-step in seconds (default: 5; null = no limit) */
    timeLimitSeconds: number | null;

    /** Explanation shown after answering (null = no explanation) */
    explanation: string | null;
}

/**
 * Complete question structure.
 * Can be single-step (steps.length === 1) or multi-step (steps.length > 1).
 */
export interface StepBasedQuestion {
    /** Unique identifier for this question */
    id: string;

    /** Question title/name */
    title: string;

    /** Subject area */
    subject: 'math' | 'physics' | 'chemistry';

    /** Chapter/topic (e.g., "Integration", "Kinematics") */
    chapter: string;

    /** Educational level */
    level: 'A1' | 'A2';

    /** Difficulty rating */
    difficulty: 'easy' | 'medium' | 'hard';

    /** Optional rank tier requirement */
    rankTier?: string;

    /** Main question context/setup/stem (optional for legacy data) */
    stem?: string;

    /**
     * Time limit (seconds) for the main question phase (before steps begin).
     * Server-enforced; Admin-configurable; clamped to a safe range.
     * Optional - defaults to 60 seconds if not specified.
     */
    mainQuestionTimerSeconds?: number;

    /** Total marks (sum of all step marks) */
    totalMarks: number;

    /** Topic tags for filtering */
    topicTags?: string[];

    /** Question steps - MUST be sorted by index (0..n) */
    steps: QuestionStep[];

    /** Optional question image URL */
    imageUrl?: string;
}

/**
 * Type guard to validate if an object is a valid QuestionStep
 */
export function isValidQuestionStep(obj: any): obj is QuestionStep {
    if (!obj || typeof obj !== 'object') return false;
    if (typeof obj.id !== 'string') return false;
    if (typeof obj.index !== 'number') return false;
    if (obj.type !== 'mcq' && obj.type !== 'true_false') return false;
    if (typeof obj.title !== 'string') return false;
    if (typeof obj.prompt !== 'string') return false;

    if (!Array.isArray(obj.options) || !obj.options.every((o: any) => typeof o === 'string')) return false;
    const optionCount = obj.options.length;
    const optionCountOk = obj.type === 'true_false'
        ? optionCount === 2
        : optionCount >= 2 && optionCount <= 6;
    if (!optionCountOk) return false;

    if (typeof obj.correctAnswer !== 'number' || !Number.isInteger(obj.correctAnswer)) return false;
    if (obj.correctAnswer < 0 || obj.correctAnswer >= optionCount) return false;

    if (typeof obj.marks !== 'number') return false;

    if (obj.subSteps != null) {
        if (!Array.isArray(obj.subSteps)) return false;
        const isValidSub = (s: any) => {
            if (!s || typeof s !== 'object') return false;
            if (s.type !== 'mcq' && s.type !== 'true_false') return false;
            if (typeof s.prompt !== 'string') return false;
            if (!Array.isArray(s.options) || !s.options.every((o: any) => typeof o === 'string')) return false;
            const subCount = s.options.length;
            const subCountOk = s.type === 'true_false'
                ? subCount === 2
                : subCount >= 2 && subCount <= 6;
            if (!subCountOk) return false;
            if (typeof s.correctAnswer !== 'number' || !Number.isInteger(s.correctAnswer)) return false;
            if (s.correctAnswer < 0 || s.correctAnswer >= subCount) return false;
            return true;
        };
        if (!obj.subSteps.every(isValidSub)) return false;
    }

    return true;
}

/**
 * Type guard to validate if an object is a valid StepBasedQuestion
 */
export function isValidStepBasedQuestion(obj: any): obj is StepBasedQuestion {
    return (
        typeof obj === 'object' &&
        typeof obj.id === 'string' &&
        typeof obj.title === 'string' &&
        ['math', 'physics', 'chemistry'].includes(obj.subject) &&
        typeof obj.chapter === 'string' &&
        ['A1', 'A2'].includes(obj.level) &&
        ['easy', 'medium', 'hard'].includes(obj.difficulty) &&
        typeof obj.stem === 'string' &&
        typeof obj.totalMarks === 'number' &&
        Array.isArray(obj.topicTags) &&
        Array.isArray(obj.steps) &&
        obj.steps.length > 0 &&
        obj.steps.every(isValidQuestionStep)
    );
}
