/**
 * ═══════════════════════════════════════════════════════════════════════
 * QUESTION CONTRACT MAPPER
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Converts raw database/WebSocket payloads to canonical StepBasedQuestion.
 * 
 * ⚠️ CRITICAL RULES:
 * 1. FAIL LOUDLY when data doesn't match contract
 * 2. NO defensive fallbacks or defaults
 * 3. If mapping fails, throw descriptive error
 * 4. Logs show exactly what's wrong
 * 
 * This replaces the old questionMapper.ts defensive programming approach.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { StepBasedQuestion, QuestionStep } from '@/types/question-contract';

/**
 * Maps WebSocket/Database payload to canonical StepBasedQuestion.
 * 
 * Accepts both:
 * - Direct DB rows (snake_case fields)
 * - WebSocket messages (mixed case)
 * 
 * @throws Error if payload doesn't match expected contract
 */
export function mapToStepBasedQuestion(payload: any): StepBasedQuestion {
    const context = '[CONTRACT MAPPER]';

    // Validate payload exists
    if (!payload || typeof payload !== 'object') {
        throw new Error(`${context} Payload is null or not an object`);
    }

    // Extract ID
    const id = payload.id;
    if (!id || typeof id !== 'string') {
        throw new Error(`${context} Missing or invalid question.id`);
    }

    // Extract title
    const title = payload.title;
    if (!title || typeof title !== 'string') {
        throw new Error(`${context} Question ${id}: Missing or invalid title`);
    }

    // Extract subject
    const subject = payload.subject;
    if (!subject || !['math', 'physics', 'chemistry'].includes(subject)) {
        throw new Error(`${context} Question ${id}: Invalid subject "${subject}". Must be: math, physics, chemistry`);
    }

    // Extract chapter
    const chapter = payload.chapter;
    if (!chapter || typeof chapter !== 'string') {
        throw new Error(`${context} Question ${id}: Missing or invalid chapter`);
    }

    // Extract level
    const level = payload.level;
    if (!level || !['A1', 'A2'].includes(level)) {
        throw new Error(`${context} Question ${id}: Invalid level "${level}". Must be: A1, A2`);
    }

    // Extract difficulty
    const difficulty = payload.difficulty;
    if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty)) {
        throw new Error(`${context} Question ${id}: Invalid difficulty "${difficulty}". Must be: easy, medium, hard`);
    }

    // Extract stem (try both snake_case and camelCase)
    const stem = payload.stem || payload.question_text;
    if (!stem || typeof stem !== 'string') {
        throw new Error(`${context} Question ${id}: Missing stem/question_text`);
    }

    // Extract total marks (try both formats)
    const totalMarks = payload.totalMarks || payload.total_marks;
    if (typeof totalMarks !== 'number' || totalMarks <= 0) {
        throw new Error(`${context} Question ${id}: Invalid totalMarks/total_marks`);
    }

    // Extract topic tags (try both formats)
    const topicTags = payload.topicTags || payload.topic_tags;
    if (!Array.isArray(topicTags)) {
        throw new Error(`${context} Question ${id}: topicTags/topic_tags must be an array`);
    }

    // Extract steps - CRITICAL
    const rawSteps = payload.steps;
    if (!Array.isArray(rawSteps)) {
        throw new Error(`${context} Question ${id}: steps must be an array, got ${typeof rawSteps}`);
    }

    if (rawSteps.length === 0) {
        throw new Error(`${context} Question ${id}: steps array is empty`);
    }

    // Map each step
    const steps: QuestionStep[] = rawSteps.map((rawStep: any, index: number) => {
        return mapToQuestionStep(rawStep, index, id);
    });

    // Sort steps by index
    steps.sort((a, b) => a.index - b.index);

    // Validate indices are contiguous
    steps.forEach((step, i) => {
        if (step.index !== i) {
            throw new Error(`${context} Question ${id}: Step indices not contiguous. Expected ${i}, got ${step.index}`);
        }
    });

    // Build final question
    const question: StepBasedQuestion = {
        id,
        title,
        subject: subject as 'math' | 'physics' | 'chemistry',
        chapter,
        level: level as 'A1' | 'A2',
        difficulty: difficulty as 'easy' | 'medium' | 'hard',
        rankTier: payload.rankTier || payload.rank_tier || undefined,
        stem,
        totalMarks,
        topicTags,
        steps,
        imageUrl: payload.imageUrl || payload.image_url || undefined,
    };

    console.log(`${context} ✅ Mapped question ${id}: "${title}" with ${steps.length} steps`);

    return question;
}

/**
 * Maps a single step from raw payload.
 * 
 * @throws Error if step doesn't match expected contract
 */
function mapToQuestionStep(rawStep: any, fallbackIndex: number, questionId: string): QuestionStep {
    const context = `[CONTRACT MAPPER] Question ${questionId}, Step ${fallbackIndex}`;

    if (!rawStep || typeof rawStep !== 'object') {
        throw new Error(`${context}: Step is null or not an object`);
    }

    // Extract ID
    const id = rawStep.id || rawStep.step_id;
    if (!id || typeof id !== 'string') {
        throw new Error(`${context}: Missing or invalid id/step_id`);
    }

    // Extract index
    const index = typeof rawStep.index === 'number' ? rawStep.index : rawStep.step_index;
    if (typeof index !== 'number' || index < 0) {
        throw new Error(`${context}: Invalid index/step_index. Must be number >= 0, got ${index}`);
    }

    // Extract type
    const type = rawStep.type || rawStep.step_type;
    if (type !== 'mcq') {
        throw new Error(`${context}: Invalid type. Must be 'mcq', got "${type}"`);
    }

    // Extract title
    const title = rawStep.title;
    if (!title || typeof title !== 'string') {
        throw new Error(`${context}: Missing or invalid title`);
    }

    // Extract prompt
    const prompt = rawStep.prompt || rawStep.question;
    if (!prompt || typeof prompt !== 'string') {
        throw new Error(`${context}: Missing prompt/question text`);
    }

    // Extract options - MUST be exactly 4
    const options = rawStep.options;
    if (!Array.isArray(options)) {
        throw new Error(`${context}: options must be an array, got ${typeof options}`);
    }
    if (options.length !== 4) {
        throw new Error(`${context}: Must have exactly 4 options, got ${options.length}`);
    }
    if (options.some(opt => typeof opt !== 'string')) {
        throw new Error(`${context}: All options must be strings`);
    }

    // Extract correctAnswer - try multiple formats
    let correctAnswer: number;

    if (typeof rawStep.correctAnswer === 'number') {
        correctAnswer = rawStep.correctAnswer;
    } else if (typeof rawStep.correct_answer === 'number') {
        correctAnswer = rawStep.correct_answer;
    } else if (rawStep.correct_answer && typeof rawStep.correct_answer === 'object') {
        // JSONB format: { correctIndex: N }
        correctAnswer = rawStep.correct_answer.correctIndex;
    } else {
        throw new Error(`${context}: Cannot find correctAnswer in any expected format`);
    }

    if (typeof correctAnswer !== 'number' || correctAnswer < 0 || correctAnswer > 3) {
        throw new Error(`${context}: correctAnswer must be 0-3, got ${correctAnswer}`);
    }

    // Extract marks
    const marks = rawStep.marks;
    if (typeof marks !== 'number' || marks <= 0) {
        throw new Error(`${context}: marks must be positive number, got ${marks}`);
    }

    // Build step
    const step: QuestionStep = {
        id,
        index,
        type: 'mcq',
        title,
        prompt,
        options: options as [string, string, string, string],
        correctAnswer: correctAnswer as 0 | 1 | 2 | 3,
        timeLimitSeconds: rawStep.timeLimitSeconds || rawStep.time_limit_seconds || null,
        marks,
        explanation: rawStep.explanation || null,
    };

    return step;
}

/**
 * Wrapper for database rows.
 * Database returns snake_case fields.
 */
export function dbRowToQuestion(row: any): StepBasedQuestion {
    return mapToStepBasedQuestion(row);
}

/**
 * Wrapper for WebSocket messages.
 * WS messages might have mixed casing.
 */
export function wsPayloadToQuestion(payload: any): StepBasedQuestion {
    return mapToStepBasedQuestion(payload);
}
