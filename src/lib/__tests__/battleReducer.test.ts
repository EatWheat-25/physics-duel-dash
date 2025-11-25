/**
 * Unit Tests for Battle Reducer
 * 
 * Tests all state transitions in the battle state machine.
 */

import { describe, it, expect } from 'vitest';
import { battleReducer, initialBattleState, BattleState } from '../battleReducer';
import { StepBasedQuestion } from '@/types/questions';

// Mock question for testing
const mockQuestion: StepBasedQuestion = {
    id: 'test-q-1',
    title: 'Test Question',
    subject: 'math',
    chapter: 'Test',
    level: 'A1',
    difficulty: 'easy',
    stem: 'Test question stem',
    totalMarks: 5,
    topicTags: ['test'],
    steps: [
        {
            id: 'step-1',
            index: 0,
            type: 'mcq',
            title: 'Step 1',
            prompt: 'What is 2+2?',
            options: ['3', '4', '5', '6'],
            correctAnswer: 1,
            timeLimitSeconds: null,
            marks: 5,
            explanation: '2+2=4',
        },
    ],
};

describe('battleReducer', () => {
    it('should start in connecting phase', () => {
        expect(initialBattleState.phase).toBe('connecting');
        expect(initialBattleState.currentRound).toBe(0);
        expect(initialBattleState.currentQuestion).toBeNull();
    });

    it('should transition to waiting_for_opponent on WS_CONNECTED', () => {
        const state = battleReducer(initialBattleState, { type: 'WS_CONNECTED' });
        expect(state.phase).toBe('waiting_for_opponent');
    });

    it('should set youReady flag on PLAYER_READY (you)', () => {
        const state = battleReducer(initialBattleState, {
            type: 'PLAYER_READY',
            payload: { isYou: true },
        });
        expect(state.youReady).toBe(true);
        expect(state.opponentReady).toBe(false);
    });

    it('should set opponentReady flag on PLAYER_READY (opponent)', () => {
        const state = battleReducer(initialBattleState, {
            type: 'PLAYER_READY',
            payload: { isYou: false },
        });
        expect(state.youReady).toBe(false);
        expect(state.opponentReady).toBe(true);
    });

    it('should transition to in_question on ROUND_START', () => {
        const thinkingEndsAt = new Date(Date.now() + 60000);
        const state = battleReducer(initialBattleState, {
            type: 'ROUND_START',
            payload: {
                roundId: 'round-1',
                roundIndex: 1,
                question: mockQuestion,
                thinkingEndsAt,
            },
        });

        expect(state.phase).toBe('in_question');
        expect(state.currentRound).toBe(1);
        expect(state.roundId).toBe('round-1');
        expect(state.currentQuestion).toEqual(mockQuestion);
        expect(state.roundPhase).toBe('thinking');
        expect(state.phaseDeadline).toEqual(thinkingEndsAt);
        expect(state.currentStepIndex).toBe(0);
        expect(state.selectedAnswer).toBeNull();
        expect(state.correctAnswer).toBeNull();
        expect(state.isSubmitting).toBe(false);
    });

    it('should update phase on PHASE_CHANGE', () => {
        const choosingEndsAt = new Date(Date.now() + 15000);

        // Start with a round
        let state = battleReducer(initialBattleState, {
            type: 'ROUND_START',
            payload: {
                roundId: 'round-1',
                roundIndex: 1,
                question: mockQuestion,
                thinkingEndsAt: new Date(),
            },
        });

        // Change to choosing phase
        state = battleReducer(state, {
            type: 'PHASE_CHANGE',
            payload: {
                phase: 'choosing',
                choosingEndsAt,
                currentStepIndex: 0,
            },
        });

        expect(state.roundPhase).toBe('choosing');
        expect(state.phaseDeadline).toEqual(choosingEndsAt);
        expect(state.currentStepIndex).toBe(0);
    });

    it('should mark answer as submitted on ANSWER_SUBMITTED', () => {
        // Start with question loaded
        let state = battleReducer(initialBattleState, {
            type: 'ROUND_START',
            payload: {
                roundId: 'round-1',
                roundIndex: 1,
                question: mockQuestion,
                thinkingEndsAt: new Date(),
            },
        });

        // Submit answer
        state = battleReducer(state, {
            type: 'ANSWER_SUBMITTED',
            payload: { answerIndex: 2 },
        });

        expect(state.selectedAnswer).toBe(2);
        expect(state.isSubmitting).toBe(true);
    });

    it('should transition to showing_result on ROUND_RESULT', () => {
        // Start with question and submitted answer
        let state = battleReducer(initialBattleState, {
            type: 'ROUND_START',
            payload: {
                roundId: 'round-1',
                roundIndex: 1,
                question: mockQuestion,
                thinkingEndsAt: new Date(),
            },
        });

        state = battleReducer(state, {
            type: 'ANSWER_SUBMITTED',
            payload: { answerIndex: 1 },
        });

        // Receive round result
        state = battleReducer(state, {
            type: 'ROUND_RESULT',
            payload: {
                roundIndex: 1,
                questionId: 'test-q-1',
                correctOptionId: 1,
                playerResults: [
                    { playerId: 'p1', selectedOptionId: 1, isCorrect: true },
                    { playerId: 'p2', selectedOptionId: 2, isCorrect: false },
                ],
                tugOfWar: 1,
                p1Score: 1,
                p2Score: 0,
            },
        });

        expect(state.phase).toBe('showing_result');
        expect(state.roundPhase).toBe('result');
        expect(state.correctAnswer).toBe(1);
        expect(state.tugOfWarPosition).toBe(1);
        expect(state.p1Score).toBe(1);
        expect(state.p2Score).toBe(0);
        expect(state.isSubmitting).toBe(false);
        expect(state.lastResult).toBeDefined();
    });

    it('should transition to match_over on MATCH_END', () => {
        const state = battleReducer(initialBattleState, {
            type: 'MATCH_END',
            payload: {
                winnerId: 'player-1',
            },
        });

        expect(state.phase).toBe('match_over');
        expect(state.winnerId).toBe('player-1');
    });

    it('should handle MATCH_END with no winner (draw)', () => {
        const state = battleReducer(initialBattleState, {
            type: 'MATCH_END',
            payload: {
                winnerId: null,
            },
        });

        expect(state.phase).toBe('match_over');
        expect(state.winnerId).toBeNull();
    });

    it('should reset isSubmitting on VALIDATION_ERROR', () => {
        // Start with submitted answer
        let state = battleReducer(initialBattleState, {
            type: 'ROUND_START',
            payload: {
                roundId: 'round-1',
                roundIndex: 1,
                question: mockQuestion,
                thinkingEndsAt: new Date(),
            },
        });

        state = battleReducer(state, {
            type: 'ANSWER_SUBMITTED',
            payload: { answerIndex: 1 },
        });

        expect(state.isSubmitting).toBe(true);

        // Receive validation error
        state = battleReducer(state, { type: 'VALIDATION_ERROR' });

        expect(state.isSubmitting).toBe(false);
    });

    it('should handle multi-round flow correctly', () => {
        // Round 1
        let state = battleReducer(initialBattleState, { type: 'WS_CONNECTED' });

        state = battleReducer(state, {
            type: 'ROUND_START',
            payload: {
                roundId: 'round-1',
                roundIndex: 1,
                question: mockQuestion,
                thinkingEndsAt: new Date(),
            },
        });

        expect(state.currentRound).toBe(1);
        expect(state.currentQuestion?.id).toBe('test-q-1');

        // Submit and result
        state = battleReducer(state, {
            type: 'ANSWER_SUBMITTED',
            payload: { answerIndex: 1 },
        });

        state = battleReducer(state, {
            type: 'ROUND_RESULT',
            payload: {
                roundIndex: 1,
                questionId: 'test-q-1',
                correctOptionId: 1,
                playerResults: [],
                tugOfWar: 1,
                p1Score: 1,
                p2Score: 0,
            },
        });

        expect(state.phase).toBe('showing_result');

        // Round 2 - state should reset question-specific fields
        const mockQuestion2: StepBasedQuestion = { ...mockQuestion, id: 'test-q-2' };

        state = battleReducer(state, {
            type: 'ROUND_START',
            payload: {
                roundId: 'round-2',
                roundIndex: 2,
                question: mockQuestion2,
                thinkingEndsAt: new Date(),
            },
        });

        expect(state.phase).toBe('in_question');
        expect(state.currentRound).toBe(2);
        expect(state.currentQuestion?.id).toBe('test-q-2');
        expect(state.selectedAnswer).toBeNull(); // Reset
        expect(state.correctAnswer).toBeNull(); // Reset
        expect(state.currentStepIndex).toBe(0); // Reset
        expect(state.p1Score).toBe(1); // Preserved from previous round
    });
});
