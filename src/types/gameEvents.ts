/**
 * Game Event Types for 3-Phase Round System
 *
 * These types define the WebSocket protocol between the game server
 * and clients during Online 1v1 matches.
 */

export type RoundPhase = 'thinking' | 'choosing' | 'result';

export interface QuestionDTO {
  id: string;
  title: string;
  subject: string;
  chapter: string;
  level: string;
  difficulty: string;
  questionText: string;
  totalMarks: number;
  steps: Array<{
    id: string;
    question: string;
    options: string[];
    correctAnswer: number;
    marks: number;
    explanation?: string;
  }>;
  topicTags?: string[];
  rankTier?: string;
}

export interface OptionDTO {
  id: number;
  text: string;
}

export interface PlayerResult {
  playerId: string;
  selectedOptionId: number | null;
  isCorrect: boolean;
  timeTakenMs?: number;
}

// Server → Client Events

export interface RoundStartEvent {
  type: 'ROUND_START';
  matchId: string;
  roundId: string;
  roundIndex: number;
  phase: 'thinking';
  question: QuestionDTO;
  thinkingEndsAt: string; // ISO timestamp
}

export interface PhaseChangeEvent {
  type: 'PHASE_CHANGE';
  matchId: string;
  roundIndex: number;
  phase: 'choosing' | 'result';
  choosingEndsAt?: string; // ISO timestamp, present when phase = 'choosing'
  options?: OptionDTO[]; // present when phase = 'choosing'
  currentStepIndex?: number; // Current step index (0-based)
  totalSteps?: number; // Total number of steps in the question
}

export interface RoundResultEvent {
  type: 'ROUND_RESULT';
  matchId: string;
  roundIndex: number;
  questionId: string;
  correctOptionId: number;
  playerResults: PlayerResult[];
  tugOfWar: number; // Score difference for tug-of-war bar
  p1Score: number;
  p2Score: number;
}

export interface MatchEndEvent {
  type: 'MATCH_END';
  matchId: string;
  winnerPlayerId: string | null;
  summary: {
    roundsPlayed: number;
    finalScores: {
      p1: number;
      p2: number;
    };
  };
  mmrChanges?: {
    [playerId: string]: {
      old: number;
      new: number;
    };
  };
}

// Client → Server Events

export interface AnswerSubmitMessage {
  type: 'answer_submit';
  questionId: string;
  stepId: string;
  answer: number; // Option index (0..options length - 1)
}

export interface ReadyForOptionsMessage {
  type: 'ready_for_options';
  matchId: string;
}

// Union type for all server events
export type ServerGameEvent =
  | RoundStartEvent
  | PhaseChangeEvent
  | RoundResultEvent
  | MatchEndEvent;

// Union type for all client messages
export type ClientGameMessage = AnswerSubmitMessage | ReadyForOptionsMessage;
