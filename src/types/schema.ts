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
  subject?: string // 'math' | 'physics' | 'chemistry'
  level?: string // 'A1' | 'A2'
  steps: QuestionSteps // JSONB in database
  created_at: string
}

// Question steps structure (stored as JSONB)
export interface QuestionSteps {
  type: 'mcq' // Multiple choice question
  options: string[] // Array of answer options
  answer: number // Index of correct answer (0-5) depending on option count
}

// Matchmaking queue entry
export interface MatchmakingQueueRow {
  id: string
  player_id: string
  status: 'waiting' | 'matched'
  subject?: string // 'math' | 'physics' | 'chemistry'
  level?: string // 'A1' | 'A2'
  created_at: string
}

// Match between two players (supports both old and new table schemas)
export interface MatchRow {
  id: string
  // New schema (matches_new table)
  p1?: string
  p2?: string
  state?: string
  chapter?: string
  rank_tier?: string | null
  p1_score?: number | null
  p2_score?: number | null
  ended_at?: string | null
  // Old schema (matches table) - backwards compatibility
  player1_id?: string
  player2_id?: string
  status?: 'pending' | 'in_progress' | 'finished' | 'abandoned'
  subject?: string // 'math' | 'physics' | 'chemistry'
  mode?: string // 'A1' | 'A2' (level)
  target_points?: number
  max_rounds?: number
  player1_score?: number
  player2_score?: number
  winner_id?: string | null
  started_at?: string
  completed_at?: string
  current_round_number?: number
  rules_version?: number
  created_at?: string
}

// Match round - tracks which question is assigned to a match
export interface MatchRoundRow {
  id: string
  match_id: string
  question_id: string
  round_number?: number
  status: 'active' | 'evaluating' | 'finished'
  player1_round_score?: number
  player2_round_score?: number
  player1_answered_at?: string | null
  player2_answered_at?: string | null
  player1_answer_payload?: any | null
  player2_answer_payload?: any | null
  round_deadline?: string | null
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
