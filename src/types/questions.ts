/**
 * CANONICAL QUESTION TYPES - SINGLE SOURCE OF TRUTH
 *
 * These types define the structure for ALL questions in the system.
 * They are used by:
 * - Database schema (questions table)
 * - Seed script (scripts/seed-questions.ts)
 * - Admin Questions page
 * - Step-battle modes
 * - Online matchmaking/WebSocket
 *
 * DO NOT create duplicate types elsewhere - import from here!
 */

// Subject type (matches DB constraint)
export type QuestionSubject = 'math' | 'physics' | 'chemistry';

// Level type (matches DB constraint)
export type QuestionLevel = 'A1' | 'A2';

// Difficulty type (matches DB constraint)
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

// Rank tier for progression system
export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Unbeatable' | 'Pocket Calculator';

// Step in a step-based question (CAIE marking scheme style)
export type QuestionStep = {
  id: string;
  index: number;            // step order, 0-based or 1-based but consistent
  title?: string | null;
  prompt: string;
  options: string[];
  correctAnswer?: number;   // index of correct option, optional on client
  timeLimitSeconds?: number | null;
  marks?: number | null;
  explanation?: string;     // Keeping this as it's useful for frontend display if available
};

// Complete question structure
export type StepBasedQuestion = {
  id: string;
  title: string;
  subject: string;
  chapter: string;
  rank_tier: string;
  level: string;
  difficulty: string;
  stem: string;
  total_marks: number;
  topic_tags?: string[];
  steps: QuestionStep[];
  imageUrl?: string; // Keeping for compatibility if needed, though not in user spec
};

// Database row shape (snake_case from Supabase)
export interface QuestionDBRow {
  id: string;
  title: string;
  subject: string;
  chapter: string;
  level: string;
  difficulty: string;
  rank_tier: string | null;
  question_text: string;
  total_marks: number;
  topic_tags: string[];
  steps: unknown; // JSONB in database
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

// For creating/updating questions (omit auto-generated fields)
export type QuestionInput = Omit<StepBasedQuestion, 'id'> & {
  id?: string; // Optional for upserts
};

// Battle-related types
export interface BattleProgress {
  currentQuestionIndex: number;
  currentStepIndex: number;
  playerMarks: number;
  opponentMarks: number;
  totalPossibleMarks: number;
  completed: boolean;
}

export interface StepResult {
  stepId: string;
  playerAnswer: number;
  opponentAnswer?: number;
  correct: boolean;
  marksEarned: number;
  explanation: string;
}

export interface BattleSession {
  questions: StepBasedQuestion[];
  progress: BattleProgress;
  results: StepResult[];
}

// Query filters for fetching questions
export interface QuestionFilters {
  subject?: QuestionSubject;
  chapter?: string;
  level?: QuestionLevel;
  difficulty?: QuestionDifficulty;
  rankTier?: RankTier;
  limit?: number;
}
