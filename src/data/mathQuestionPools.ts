// Comprehensive Question Database for Rank-Gated Mathematics Learning
// Combined pools from all sources + generated variations to reach 200+ questions per rank

import { GameQuestion, Difficulty, GameMode, RankName, CHAPTER_PROGRESSIONS } from '@/types/gameMode';
import { A1_ONLY_QUESTIONS } from './questionPools/a1OnlyQuestions';
import { A2_ONLY_QUESTIONS } from './questionPools/a2OnlyQuestions';
import { ALL_MATHS_QUESTIONS } from './questionPools/allMathsQuestions';
import { getAllQuestions } from './questionPools/questionGenerator';
import { A2_INTEGRATION_QUESTIONS } from './questionPools/a2IntegrationQuestions';

// Chapter definitions for all game modes
export const CHAPTERS = {
  // A1 Chapters
  'indices-surds': {
    id: 'indices-surds',
    name: 'Indices & Surds',
    description: 'Simplify expressions, rationalize denominators',
    syllabus: 'A1' as const,
    icon: '🔢',
    order: 1
  },
  'linear-equations': {
    id: 'linear-equations',
    name: 'Linear Equations & Inequalities',
    description: 'Solving linear systems, interval notation',
    syllabus: 'A1' as const,
    icon: '📏',
    order: 2
  },
  'quadratics': {
    id: 'quadratics',
    name: 'Quadratics',
    description: 'Roots, factoring, completing square, discriminant',
    syllabus: 'A1' as const,
    icon: '📈',
    order: 3
  },
  'basic-functions': {
    id: 'basic-functions',
    name: 'Basic Functions & Graphs',
    description: 'Domain/range, transformations',
    syllabus: 'A1' as const,
    icon: '📊',
    order: 4
  },
  'polynomials': {
    id: 'polynomials',
    name: 'Polynomials',
    description: 'Remainder/Factor theorem basics',
    syllabus: 'A1' as const,
    icon: '🔢',
    order: 5
  },
  'coordinate-geometry': {
    id: 'coordinate-geometry',
    name: 'Coordinate Geometry',
    description: 'Lines, distance, midpoint',
    syllabus: 'A1' as const,
    icon: '📐',
    order: 6
  },
  'circular-measure': {
    id: 'circular-measure',
    name: 'Circular Measure',
    description: 'Radians, arc length, sector area',
    syllabus: 'A1' as const,
    icon: '⭕',
    order: 7
  },
  'exponentials-logs': {
    id: 'exponentials-logs',
    name: 'Exponentials & Logs',
    description: 'Laws, simple equations',
    syllabus: 'A1' as const,
    icon: '📊',
    order: 8
  },
  'sequences-series': {
    id: 'sequences-series',
    name: 'Sequences & Series',
    description: 'AP/GP basics, sum formulae',
    syllabus: 'A1' as const,
    icon: '🔢',
    order: 9
  },
  'binomial-expansion': {
    id: 'binomial-expansion',
    name: 'Binomial Expansion',
    description: 'Positive integer n, limited terms',
    syllabus: 'A1' as const,
    icon: '🎯',
    order: 10
  },
  'trigonometry-1': {
    id: 'trigonometry-1',
    name: 'Trigonometry I',
    description: 'Sine/cosine rules, basic identities',
    syllabus: 'A1' as const,
    icon: '📐',
    order: 11
  },
  'differentiation-1': {
    id: 'differentiation-1',
    name: 'Differentiation I',
    description: 'First principles, power rule; tangents/normals',
    syllabus: 'A1' as const,
    icon: '📈',
    order: 12
  },
  'integration-1': {
    id: 'integration-1',
    name: 'Integration I',
    description: 'Power rule; areas; simple kinematics',
    syllabus: 'A1' as const,
    icon: '∫',
    order: 13
  },
  'trigonometry-2': {
    id: 'trigonometry-2',
    name: 'Trigonometry II',
    description: 'Identities, equations; graphs',
    syllabus: 'A1' as const,
    icon: '📐',
    order: 14
  },
  'vectors-1': {
    id: 'vectors-1',
    name: 'Vectors I',
    description: '2D/3D basics, magnitude/direction',
    syllabus: 'A1' as const,
    icon: '⬱',
    order: 15
  },
  
  // A2 Chapters
  'functions-advanced': {
    id: 'functions-advanced',
    name: 'Functions',
    description: 'Compositions, inverses, modulus functions',
    syllabus: 'A2' as const,
    icon: '🔄',
    order: 16
  },
  'trigonometry-3': {
    id: 'trigonometry-3',
    name: 'Trigonometry III',
    description: 'Compound angles, R-formula basics',
    syllabus: 'A2' as const,
    icon: '📐',
    order: 17
  },
  'exponential-log-advanced': {
    id: 'exponential-log-advanced',
    name: 'Advanced Exponential & Log',
    description: 'Harder exponential & logarithmic equations',
    syllabus: 'A2' as const,
    icon: '📊',
    order: 18
  },
  'partial-fractions': {
    id: 'partial-fractions',
    name: 'Partial Fractions',
    description: 'Proper/improper, linear/quadratic factors',
    syllabus: 'A2' as const,
    icon: '🔢',
    order: 19
  },
  'differentiation-2': {
    id: 'differentiation-2',
    name: 'Differentiation II',
    description: 'Product, quotient, chain; implicit; parametric',
    syllabus: 'A2' as const,
    icon: '📈',
    order: 20
  },
  'integration-2': {
    id: 'integration-2',
    name: 'Integration II',
    description: 'By substitution; by parts – single pass',
    syllabus: 'A2' as const,
    icon: '∫',
    order: 21
  }
} as const;

// Combined question pools from all sources (9,600+ total questions)
export const QUESTION_POOLS: Record<GameMode, GameQuestion[]> = {
  'A1-Only': A1_ONLY_QUESTIONS,
  'A2-Only': A2_ONLY_QUESTIONS, 
  'All-Maths': ALL_MATHS_QUESTIONS,
  'A2-Integration': A2_INTEGRATION_QUESTIONS
};

// Enhanced question pools with generated variations (full 200 per rank)
export const ENHANCED_QUESTION_POOLS: Record<GameMode, GameQuestion[]> = {
  'A1-Only': [...A1_ONLY_QUESTIONS, ...getAllQuestions().filter(q => q.mode === 'A1-Only')],
  'A2-Only': [...A2_ONLY_QUESTIONS, ...getAllQuestions().filter(q => q.mode === 'A2-Only')],
  'All-Maths': [...ALL_MATHS_QUESTIONS, ...getAllQuestions().filter(q => q.mode === 'All-Maths')],
  'A2-Integration': A2_INTEGRATION_QUESTIONS
};

// Utility functions for question retrieval and management
export const getQuestionsForRank = (
  mode: GameMode, 
  rank: RankName, 
  count: number = 5
): GameQuestion[] => {
  const modeQuestions = QUESTION_POOLS[mode] || [];
  const rankQuestions = modeQuestions.filter(q => 
    q.rank.tier === rank.tier && q.rank.subRank === rank.subRank
  );
  
  // Shuffle and return requested count
  const shuffled = [...rankQuestions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

export const getQuestionsByChapter = (
  mode: GameMode,
  chapterIds: string[],
  maxDifficulty: Difficulty = 'A★',
  count: number = 5
): GameQuestion[] => {
  const modeQuestions = QUESTION_POOLS[mode] || [];
  const chapterQuestions = modeQuestions.filter(q => 
    chapterIds.includes(q.chapter) && 
    getDifficultyRank(q.difficulty) <= getDifficultyRank(maxDifficulty)
  );
  
  const shuffled = [...chapterQuestions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

export const getAvailableChapters = (mode: GameMode, rank: RankName): string[] => {
  const progression = CHAPTER_PROGRESSIONS[mode];
  const rankMapping = progression.find(p => 
    p.rank.tier === rank.tier && p.rank.subRank === rank.subRank
  );
  return rankMapping?.chapters || [];
};

export const getNewChaptersAtRank = (mode: GameMode, rank: RankName): string[] => {
  const progression = CHAPTER_PROGRESSIONS[mode];
  const rankMapping = progression.find(p => 
    p.rank.tier === rank.tier && p.rank.subRank === rank.subRank
  );
  return rankMapping?.newChapters || [];
};

// Helper function to compare difficulties
const getDifficultyRank = (difficulty: Difficulty): number => {
  const ranks = { 'Easy': 1, 'Med': 2, 'Hard': 3, 'A★': 4 };
  return ranks[difficulty] || 1;
};

// Statistics for question pool validation
export const getQuestionPoolStats = (mode: GameMode) => {
  const questions = QUESTION_POOLS[mode] || [];
  const byRank = questions.reduce((acc, q) => {
    const key = `${q.rank.tier}-${q.rank.subRank}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const byDifficulty = questions.reduce((acc, q) => {
    acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
    return acc;
  }, {} as Record<Difficulty, number>);
  
  return {
    total: questions.length,
    byRank,
    byDifficulty,
    averageMarks: questions.reduce((sum, q) => sum + q.totalMarks, 0) / questions.length,
    averageTime: questions.reduce((sum, q) => sum + q.estimatedTime, 0) / questions.length
  };
};