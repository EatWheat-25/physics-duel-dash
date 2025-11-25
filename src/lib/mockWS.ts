/**
 * Mock WebSocket Client for Dev Sandbox
 * 
 * Simulates the game-ws backend for local testing without real WebSocket connection.
 */

import type { RoundStartEvent, PhaseChangeEvent, RoundResultEvent } from '@/types/gameEvents';
import { StepBasedQuestion } from '@/types/questions';

export type MockServerMessage =
    | { type: 'connected'; player: 'p1' | 'p2' }
    | { type: 'player_ready'; player: 'p1' | 'p2' }
    | RoundStartEvent
    | PhaseChangeEvent
    | RoundResultEvent
    | { type: 'MATCH_END'; matchId: string; winnerPlayerId: string | null; summary: any }
    | { type: 'validation_error'; message: string; details?: unknown };

export interface MockWSHandle {
    send: (message: string) => void;
    close: () => void;
    simulateNextRound: () => void;
}

// Sample multi-step question for testing
const SAMPLE_QUESTION: StepBasedQuestion = {
    id: 'mock-question-1',
    title: 'Integration by Parts',
    subject: 'math',
    chapter: 'Integration',
    level: 'A2',
    difficulty: 'medium',
    stem: 'Evaluate the integral: ∫(ln x / x³) dx',
    totalMarks: 10,
    topicTags: ['integration', 'by-parts'],
    steps: [
        {
            id: 'step-1',
            index: 0,
            type: 'mcq',
            title: 'Step 1: Identify u and dv',
            prompt: 'In integration by parts (∫u dv = uv - ∫v du), which should be u?',
            options: ['ln x', '1/x³', 'x³', 'x'],
            correctAnswer: 0,
            timeLimitSeconds: null,
            marks: 2,
            explanation: 'Choose ln x as u because its derivative simplifies the integral.',
        },
        {
            id: 'step-2',
            index: 1,
            type: 'mcq',
            title: 'Step 2: Find du',
            prompt: 'What is du when u = ln x?',
            options: ['dx/x', 'x dx', '1/x²', 'ln x dx'],
            correctAnswer: 0,
            timeLimitSeconds: null,
            marks: 2,
            explanation: 'd/dx(ln x) = 1/x, so du = dx/x',
        },
        {
            id: 'step-3',
            index: 2,
            type: 'mcq',
            title: 'Step 3: Find v',
            prompt: 'If dv = dx/x³, what is v?',
            options: ['-1/(2x²)', '1/(2x²)', '-1/x²', '1/x²'],
            correctAnswer: 0,
            timeLimitSeconds: null,
            marks: 3,
            explanation: '∫x⁻³ dx = -1/(2x²) + C',
        },
        {
            id: 'step-4',
            index: 3,
            type: 'mcq',
            title: 'Step 4: Final Answer',
            prompt: 'Using uv - ∫v du, what is the final answer?',
            options: [
                '-(ln x)/(2x²) - 1/(4x²) + C',
                '(ln x)/(2x²) + 1/(4x²) + C',
                '-(ln x)/(2x²) + 1/(4x²) + C',
                '(ln x)/(2x²) - 1/(4x²) + C',
            ],
            correctAnswer: 0,
            timeLimitSeconds: null,
            marks: 3,
            explanation: 'Substitute and simplify: uv - ∫v du = -(ln x)/(2x²) - ∫(-1/(2x²))(dx/x)',
        },
    ],
};

const SAMPLE_QUESTION_2: StepBasedQuestion = {
    id: 'mock-question-2',
    title: 'Quadratic Equations',
    subject: 'math',
    chapter: 'Algebra',
    level: 'A1',
    difficulty: 'easy',
    stem: 'Solve: x² - 5x + 6 = 0',
    totalMarks: 5,
    topicTags: ['algebra', 'quadratic'],
    steps: [
        {
            id: 'step-1',
            index: 0,
            type: 'mcq',
            title: 'Factorization',
            prompt: 'What is the factored form?',
            options: ['(x-2)(x-3)', '(x-1)(x-6)', '(x+2)(x+3)', '(x-2)(x+3)'],
            correctAnswer: 0,
            timeLimitSeconds: null,
            marks: 5,
            explanation: 'x² - 5x + 6 = (x-2)(x-3)',
        },
    ],
};

export function createMockGameWS(
    matchId: string,
    onMessage: (msg: MockServerMessage) => void
): MockWSHandle {
    let currentRound = 0;
    const maxRounds = 3;
    let timeouts: NodeJS.Timeout[] = [];
    let isClosed = false;

    const scheduleMessage = (msg: MockServerMessage, delayMs: number) => {
        const timeout = setTimeout(() => {
            if (!isClosed) {
                console.log('[MockWS] Sending message:', msg.type);
                onMessage(msg);
            }
        }, delayMs);
        timeouts.push(timeout);
    };

    const simulateRound = (roundIndex: number) => {
        if (isClosed || roundIndex > maxRounds) return;

        const question = roundIndex % 2 === 1 ? SAMPLE_QUESTION : SAMPLE_QUESTION_2;
        const roundId = `mock-round-${roundIndex}`;

        // ROUND_START (thinking phase)
        scheduleMessage(
            {
                type: 'ROUND_START',
                matchId,
                roundId,
                roundIndex,
                phase: 'thinking',
                question: {
                    id: question.id,
                    title: question.title,
                    subject: question.subject,
                    chapter: question.chapter,
                    level: question.level,
                    difficulty: question.difficulty,
                    questionText: question.stem,
                    totalMarks: question.totalMarks,
                    steps: question.steps.map((s) => ({
                        id: s.id,
                        question: s.prompt,
                        options: s.options,
                        correctAnswer: s.correctAnswer,
                        marks: s.marks,
                        explanation: s.explanation,
                    })),
                    topicTags: question.topicTags,
                },
                thinkingEndsAt: new Date(Date.now() + 5000).toISOString(),
            },
            0
        );

        // PHASE_CHANGE to choosing (for each step)
        question.steps.forEach((step, stepIdx) => {
            scheduleMessage(
                {
                    type: 'PHASE_CHANGE',
                    matchId,
                    roundIndex,
                    phase: 'choosing',
                    choosingEndsAt: new Date(Date.now() + 5000 + (stepIdx + 1) * 10000).toISOString(),
                    currentStepIndex: stepIdx,
                    totalSteps: question.steps.length,
                },
                5000 + stepIdx * 10000
            );
        });

        // Simulate ROUND_RESULT after last step
        const resultDelay = 5000 + question.steps.length * 10000;
        scheduleMessage(
            {
                type: 'ROUND_RESULT',
                matchId,
                roundIndex,
                questionId: question.id,
                correctOptionId: question.steps[question.steps.length - 1].correctAnswer,
                playerResults: [
                    {
                        playerId: 'mock-player-1',
                        selectedOptionId: question.steps[question.steps.length - 1].correctAnswer,
                        isCorrect: true,
                        timeTakenMs: 5000,
                    },
                    {
                        playerId: 'mock-player-2',
                        selectedOptionId: (question.steps[question.steps.length - 1].correctAnswer + 1) % 4,
                        isCorrect: false,
                        timeTakenMs: 7000,
                    },
                ],
                tugOfWar: roundIndex * 2 - 2, // Varies per round
                p1Score: roundIndex,
                p2Score: Math.max(0, roundIndex - 1),
            },
            resultDelay
        );

        // Start next round or end match
        if (roundIndex < maxRounds) {
            setTimeout(() => simulateRound(roundIndex + 1), resultDelay + 3000);
        } else {
            scheduleMessage(
                {
                    type: 'MATCH_END',
                    matchId,
                    winnerPlayerId: 'mock-player-1',
                    summary: {
                        roundsPlayed: maxRounds,
                        finalScores: {
                            p1: maxRounds,
                            p2: maxRounds - 1,
                        },
                    },
                },
                resultDelay + 3000
            );
        }
    };

    // Initialize connection - start game immediately!
    setTimeout(() => {
        console.log('[MockWS] Simulating connection...');

        // Send connected event and immediately start first round
        scheduleMessage({ type: 'connected', player: 'p1' }, 0);

        // Start first round right away (no ready waiting)
        setTimeout(() => {
            currentRound = 1;
            simulateRound(1);
        }, 100);
    }, 100);

    return {
        send: (message: string) => {
            if (isClosed) return;
            try {
                const parsed = JSON.parse(message);
                console.log('[MockWS] Received client message:', parsed.type);

                // Could simulate responses to client messages here if needed
                if (parsed.type === 'submit_answer') {
                    console.log('[MockWS] Answer submitted:', parsed);
                }
            } catch (e) {
                console.error('[MockWS] Failed to parse client message:', e);
            }
        },

        close: () => {
            console.log('[MockWS] Closing connection');
            isClosed = true;
            timeouts.forEach(clearTimeout);
            timeouts = [];
        },

        simulateNextRound: () => {
            if (currentRound < maxRounds) {
                currentRound++;
                simulateRound(currentRound);
            }
        },
    };
}
