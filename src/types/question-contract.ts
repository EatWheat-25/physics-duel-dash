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
    index: number;

    /** Step type - MCQ or True/False */
    type: 'mcq' | 'true_false';

    /** Step heading/title (e.g., "Find the derivative") */
    title: string;

    /** The actual question text for this step */
    prompt: string;

    /** Exactly 4 multiple choice options */
    options: [string, string, string, string];

    /** Index of correct option (0, 1, 2, or 3) */
    correctAnswer: 0 | 1 | 2 | 3;

    /** Time limit for this step in seconds (null = no limit) */
    timeLimitSeconds: number | null;

    /** Points awarded for correct answer */
    marks: number;

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

    /** Main question context/setup/stem */
    stem: string;

    /** Total marks (sum of all step marks) */
    totalMarks: number;

    /** Topic tags for filtering */
    topicTags: string[];

    /** Question steps - MUST be sorted by index (0..n) */
    steps: QuestionStep[];

    /** Optional question image URL */
    imageUrl?: string;
}

/**
 * Type guard to validate if an object is a valid QuestionStep
 */
export function isValidQuestionStep(obj: any): obj is QuestionStep {
    return (
        typeof obj === 'object' &&
        typeof obj.id === 'string' &&
        typeof obj.index === 'number' &&
        (obj.type === 'mcq' || obj.type === 'true_false') &&
        typeof obj.title === 'string' &&
        typeof obj.prompt === 'string' &&
        Array.isArray(obj.options) &&
        obj.options.length === 4 &&
        typeof obj.correctAnswer === 'number' &&
        obj.correctAnswer >= 0 &&
        obj.correctAnswer <= 3 &&
        typeof obj.marks === 'number'
    );
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
