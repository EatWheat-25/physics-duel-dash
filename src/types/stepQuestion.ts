// Step-by-step question system for CAIE-style marking scheme battles

export interface QuestionStep {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  marks: number;
  explanation: string;
  commonMistakes?: string[];
}

export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Unbeatable' | 'Pocket Calculator';

export interface StepBasedQuestion {
  id: string;
  title: string;
  subject: 'math' | 'physics' | 'chemistry';
  chapter: string;
  level: 'A1' | 'A2';
  difficulty: 'easy' | 'medium' | 'hard';
  rankTier: RankTier;
  totalMarks: number;
  steps: QuestionStep[];
  questionText: string; // The original CAIE question stem
  topicTags: string[];
}

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
  opponentAnswer: number;
  correct: boolean;
  marksEarned: number;
  explanation: string;
}

export interface BattleSession {
  questions: StepBasedQuestion[];
  progress: BattleProgress;
  results: StepResult[];
}

// Convert legacy Question format to StepBasedQuestion (single step)
export const convertLegacyQuestion = (legacyQuestion: any): StepBasedQuestion => {
  return {
    id: legacyQuestion.id || Math.random().toString(36),
    title: legacyQuestion.q.substring(0, 50) + '...',
    subject: 'math', // default
    chapter: legacyQuestion.chapter || 'general',
    level: legacyQuestion.level || 'A1',
    difficulty: legacyQuestion.difficulty || 'medium',
    rankTier: 'Bronze', // default rank tier
    totalMarks: 1,
    questionText: legacyQuestion.q,
    topicTags: [],
    steps: [
      {
        id: 'step-1',
        question: legacyQuestion.q,
        options: legacyQuestion.options,
        correctAnswer: legacyQuestion.answer,
        marks: 1,
        explanation: 'Step completed successfully.'
      }
    ]
  };
};