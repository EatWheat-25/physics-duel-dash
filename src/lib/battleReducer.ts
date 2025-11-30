/**
 * Battle State Machine Reducer
 * 
 * Pure reducer for managing online battle state transitions.
 * Handles all game phases: connecting, waiting, in-question, result, match-over.
 */

import { StepBasedQuestion } from '@/types/question-contract';
import { RoundPhase } from '@/types/gameEvents';

// ============================================================================
// STATE TYPES
// ============================================================================

export type BattlePhase =
    | 'connecting'
    | 'waiting_for_opponent'
    | 'countdown'
    | 'in_question'
    | 'showing_result'
    | 'match_over';

export interface RoundResult {
    roundIndex: number;
    questionId: string;
    correctOptionId: number;
    playerResults: Array<{
        playerId: string;
        selectedOptionId: number | null;
        isCorrect: boolean;
        timeTakenMs?: number;
    }>;
    tugOfWar: number;
    p1Score: number;
    p2Score: number;
}

export interface BattleState {
    // Phase Management
    phase: BattlePhase;

    // Match Info
    currentRound: number;
    totalRounds: number;
    roundId: string | null;

    // Question State
    currentQuestion: StepBasedQuestion | null;
    currentStepIndex: number;
    roundPhase: RoundPhase | null; // thinking, choosing, result
    phaseDeadline: Date | null;

    // Answer State
    selectedAnswer: number | null;
    correctAnswer: number | null;
    isSubmitting: boolean;

    // Match Results
    lastResult: RoundResult | null;
    tugOfWarPosition: number;
    p1Score: number;
    p2Score: number;
    winnerId: string | null;
}

// ============================================================================
// ACTIONS
// ============================================================================

export type BattleAction =
    | { type: 'WS_CONNECTED' }
    | {
        type: 'ROUND_START';
        payload: {
            roundId: string;
            roundIndex: number;
            question: StepBasedQuestion;
            thinkingEndsAt: Date;
        };
    }
    | {
        type: 'PHASE_CHANGE';
        payload: {
            phase: RoundPhase;
            choosingEndsAt?: Date;
            currentStepIndex?: number;
        };
    }
    | {
        type: 'ANSWER_SUBMITTED';
        payload: {
            answerIndex: number;
        };
    }
    | {
        type: 'ROUND_RESULT';
        payload: RoundResult;
    }
    | {
        type: 'MATCH_END';
        payload: {
            winnerId: string | null;
        };
    }
    | { type: 'VALIDATION_ERROR' }
    | { type: 'RESET_SUBMISSION' };

// ============================================================================
// INITIAL STATE
// ============================================================================

export const initialBattleState: BattleState = {
    phase: 'connecting',
    currentRound: 0,
    totalRounds: 5,
    roundId: null,
    currentQuestion: null,
    currentStepIndex: 0,
    roundPhase: null,
    phaseDeadline: null,
    selectedAnswer: null,
    correctAnswer: null,
    isSubmitting: false,
    lastResult: null,
    tugOfWarPosition: 0,
    p1Score: 0,
    p2Score: 0,
    winnerId: null,
};

// ============================================================================
// REDUCER
// ============================================================================

export function battleReducer(state: BattleState, action: BattleAction): BattleState {
    console.log('[Reducer]', action.type, action);

    switch (action.type) {
        case 'WS_CONNECTED':
            return {
                ...state,
                phase: 'waiting_for_opponent',
            };

        case 'ROUND_START':
            return {
                ...state,
                phase: 'in_question',
                currentRound: action.payload.roundIndex,
                roundId: action.payload.roundId,
                currentQuestion: action.payload.question,
                currentStepIndex: 0,
                roundPhase: 'thinking',
                phaseDeadline: action.payload.thinkingEndsAt,
                selectedAnswer: null,
                correctAnswer: null,
                isSubmitting: false,
                lastResult: null,
            };

        case 'PHASE_CHANGE':
            return {
                ...state,
                phase: 'in_question', // Ensure we exit 'showing_result' or other phases
                roundPhase: action.payload.phase,
                phaseDeadline: action.payload.choosingEndsAt || null,
                currentStepIndex: action.payload.currentStepIndex ?? state.currentStepIndex,
                // Reset selection for new phase/step
                selectedAnswer: null,
                correctAnswer: null,
                isSubmitting: false,
            };

        case 'ANSWER_SUBMITTED':
            return {
                ...state,
                selectedAnswer: action.payload.answerIndex,
                isSubmitting: true,
            };

        case 'ROUND_RESULT':
            return {
                ...state,
                phase: 'showing_result',
                roundPhase: 'result',
                lastResult: action.payload,
                correctAnswer: action.payload.correctOptionId,
                tugOfWarPosition: action.payload.tugOfWar,
                p1Score: action.payload.p1Score,
                p2Score: action.payload.p2Score,
                isSubmitting: false,
            };

        case 'MATCH_END':
            return {
                ...state,
                phase: 'match_over',
                winnerId: action.payload.winnerId,
            };

        case 'VALIDATION_ERROR':
            return {
                ...state,
                isSubmitting: false,
            };

        case 'RESET_SUBMISSION':
            return {
                ...state,
                isSubmitting: false,
                selectedAnswer: null,
            };

        default:
            return state;
    }
}
