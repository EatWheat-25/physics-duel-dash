/**
 * ═══════════════════════════════════════════════════════════════════════
 * QUESTION CONTRACT MAPPER
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Converts raw database/WebSocket payloads to canonical StepBasedQuestion.
 * 
 * Mapper is now tolerant: it normalizes/repairs common issues instead of
 * failing hard, so admin views can still surface imperfect data.
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
    const warn = (msg: string) => console.warn(`${context} ⚠️ ${msg}`, payload);

    if (!payload || typeof payload !== 'object') {
        throw new Error(`${context} Payload is null or not an object`);
    }

    const id = typeof payload.id === 'string' ? payload.id : String(payload.id || `q-${crypto.randomUUID?.() || Date.now()}`);
    const title = typeof payload.title === 'string' && payload.title.trim().length > 0
        ? payload.title
        : 'Untitled Question';

    const rawSubject = payload.subject?.toLowerCase?.();
    const subject = (['math', 'physics', 'chemistry'].includes(rawSubject)
        ? rawSubject
        : (warn(`Question ${id}: subject "${payload.subject}" invalid, defaulting to math`), 'math')) as 'math' | 'physics' | 'chemistry';

    const chapter = typeof payload.chapter === 'string' && payload.chapter.trim().length > 0
        ? payload.chapter
        : (warn(`Question ${id}: missing chapter, defaulting to 'General'`), 'General');

    const rawLevel = typeof payload.level === 'string' ? payload.level.toUpperCase() : '';
    const level = (rawLevel === 'A1' || rawLevel === 'A2'
        ? rawLevel
        : (warn(`Question ${id}: level "${payload.level}" invalid, defaulting to A1`), 'A1')) as 'A1' | 'A2';

    const rawDifficulty = typeof payload.difficulty === 'string' ? payload.difficulty.toLowerCase() : '';
    const difficulty = (['easy', 'medium', 'hard'].includes(rawDifficulty)
        ? rawDifficulty
        : (warn(`Question ${id}: difficulty "${payload.difficulty}" invalid, defaulting to medium`), 'medium')) as 'easy' | 'medium' | 'hard';

    const stem = typeof payload.stem === 'string' && payload.stem.trim().length > 0
        ? payload.stem
        : typeof payload.question_text === 'string' && payload.question_text.trim().length > 0
            ? payload.question_text
            : (warn(`Question ${id}: missing stem/question_text, using empty string`), '');

    const rawSteps = Array.isArray(payload.steps) ? payload.steps : [];
    if (!Array.isArray(payload.steps)) {
        warn(`Question ${id}: steps missing or not array; defaulting to empty`);
    }

    const steps: QuestionStep[] = (rawSteps.length > 0 ? rawSteps : [createPlaceholderStep(id, stem)]).map((rawStep: any, index: number) => {
        return mapToQuestionStep(rawStep, index, id);
    });

    steps.sort((a, b) => a.index - b.index);

    steps.forEach((step, i) => {
        if (step.index !== i) {
            warn(`Question ${id}: Step indices not contiguous. Expected ${i}, got ${step.index}. Normalizing.`);
            step.index = i;
        }
    });

    const rawTotalMarks = payload.totalMarks ?? payload.total_marks;
    const totalMarks = typeof rawTotalMarks === 'number' && rawTotalMarks > 0
        ? rawTotalMarks
        : Math.max(steps.reduce((sum, s) => sum + (s.marks || 0), 0), steps.length || 1);

    const rawTopicTags = payload.topicTags ?? payload.topic_tags;
    let topicTags: string[] = [];
    if (Array.isArray(rawTopicTags)) {
        topicTags = rawTopicTags.filter(Boolean).map(String);
    } else if (typeof rawTopicTags === 'string') {
        topicTags = rawTopicTags.split(',').map(t => t.trim()).filter(Boolean);
    } else {
        topicTags = [];
    }

    const question: StepBasedQuestion = {
        id,
        title,
        subject,
        chapter,
        level,
        difficulty,
        rankTier: payload.rankTier || payload.rank_tier || undefined,
        stem,
        totalMarks,
        topicTags,
        steps,
        imageUrl: payload.imageUrl || payload.image_url || undefined,
    };

    console.log(`${context} ✅ Mapped question ${id}: "${title}" with ${steps.length} steps (marks=${totalMarks})`);

    return question;
}

/**
 * Maps a single step from raw payload.
 * 
 * @throws Error if step doesn't match expected contract
 */
function mapToQuestionStep(rawStep: any, fallbackIndex: number, questionId: string): QuestionStep {
    const context = `[CONTRACT MAPPER] Question ${questionId}, Step ${fallbackIndex}`;
    const warn = (msg: string) => console.warn(`${context} ⚠️ ${msg}`, rawStep);

    if (!rawStep || typeof rawStep !== 'object') {
        warn('Step is null or not an object; creating placeholder step');
        rawStep = {};
    }

    const id = typeof rawStep.id === 'string'
        ? rawStep.id
        : typeof rawStep.step_id === 'string'
            ? rawStep.step_id
            : `step-${fallbackIndex}`;

    const index = typeof rawStep.index === 'number'
        ? rawStep.index
        : typeof rawStep.step_index === 'number'
            ? rawStep.step_index
            : fallbackIndex;

    let type = typeof rawStep.type === 'string' ? rawStep.type : rawStep.step_type;
    if (typeof type !== 'string') {
        warn('Missing type; defaulting to mcq');
        type = 'mcq';
    }
    if (type === 'true false' || type === 'True False' || type === 'TRUE FALSE') {
        type = 'true_false';
    }
    if (type !== 'mcq' && type !== 'true_false') {
        warn(`Invalid type "${type}"; defaulting to mcq`);
        type = 'mcq';
    }

    const title = typeof rawStep.title === 'string' && rawStep.title.trim().length > 0
        ? rawStep.title
        : `Step ${fallbackIndex + 1}`;

    const prompt = typeof rawStep.prompt === 'string' && rawStep.prompt.trim().length > 0
        ? rawStep.prompt
        : typeof rawStep.question === 'string'
            ? rawStep.question
            : '';

    let options = Array.isArray(rawStep.options) ? rawStep.options : [];
    if (!Array.isArray(rawStep.options)) {
        warn('Options missing; defaulting to empty array');
    }
    options = options.map(opt => (opt ?? '').toString());
    while (options.length < 4) options.push('');
    if (options.length > 4) options = options.slice(0, 4);

    let correctAnswer: number | undefined;
    if (typeof rawStep.correctAnswer === 'number') {
        correctAnswer = rawStep.correctAnswer;
    } else if (typeof rawStep.correct_answer === 'number') {
        correctAnswer = rawStep.correct_answer;
    } else if (rawStep.correct_answer && typeof rawStep.correct_answer === 'object') {
        correctAnswer = rawStep.correct_answer.correctIndex;
    }
    if (typeof correctAnswer !== 'number' || correctAnswer < 0 || correctAnswer > 3) {
        warn(`correctAnswer invalid "${correctAnswer}", defaulting to 0`);
        correctAnswer = 0;
    }

    const marks = typeof rawStep.marks === 'number' && rawStep.marks > 0
        ? rawStep.marks
        : (warn(`marks invalid "${rawStep.marks}", defaulting to 1`), 1);

    const step: QuestionStep = {
        id,
        index,
        type: type as 'mcq' | 'true_false',
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

function createPlaceholderStep(questionId: string, stem: string): any {
    return {
        id: `placeholder-step-${questionId}`,
        index: 0,
        type: 'mcq',
        title: 'Placeholder Step',
        prompt: stem || 'No prompt provided',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 0,
        marks: 1,
        timeLimitSeconds: null,
        explanation: null,
    };
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
