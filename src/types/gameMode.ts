// Game Mode System for Rank-Gated Mathematics Learning
// Three variants: A1-Only, A2-Only, All-Maths (A1→A2)

export type GameMode = 'A1-Only' | 'A2-Only' | 'All-Maths';
export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Unbeatable' | 'Pocket Calculator';
export type SubRank = 1 | 2 | 3;
export type Difficulty = 'Easy' | 'Med' | 'Hard' | 'A★';

export interface RankName {
  tier: RankTier;
  subRank: SubRank;
}

export interface GameRank {
  tier: RankTier;
  subRank: SubRank;
  minPoints: number;
  maxPoints: number;
  emoji: string;
  color: string;
  gradient: string;
  glowColor: string;
  displayName: string;
  isElite?: boolean; // For Pocket Calculator ranks
}

export interface Chapter {
  id: string;
  name: string;
  description: string;
  syllabus: 'A1' | 'A2';
  icon: string;
  order: number;
}

export interface RankChapterMapping {
  mode: GameMode;
  rank: RankName;
  chapters: string[]; // Chapter IDs unlocked at this rank
  newChapters: string[]; // New chapters introduced at this rank
}

export interface GameQuestion {
  id: string;
  mode: GameMode;
  chapter: string;
  rank: RankName;
  difficulty: Difficulty;
  questionText: string;
  steps: QuestionStep[];
  totalMarks: number;
  estimatedTime: number; // minutes
  topicTags: string[];
  caieYear?: number; // Source CAIE paper year
  caieVariant?: string; // Paper variant (e.g., "31", "32")
}

export interface QuestionStep {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  marks: number;
  explanation: string;
  commonMistakes?: string[];
}

export interface UserGameProgress {
  mode: GameMode;
  currentRank: RankName;
  currentPoints: number;
  questionsAttempted: number;
  questionsCorrect: number;
  rankAccuracy: number; // Accuracy at current rank
  promotionProgress: number; // Progress towards 80% threshold
  canPromote: boolean; // Has achieved 80%+ accuracy
  totalMatches: number;
  wins: number;
  losses: number;
  winStreak: number;
  leaderboardPosition?: number; // For Pocket Calculator eligibility
}

export interface GameSession {
  mode: GameMode;
  questions: GameQuestion[];
  currentQuestionIndex: number;
  playerScore: number;
  opponentScore: number;
  sessionId: string;
  startTime: Date;
}

// Global game rules and constants
export const GAME_RULES = {
  QUESTIONS_PER_RANK: 200, // Minimum questions per rank
  PROMOTION_THRESHOLD: 0.8, // 80% accuracy required for promotion
  POCKET_CALCULATOR_LIMIT: 1000, // Top 1,000 players only
  QUESTIONS_PER_BATTLE: 5, // Questions per match
  WIN_POINTS: 25,
  LOSS_POINTS: -15
} as const;

// Chapter progression mappings for each game mode
export const CHAPTER_PROGRESSIONS: Record<GameMode, RankChapterMapping[]> = {
  'A1-Only': [
    // Bronze Tier (A1 Basics)
    {
      mode: 'A1-Only',
      rank: { tier: 'Bronze', subRank: 1 },
      chapters: ['indices-surds', 'linear-equations'],
      newChapters: ['indices-surds', 'linear-equations']
    },
    {
      mode: 'A1-Only',
      rank: { tier: 'Bronze', subRank: 2 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics'],
      newChapters: ['quadratics']
    },
    {
      mode: 'A1-Only',
      rank: { tier: 'Bronze', subRank: 3 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions'],
      newChapters: ['basic-functions']
    },
    // Silver Tier (Core Algebra & Geometry)
    {
      mode: 'A1-Only',
      rank: { tier: 'Silver', subRank: 1 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials'],
      newChapters: ['polynomials']
    },
    {
      mode: 'A1-Only',
      rank: { tier: 'Silver', subRank: 2 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry'],
      newChapters: ['coordinate-geometry']
    },
    {
      mode: 'A1-Only',
      rank: { tier: 'Silver', subRank: 3 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs'],
      newChapters: ['circular-measure', 'exponentials-logs']
    },
    // Gold Tier (Series, Trig, Calculus Intro)
    {
      mode: 'A1-Only',
      rank: { tier: 'Gold', subRank: 1 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series'],
      newChapters: ['sequences-series']
    },
    {
      mode: 'A1-Only',
      rank: { tier: 'Gold', subRank: 2 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series', 'binomial-expansion'],
      newChapters: ['binomial-expansion']
    },
    {
      mode: 'A1-Only',
      rank: { tier: 'Gold', subRank: 3 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series', 'binomial-expansion', 'trigonometry-1', 'differentiation-1'],
      newChapters: ['trigonometry-1', 'differentiation-1']
    },
    // Diamond Tier (A1 Integration, Trig II, Vectors I)
    {
      mode: 'A1-Only',
      rank: { tier: 'Diamond', subRank: 1 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series', 'binomial-expansion', 'trigonometry-1', 'differentiation-1', 'integration-1'],
      newChapters: ['integration-1']
    },
    {
      mode: 'A1-Only',
      rank: { tier: 'Diamond', subRank: 2 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series', 'binomial-expansion', 'trigonometry-1', 'differentiation-1', 'integration-1', 'trigonometry-2'],
      newChapters: ['trigonometry-2']
    },
    {
      mode: 'A1-Only',
      rank: { tier: 'Diamond', subRank: 3 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series', 'binomial-expansion', 'trigonometry-1', 'differentiation-1', 'integration-1', 'trigonometry-2', 'vectors-1'],
      newChapters: ['vectors-1']
    },
    // Unbeatable (A1 Mastery)
    {
      mode: 'A1-Only',
      rank: { tier: 'Unbeatable', subRank: 1 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series', 'binomial-expansion', 'trigonometry-1', 'differentiation-1', 'integration-1', 'trigonometry-2', 'vectors-1', 'a1-mixed-problems'],
      newChapters: ['a1-mixed-problems']
    },
    {
      mode: 'A1-Only',
      rank: { tier: 'Unbeatable', subRank: 2 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series', 'binomial-expansion', 'trigonometry-1', 'differentiation-1', 'integration-1', 'trigonometry-2', 'vectors-1', 'a1-mixed-problems', 'hard-binomial'],
      newChapters: ['hard-binomial']
    },
    {
      mode: 'A1-Only',
      rank: { tier: 'Unbeatable', subRank: 3 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series', 'binomial-expansion', 'trigonometry-1', 'differentiation-1', 'integration-1', 'trigonometry-2', 'vectors-1', 'a1-mixed-problems', 'hard-binomial', 'advanced-calculus-a1'],
      newChapters: ['advanced-calculus-a1']
    },
    // Pocket Calculator (A★ A1)
    {
      mode: 'A1-Only',
      rank: { tier: 'Pocket Calculator', subRank: 1 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series', 'binomial-expansion', 'trigonometry-1', 'differentiation-1', 'integration-1', 'trigonometry-2', 'vectors-1', 'a1-mixed-problems', 'hard-binomial', 'advanced-calculus-a1', 'a1-olympiad'],
      newChapters: ['a1-olympiad']
    }
  ],
  
  'A2-Only': [
    // Bronze Tier (A2 Foundations)
    {
      mode: 'A2-Only',
      rank: { tier: 'Bronze', subRank: 1 },
      chapters: ['functions-advanced', 'trigonometry-3'],
      newChapters: ['functions-advanced', 'trigonometry-3']
    },
    {
      mode: 'A2-Only',
      rank: { tier: 'Bronze', subRank: 2 },
      chapters: ['functions-advanced', 'trigonometry-3', 'exponential-log-advanced'],
      newChapters: ['exponential-log-advanced']
    },
    {
      mode: 'A2-Only',
      rank: { tier: 'Bronze', subRank: 3 },
      chapters: ['functions-advanced', 'trigonometry-3', 'exponential-log-advanced'],
      newChapters: []
    },
    // Silver Tier (A2 Algebra & Calculus Tools)
    {
      mode: 'A2-Only',
      rank: { tier: 'Silver', subRank: 1 },
      chapters: ['functions-advanced', 'trigonometry-3', 'exponential-log-advanced', 'partial-fractions'],
      newChapters: ['partial-fractions']
    },
    {
      mode: 'A2-Only',
      rank: { tier: 'Silver', subRank: 2 },
      chapters: ['functions-advanced', 'trigonometry-3', 'exponential-log-advanced', 'partial-fractions', 'differentiation-2'],
      newChapters: ['differentiation-2']
    },
    {
      mode: 'A2-Only',
      rank: { tier: 'Silver', subRank: 3 },
      chapters: ['functions-advanced', 'trigonometry-3', 'exponential-log-advanced', 'partial-fractions', 'differentiation-2', 'integration-2'],
      newChapters: ['integration-2']
    },
    // Gold Tier (Advanced Calculus & Trig Mastery)
    {
      mode: 'A2-Only',
      rank: { tier: 'Gold', subRank: 1 },
      chapters: ['functions-advanced', 'trigonometry-3', 'exponential-log-advanced', 'partial-fractions', 'differentiation-2', 'integration-2', 'integration-3'],
      newChapters: ['integration-3']
    },
    {
      mode: 'A2-Only',
      rank: { tier: 'Gold', subRank: 2 },
      chapters: ['functions-advanced', 'trigonometry-3', 'exponential-log-advanced', 'partial-fractions', 'differentiation-2', 'integration-2', 'integration-3', 'trig-identities-advanced'],
      newChapters: ['trig-identities-advanced']
    },
    {
      mode: 'A2-Only',
      rank: { tier: 'Gold', subRank: 3 },
      chapters: ['functions-advanced', 'trigonometry-3', 'exponential-log-advanced', 'partial-fractions', 'differentiation-2', 'integration-2', 'integration-3', 'trig-identities-advanced', 'numerical-methods'],
      newChapters: ['numerical-methods']
    },
    // Diamond Tier (Vectors II & Differential Equations I)
    {
      mode: 'A2-Only',
      rank: { tier: 'Diamond', subRank: 1 },
      chapters: ['functions-advanced', 'trigonometry-3', 'exponential-log-advanced', 'partial-fractions', 'differentiation-2', 'integration-2', 'integration-3', 'trig-identities-advanced', 'numerical-methods', 'vectors-3d'],
      newChapters: ['vectors-3d']
    },
    {
      mode: 'A2-Only',
      rank: { tier: 'Diamond', subRank: 2 },
      chapters: ['functions-advanced', 'trigonometry-3', 'exponential-log-advanced', 'partial-fractions', 'differentiation-2', 'integration-2', 'integration-3', 'trig-identities-advanced', 'numerical-methods', 'vectors-3d', 'differential-equations-1'],
      newChapters: ['differential-equations-1']
    },
    {
      mode: 'A2-Only',
      rank: { tier: 'Diamond', subRank: 3 },
      chapters: ['functions-advanced', 'trigonometry-3', 'exponential-log-advanced', 'partial-fractions', 'differentiation-2', 'integration-2', 'integration-3', 'trig-identities-advanced', 'numerical-methods', 'vectors-3d', 'differential-equations-1', 'parametric-advanced'],
      newChapters: ['parametric-advanced']
    },
    // Unbeatable (A2 Hard)
    {
      mode: 'A2-Only',
      rank: { tier: 'Unbeatable', subRank: 1 },
      chapters: ['functions-advanced', 'trigonometry-3', 'exponential-log-advanced', 'partial-fractions', 'differentiation-2', 'integration-2', 'integration-3', 'trig-identities-advanced', 'numerical-methods', 'vectors-3d', 'differential-equations-1', 'parametric-advanced', 'multi-technique-integrals'],
      newChapters: ['multi-technique-integrals']
    },
    {
      mode: 'A2-Only',
      rank: { tier: 'Unbeatable', subRank: 2 },
      chapters: ['functions-advanced', 'trigonometry-3', 'exponential-log-advanced', 'partial-fractions', 'differentiation-2', 'integration-2', 'integration-3', 'trig-identities-advanced', 'numerical-methods', 'vectors-3d', 'differential-equations-1', 'parametric-advanced', 'multi-technique-integrals', 'implicit-parametric-advanced'],
      newChapters: ['implicit-parametric-advanced']
    },
    {
      mode: 'A2-Only',
      rank: { tier: 'Unbeatable', subRank: 3 },
      chapters: ['functions-advanced', 'trigonometry-3', 'exponential-log-advanced', 'partial-fractions', 'differentiation-2', 'integration-2', 'integration-3', 'trig-identities-advanced', 'numerical-methods', 'vectors-3d', 'differential-equations-1', 'parametric-advanced', 'multi-technique-integrals', 'implicit-parametric-advanced', 'de-modeling'],
      newChapters: ['de-modeling']
    },
    // Pocket Calculator (Max Difficulty A2)
    {
      mode: 'A2-Only',
      rank: { tier: 'Pocket Calculator', subRank: 1 },
      chapters: ['functions-advanced', 'trigonometry-3', 'exponential-log-advanced', 'partial-fractions', 'differentiation-2', 'integration-2', 'integration-3', 'trig-identities-advanced', 'numerical-methods', 'vectors-3d', 'differential-equations-1', 'parametric-advanced', 'multi-technique-integrals', 'implicit-parametric-advanced', 'de-modeling', 'a2-composites'],
      newChapters: ['a2-composites']
    }
  ],
  
  'All-Maths': [
    // Bronze Tier (A1 Start)
    {
      mode: 'All-Maths',
      rank: { tier: 'Bronze', subRank: 1 },
      chapters: ['indices-surds', 'linear-equations'],
      newChapters: ['indices-surds', 'linear-equations']
    },
    {
      mode: 'All-Maths',
      rank: { tier: 'Bronze', subRank: 2 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics'],
      newChapters: ['quadratics']
    },
    {
      mode: 'All-Maths',
      rank: { tier: 'Bronze', subRank: 3 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions'],
      newChapters: ['basic-functions']
    },
    // Silver Tier (A1 Intermediate)
    {
      mode: 'All-Maths',
      rank: { tier: 'Silver', subRank: 1 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials'],
      newChapters: ['polynomials']
    },
    {
      mode: 'All-Maths',
      rank: { tier: 'Silver', subRank: 2 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry'],
      newChapters: ['coordinate-geometry']
    },
    {
      mode: 'All-Maths',
      rank: { tier: 'Silver', subRank: 3 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs'],
      newChapters: ['circular-measure', 'exponentials-logs']
    },
    // Gold Tier (A1 Advanced)
    {
      mode: 'All-Maths',
      rank: { tier: 'Gold', subRank: 1 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series'],
      newChapters: ['sequences-series']
    },
    {
      mode: 'All-Maths',
      rank: { tier: 'Gold', subRank: 2 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series', 'binomial-expansion', 'trigonometry-1'],
      newChapters: ['binomial-expansion', 'trigonometry-1']
    },
    {
      mode: 'All-Maths',
      rank: { tier: 'Gold', subRank: 3 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series', 'binomial-expansion', 'trigonometry-1', 'differentiation-1', 'integration-1'],
      newChapters: ['differentiation-1', 'integration-1']
    },
    // Diamond Tier (A1→A2 Transition)
    {
      mode: 'All-Maths',
      rank: { tier: 'Diamond', subRank: 1 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series', 'binomial-expansion', 'trigonometry-1', 'differentiation-1', 'integration-1', 'trigonometry-2', 'vectors-1'],
      newChapters: ['trigonometry-2', 'vectors-1']
    },
    {
      mode: 'All-Maths',
      rank: { tier: 'Diamond', subRank: 2 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series', 'binomial-expansion', 'trigonometry-1', 'differentiation-1', 'integration-1', 'trigonometry-2', 'vectors-1', 'functions-advanced'],
      newChapters: ['functions-advanced']
    },
    {
      mode: 'All-Maths',
      rank: { tier: 'Diamond', subRank: 3 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series', 'binomial-expansion', 'trigonometry-1', 'differentiation-1', 'integration-1', 'trigonometry-2', 'vectors-1', 'functions-advanced', 'trigonometry-3'],
      newChapters: ['trigonometry-3']
    },
    // Unbeatable (A2 Core)
    {
      mode: 'All-Maths',
      rank: { tier: 'Unbeatable', subRank: 1 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series', 'binomial-expansion', 'trigonometry-1', 'differentiation-1', 'integration-1', 'trigonometry-2', 'vectors-1', 'functions-advanced', 'trigonometry-3', 'partial-fractions'],
      newChapters: ['partial-fractions']
    },
    {
      mode: 'All-Maths',
      rank: { tier: 'Unbeatable', subRank: 2 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series', 'binomial-expansion', 'trigonometry-1', 'differentiation-1', 'integration-1', 'trigonometry-2', 'vectors-1', 'functions-advanced', 'trigonometry-3', 'partial-fractions', 'differentiation-2'],
      newChapters: ['differentiation-2']
    },
    {
      mode: 'All-Maths',
      rank: { tier: 'Unbeatable', subRank: 3 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series', 'binomial-expansion', 'trigonometry-1', 'differentiation-1', 'integration-1', 'trigonometry-2', 'vectors-1', 'functions-advanced', 'trigonometry-3', 'partial-fractions', 'differentiation-2', 'integration-2'],
      newChapters: ['integration-2']
    },
    // Pocket Calculator (A★ Mix)
    {
      mode: 'All-Maths',
      rank: { tier: 'Pocket Calculator', subRank: 1 },
      chapters: ['indices-surds', 'linear-equations', 'quadratics', 'basic-functions', 'polynomials', 'coordinate-geometry', 'circular-measure', 'exponentials-logs', 'sequences-series', 'binomial-expansion', 'trigonometry-1', 'differentiation-1', 'integration-1', 'trigonometry-2', 'vectors-1', 'functions-advanced', 'trigonometry-3', 'partial-fractions', 'differentiation-2', 'integration-2', 'a1-a2-composites'],
      newChapters: ['a1-a2-composites']
    }
  ]
};