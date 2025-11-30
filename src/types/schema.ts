/**
 * Canonical Schema Types
 *
 * This is the single source of truth for the 1v1 battle system.
 * All database tables and TypeScript code must align with these types.
 */

// Question structure stored in database
export interface Question {
  id: string
  text: string
  steps: QuestionSteps // JSONB in database
  created_at: string
}

// Question steps structure (stored as JSONB)
export interface QuestionSteps {
  type: 'mcq' // Multiple choice question
  options: string[] // Array of answer options
  answer: number // Index of correct answer (0-3)
}

// Matchmaking queue entry
export interface MatchmakingQueueRow {
  id: string
  player_id: string
  status: 'waiting' | 'matched'
  created_at: string
}

// Match between two players
export interface MatchRow {
  id: string
  player1_id: string
  player2_id: string
  status: 'pending' | 'active' | 'finished'
  created_at: string
}

// WebSocket event types
export interface RoundStartEvent {
  type: 'ROUND_START'
  match_id: string
  question: Question
}

export interface GameErrorEvent {
  type: 'GAME_ERROR'
  message: string
}

export type GameEvent = RoundStartEvent | GameErrorEvent
