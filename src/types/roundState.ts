/**
 * Shared types for round state management
 * 
 * These types are used across:
 * - useMatchFlow.ts (client hook)
 * - game-ws/index.ts (server WebSocket handler)
 * - OnlineBattleNew.tsx (UI component)
 * 
 * Keeping them in a neutral file prevents circular imports.
 */

/**
 * Round result from ROUND_RESULT message
 */
export type RoundResult = {
  roundWinnerId: string | null
  player1RoundScore: number
  player2RoundScore: number
  matchContinues: boolean
  matchWinnerId: string | null
}

/**
 * Server-driven round phase
 */
export type RoundPhase = 'thinking' | 'step' | 'waiting' | 'results'

/**
 * RoundStateMsg - Authoritative server state
 * Sent by server to clients to synchronize round state
 */
export interface RoundStateMsg {
  type: 'ROUND_STATE'
  matchId: string
  roundId: string
  roundNumber: number
  phase: RoundPhase
  currentStepIndex: number // -1 for thinking, 0+ for step index
  deadlineTs: number | null // Unix timestamp (ms) - authoritative deadline
  // Per-player step tracking
  player1CurrentStep: number // Which step player1 is on (-1 = thinking, 0+ = step)
  player2CurrentStep: number // Which step player2 is on
  player1HasAnswered: boolean // Has player1 answered current step/round?
  player2HasAnswered: boolean // Has player2 answered current step/round?
  player1Score: number // Current match score
  player2Score: number // Current match score
  question: any | null // StepBasedQuestion (null if phase === 'results')
  roundResult: RoundResult | null // Only set when phase === 'results'
}

