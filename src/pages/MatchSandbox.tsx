/**
 * Match Sandbox - Development Only
 * 
 * Test the match UI without connecting to real backend.
 * Uses mock WebSocket that simulates full match flow.
 */

import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

// Components
import { GameLayout } from '@/components/game/GameLayout';
import { GameHeader } from '@/components/game/GameHeader';
import { ActiveQuestion } from '@/components/game/ActiveQuestion';
import { PhaseOverlay } from '@/components/game/PhaseOverlay';

// State Management
import { battleReducer, initialBattleState } from '@/lib/battleReducer';
import { createMockGameWS, MockServerMessage } from '@/lib/mockWS';
import { mapRawQuestionToStepBasedQuestion } from '@/utils/questionMapper';

const MatchSandbox = () => {
    const navigate = useNavigate();

    // Dev-only guard - redirect in production
    useEffect(() => {
        if (import.meta.env.PROD) {
            navigate('/');
        }
    }, [navigate]);

    // Core State
    const [state, dispatch] = useReducer(battleReducer, initialBattleState);

    // Mock data
    const [yourUsername] = useState('DevPlayer1');
    const [opponentUsername] = useState('DevPlayer2');
    const mockWsRef = useRef<ReturnType<typeof createMockGameWS> | null>(null);

    // Mock user - always p1
    const currentUser = 'mock-player-1';
    const isPlayer1 = true;

    // WebSocket Message Handler
    const handleWSMessage = useCallback(
        (message: MockServerMessage) => {
            console.log('[Sandbox] Processing message:', message.type, message);

            switch (message.type) {
                case 'connected':
                    dispatch({ type: 'WS_CONNECTED' });
                    break;

                case 'ROUND_START':
                    try {
                        console.log('[Sandbox] ROUND_START - Raw question:', message.question);
                        const mappedQuestion = mapRawQuestionToStepBasedQuestion(message.question);
                        console.log('[Sandbox] ROUND_START - Mapped question:', mappedQuestion);

                        dispatch({
                            type: 'ROUND_START',
                            payload: {
                                roundId: message.roundId,
                                roundIndex: message.roundIndex,
                                question: mappedQuestion,
                                thinkingEndsAt: new Date(message.thinkingEndsAt),
                            },
                        });
                    } catch (e) {
                        console.error('[Sandbox] Error mapping question:', e);
                    }
                    break;

                case 'PHASE_CHANGE':
                    console.log('[Sandbox] PHASE_CHANGE:', message.phase);
                    dispatch({
                        type: 'PHASE_CHANGE',
                        payload: {
                            phase: message.phase,
                            choosingEndsAt: message.choosingEndsAt
                                ? new Date(message.choosingEndsAt)
                                : undefined,
                            currentStepIndex: message.currentStepIndex,
                        },
                    });
                    break;

                case 'ROUND_RESULT':
                    console.log('[Sandbox] ROUND_RESULT:', message);
                    dispatch({
                        type: 'ROUND_RESULT',
                        payload: {
                            roundIndex: message.roundIndex,
                            questionId: message.questionId,
                            correctOptionId: message.correctOptionId,
                            playerResults: message.playerResults,
                            tugOfWar: message.tugOfWar,
                            p1Score: message.p1Score,
                            p2Score: message.p2Score,
                        },
                    });
                    break;

                case 'MATCH_END':
                    console.log('[Sandbox] MATCH_END:', message);
                    dispatch({
                        type: 'MATCH_END',
                        payload: {
                            winnerId: message.winnerPlayerId,
                        },
                    });
                    break;

                case 'validation_error':
                    console.error('[Sandbox] Validation error:', message.message);
                    dispatch({ type: 'VALIDATION_ERROR' });
                    break;

                default:
                    console.warn('[Sandbox] Unknown message type:', (message as any).type);
            }
        },
        []
    );

    // Answer Handler
    const handleAnswer = useCallback(
        (index: number) => {
            if (!mockWsRef.current || state.isSubmitting) return;

            const currentQ = state.currentQuestion;
            const currentStep = currentQ?.steps[state.currentStepIndex];

            if (!currentQ || !currentStep) return;

            console.log('[Sandbox] Submitting answer:', index);

            // Optimistic update
            dispatch({ type: 'ANSWER_SUBMITTED', payload: { answerIndex: index } });

            // Send to mock WS (just for logging)
            mockWsRef.current.send(
                JSON.stringify({
                    type: 'submit_answer',
                    question_id: currentQ.id,
                    step_id: currentStep.id,
                    answer_index: index,
                })
            );
        },
        [state.currentQuestion, state.currentStepIndex, state.isSubmitting]
    );

    // Reset Handler
    const handleReset = () => {
        mockWsRef.current?.close();
        window.location.reload();
    };

    // Setup Mock WebSocket
    useEffect(() => {
        console.log('[Sandbox] Setting up mock WebSocket');

        const mockWs = createMockGameWS('mock-match-123', handleWSMessage);
        mockWsRef.current = mockWs;

        return () => {
            mockWs.close();
        };
    }, [handleWSMessage]);

    // -- Render Based on Phase --

    // Loading/Connecting
    if (state.phase === 'connecting') {
        return (
            <GameLayout className="items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                    <h2 className="text-2xl font-bold text-white">Connecting to Mock Battle...</h2>
                    <p className="text-sm text-muted-foreground">(Dev Sandbox Mode)</p>
                </div>
            </GameLayout>
        );
    }

    // Waiting for Opponent
    if (state.phase === 'waiting_for_opponent') {
        return (
            <GameLayout className="items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                    <h2 className="text-2xl font-bold text-white">Waiting for match to start...</h2>
                    <p className="text-sm text-muted-foreground">(Simulated - Dev Mode)</p>
                </div>
            </GameLayout>
        );
    }

    // Match Over
    if (state.phase === 'match_over') {
        const won = state.winnerId === currentUser;
        const draw = !state.winnerId;

        return (
            <GameLayout className="items-center justify-center">
                <PhaseOverlay
                    isVisible={true}
                    type={draw ? 'draw' : won ? 'victory' : 'defeat'}
                    title={draw ? 'DRAW' : won ? 'VICTORY!' : 'DEFEAT'}
                    subtitle={draw ? 'Well Played!' : won ? 'You Won!' : 'Better Luck Next Time'}
                />
                <div className="mt-8 space-x-4">
                    <button
                        onClick={handleReset}
                        className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
                    >
                        Restart Sandbox
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition"
                    >
                        Back to Home
                    </button>
                </div>
            </GameLayout>
        );
    }

    // In-Question Phase
    const currentQ = state.currentQuestion;
    const currentStep = currentQ?.steps[state.currentStepIndex];
    const myScore = isPlayer1 ? state.p1Score : state.p2Score;
    const oppScore = isPlayer1 ? state.p2Score : state.p1Score;

    return (
        <GameLayout>
            {/* Dev Mode Badge */}
            <div className="absolute top-2 right-2 z-50 px-3 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded-full text-xs font-bold text-yellow-300 uppercase">
                Dev Sandbox
            </div>

            <GameHeader
                player={{ username: yourUsername }}
                opponent={{ username: opponentUsername }}
                currentRound={state.currentRound}
                totalRounds={state.totalRounds}
                tugPosition={state.tugOfWarPosition}
                maxSteps={10}
                onBack={() => navigate('/')}
            />

            <div className="flex-1 flex items-center justify-center py-8">
                {currentQ && currentStep ? (
                    <ActiveQuestion
                        question={{
                            id: currentQ.id,
                            text: currentStep.prompt,
                            options: currentStep.options,
                            imageUrl: currentQ.imageUrl,
                        }}
                        phase={state.roundPhase || 'thinking'}
                        timeLeft={state.phaseDeadline ? state.phaseDeadline.getTime() - Date.now() : 0}
                        totalTime={state.roundPhase === 'thinking' ? 60000 : 15000}
                        selectedIndex={state.selectedAnswer}
                        correctIndex={state.roundPhase === 'result' ? state.correctAnswer : null}
                        onAnswer={handleAnswer}
                    />
                ) : (
                    <div className="text-center text-muted-foreground">Waiting for next round...</div>
                )}
            </div>

            {/* Show result overlay */}
            {state.phase === 'showing_result' && state.lastResult && (
                <PhaseOverlay
                    isVisible={true}
                    type="round_start"
                    title={`Round ${state.lastResult.roundIndex} Complete`}
                    subtitle={`Score: ${myScore} - ${oppScore}`}
                />
            )}

            {/* Reset Button (bottom right) */}
            <button
                onClick={handleReset}
                className="absolute bottom-4 right-4 z-50 px-4 py-2 bg-black/60 hover:bg-black/80 border border-white/20 rounded-lg text-sm text-white transition"
            >
                Reset Sandbox
            </button>
        </GameLayout>
    );
};

export default MatchSandbox;
