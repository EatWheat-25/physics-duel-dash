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

// Step in a step-based question (CAIE marking scheme style)
export interface QuestionStep {
  id: string;
  question: string;
  options: [string, string, string, string]; // EXACTLY 4 options
  correctAnswer: 0 | 1 | 2 | 3; // Index into options array
  marks: number;
  explanation: string;
  commonMistakes?: string[];
  timeLimitSeconds?: number;
}

// Subject type (matches DB constraint)
export type QuestionSubject = 'math' | 'physics' | 'chemistry';

// Level type (matches DB constraint)
export type QuestionLevel = 'A1' | 'A2';

// Difficulty type (matches DB constraint)
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

// Rank tier for progression system
export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Unbeatable' | 'Pocket Calculator';

// Complete question structure
export interface StepBasedQuestion {
  id: string;
  title: string;
  subject: QuestionSubject;
  chapter: string;
  level: QuestionLevel;
  difficulty: QuestionDifficulty;
  rankTier?: RankTier;
  totalMarks: number;
  questionText: string;
  topicTags: string[];
  steps: QuestionStep[];
  imageUrl?: string;
}

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
