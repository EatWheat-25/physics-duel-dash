/**
 * Game Event Types for 3-Phase Round System
 *
 * These types define the WebSocket protocol between the game server
 * and clients during Online 1v1 matches.
 */

export type RoundPhase = 'thinking' | 'choosing' | 'result' | 'main_question' | 'steps';

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
  phase: 'thinking' | 'main_question';
  question: QuestionDTO;
  thinkingEndsAt?: string; // ISO timestamp
  mainQuestionEndsAt?: string; // ISO timestamp
  mainQuestionTimerSeconds?: number;
  totalSteps?: number;
}

export interface PhaseChangeEvent {
  type: 'PHASE_CHANGE';
  matchId: string;
  roundIndex?: number;
  phase: 'choosing' | 'result' | 'steps';
  choosingEndsAt?: string; // ISO timestamp, present when phase = 'choosing'
  options?: OptionDTO[]; // present when phase = 'choosing'
  currentStepIndex?: number; // Current step index (0-based)
  stepIndex?: number; // Current step index (0-based) - for steps phase
  totalSteps?: number; // Total number of steps in the question
  stepEndsAt?: string; // ISO timestamp, present when phase = 'steps'
  currentStep?: {
    id: string;
    prompt: string;
    options: string[];
    correctAnswer: number;
    marks: number;
  };
}

export interface RoundResultEvent {
  type: 'ROUND_RESULT';
  matchId: string;
  roundIndex: number;
  questionId: string;
  correctOptionId: number;
  playerResults: PlayerResult[];
  tugOfWar?: number; // Score difference for tug-of-war bar (deprecated, kept for compatibility)
  p1Score: number;
  p2Score: number;
  stepResults?: Array<{
    stepIndex: number;
    correctAnswer: number;
    p1AnswerIndex: number | null;
    p2AnswerIndex: number | null;
    p1Marks: number;
    p2Marks: number;
  }>;
  roundNumber?: number;
  targetRoundsToWin?: number;
  playerRoundWins?: { [playerId: string]: number };
  matchOver?: boolean;
  matchWinnerId?: string | null;
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
  answer: number; // Option index (0, 1, or 2)
}

export interface ReadyForOptionsMessage {
  type: 'ready_for_options';
  matchId: string;
}

export interface EarlyAnswerMessage {
  type: 'EARLY_ANSWER';
}

export interface SubmitStepAnswerMessage {
  type: 'SUBMIT_STEP_ANSWER';
  stepIndex: number;
  answerIndex: number;
}

export interface StepAnswerReceivedEvent {
  type: 'STEP_ANSWER_RECEIVED';
  stepIndex: number;
  playerId: string;
  waitingForOpponent: boolean;
}

export interface AllStepsCompleteWaitingEvent {
  type: 'ALL_STEPS_COMPLETE_WAITING';
  matchId: string;
  p1Complete: boolean;
  p2Complete: boolean;
  waitingForOpponent: boolean;
}

export interface ReadyForNextRoundEvent {
  type: 'READY_FOR_NEXT_ROUND';
  playerId: string;
  waitingForOpponent: boolean;
}

// Union type for all server events
export type ServerGameEvent =
  | RoundStartEvent
  | PhaseChangeEvent
  | RoundResultEvent
  | MatchEndEvent
  | StepAnswerReceivedEvent
  | AllStepsCompleteWaitingEvent
  | ReadyForNextRoundEvent;

// Client → Server Messages
export interface ReadyForNextRoundMessage {
  type: 'READY_FOR_NEXT_ROUND';
}

// Union type for all client messages
export type ClientGameMessage = AnswerSubmitMessage | ReadyForOptionsMessage | EarlyAnswerMessage | SubmitStepAnswerMessage | ReadyForNextRoundMessage;
