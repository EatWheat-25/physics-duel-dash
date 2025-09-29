export interface MathQuestion {
  id: string;
  q: string;
  options: string[];
  answer: number;
  chapter: string;
  level: 'A1' | 'A2';
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface MathChapter {
  id: string;
  title: string;
  description: string;
  level: 'A1' | 'A2';
  order: number;
  requiredRankPoints: number;
  icon: string;
  questions: MathQuestion[];
}

export interface MathLevel {
  id: 'A1' | 'A2_ONLY' | 'A2';
  title: string;
  description: string;
  chapters: MathChapter[];
}

// A1 Math Chapters (AS Level) - Aligned with rank progression
export const A1_MATH_CHAPTERS: MathChapter[] = [
  // Bronze: Coordinate Geometry & Series
  {
    id: 'coordinate-geometry',
    title: 'Coordinate Geometry',
    description: 'Lines, circles, distance formula, midpoint formula',
    level: 'A1',
    order: 1,
    requiredRankPoints: 0, // Bronze 1
    icon: '📐',
    questions: [
      {
        id: 'coord-1',
        q: "The distance between points (1, 2) and (4, 6) is:",
        options: ["5", "7", "√25", "3"],
        answer: 0,
        chapter: 'coordinate-geometry',
        level: 'A1',
        difficulty: 'medium'
      },
      {
        id: 'coord-2',
        q: "The equation of a circle with center (0, 0) and radius 3 is:",
        options: ["x² + y² = 3", "x² + y² = 9", "x² + y² = 6", "(x-0)² + (y-0)² = 3"],
        answer: 1,
        chapter: 'coordinate-geometry',
        level: 'A1',
        difficulty: 'easy'
      }
    ]
  },
  {
    id: 'binomial-expansion',
    title: 'Binomial Expansion',
    description: 'Binomial theorem, Pascal\'s triangle, expansion of (a+b)ⁿ',
    level: 'A1',
    order: 2,
    requiredRankPoints: 100, // Bronze 2
    icon: '🎯',
    questions: [
      {
        id: 'binom-1',
        q: "The coefficient of x² in the expansion of (1+x)⁴ is:",
        options: ["4", "6", "8", "12"],
        answer: 1,
        chapter: 'binomial-expansion',
        level: 'A1',
        difficulty: 'medium'
      }
    ]
  },
  {
    id: 'sequences-series',
    title: 'Sequences & Series',
    description: 'Arithmetic & geometric sequences, sum formulas',
    level: 'A1',
    order: 3,
    requiredRankPoints: 200, // Bronze 3
    icon: '🔢',
    questions: [
      {
        id: 'seq-1',
        q: "In an arithmetic sequence, if a₁ = 3 and d = 2, what is a₅?",
        options: ["11", "13", "9", "15"],
        answer: 0,
        chapter: 'sequences-series',
        level: 'A1',
        difficulty: 'medium'
      }
    ]
  },
  
  // Silver: Circular Measure & Quadratics
  {
    id: 'circular-measure',
    title: 'Circular Measure',
    description: 'Radians, arc length, sector area',
    level: 'A1',
    order: 4,
    requiredRankPoints: 300, // Silver 1
    icon: '⭕',
    questions: [
      {
        id: 'circ-1',
        q: "Convert 180° to radians:",
        options: ["π", "2π", "π/2", "π/4"],
        answer: 0,
        chapter: 'circular-measure',
        level: 'A1',
        difficulty: 'easy'
      }
    ]
  },
  {
    id: 'quadratics',
    title: 'Quadratics',
    description: 'Quadratic equations, completing the square, discriminant',
    level: 'A1',
    order: 5,
    requiredRankPoints: 400, // Silver 2
    icon: '📈',
    questions: [
      {
        id: 'quad-1',
        q: "The discriminant of ax² + bx + c = 0 is:",
        options: ["b² - 4ac", "b² + 4ac", "-b ± √(b² - 4ac)", "2a"],
        answer: 0,
        chapter: 'quadratics',
        level: 'A1',
        difficulty: 'easy'
      },
      {
        id: 'quad-2',
        q: "If a quadratic has discriminant < 0, the graph:",
        options: ["Has two x-intercepts", "Has one x-intercept", "Has no x-intercepts", "Is a straight line"],
        answer: 2,
        chapter: 'quadratics',
        level: 'A1',
        difficulty: 'medium'
      }
    ]
  },
  
  // Gold: Trigonometry & Functions
  {
    id: 'trigonometry',
    title: 'Trigonometry',
    description: 'Trigonometric ratios, identities, equations',
    level: 'A1',
    order: 6,
    requiredRankPoints: 600, // Gold 1
    icon: '📐',
    questions: [
      {
        id: 'trig-1',
        q: "sin²θ + cos²θ equals:",
        options: ["0", "1", "2", "θ"],
        answer: 1,
        chapter: 'trigonometry',
        level: 'A1',
        difficulty: 'easy'
      }
    ]
  },
  {
    id: 'functions',
    title: 'Functions',
    description: 'Function composition, inverse functions, domain and range',
    level: 'A1',
    order: 7,
    requiredRankPoints: 700, // Gold 2
    icon: '🔢',
    questions: [
      {
        id: 'func-1',
        q: "If f(x) = 2x + 3 and g(x) = x - 1, what is f(g(x))?",
        options: ["2x + 1", "2x + 5", "2x - 2 + 3", "2x + 1"],
        answer: 0,
        chapter: 'functions',
        level: 'A1',
        difficulty: 'medium'
      },
      {
        id: 'func-2',
        q: "The domain of f(x) = 1/(x-2) is:",
        options: ["All real numbers", "x ≠ 2", "x > 2", "x < 2"],
        answer: 1,
        chapter: 'functions',
        level: 'A1',
        difficulty: 'easy'
      }
    ]
  },
  
  // Diamond: Differentiation
  {
    id: 'differentiation',
    title: 'Differentiation',
    description: 'Derivatives, chain rule, product rule, quotient rule',
    level: 'A1',
    order: 8,
    requiredRankPoints: 900, // Diamond 1
    icon: '📈',
    questions: [
      {
        id: 'diff-1',
        q: "The derivative of x³ is:",
        options: ["x²", "3x²", "3x³", "x³/3"],
        answer: 1,
        chapter: 'differentiation',
        level: 'A1',
        difficulty: 'easy'
      }
    ]
  },
  
  // Unbeatable+: Integration
  {
    id: 'integration',
    title: 'Integration',
    description: 'Indefinite integrals, definite integrals, area under curves',
    level: 'A1',
    order: 9,
    requiredRankPoints: 1200, // Unbeatable 1
    icon: '∫',
    questions: [
      {
        id: 'int-1',
        q: "∫x² dx equals:",
        options: ["x³/3 + C", "2x + C", "x³ + C", "3x² + C"],
        answer: 0,
        chapter: 'integration',
        level: 'A1',
        difficulty: 'medium'
      }
    ]
  }
];

// A2 Math Chapters (Additional A Level content)
export const A2_MATH_CHAPTERS: MathChapter[] = [
  {
    id: 'parametric-equations',
    title: 'Parametric Equations',
    description: 'Parametric curves, calculus with parametric equations',
    level: 'A2',
    order: 6,
    requiredRankPoints: 0, // Make A2_ONLY accessible from start
    icon: '🌀',
    questions: [
      {
        id: 'param1-1',
        q: "If x = 2t and y = t², what is dy/dx?",
        options: ["t", "2t", "t/2", "2"],
        answer: 0,
        chapter: 'parametric-equations',
        level: 'A2',
        difficulty: 'medium'
      }
    ]
  },
  {
    id: 'vectors',
    title: 'Vectors',
    description: 'Vector operations, dot product, cross product',
    level: 'A2',
    order: 7,
    requiredRankPoints: 1200, // Diamond 1
    icon: '⬱',
    questions: [
      {
        id: 'vec1-1',
        q: "The magnitude of vector (3, 4) is:",
        options: ["7", "5", "√7", "12"],
        answer: 1,
        chapter: 'vectors',
        level: 'A2',
        difficulty: 'easy'
      }
    ]
  },
  {
    id: 'complex-numbers',
    title: 'Complex Numbers',
    description: 'Complex arithmetic, Argand diagrams, De Moivre\'s theorem',
    level: 'A2',
    order: 8,
    requiredRankPoints: 1400, // Diamond 3
    icon: '🔢',
    questions: [
      {
        id: 'comp1-1',
        q: "i² equals:",
        options: ["1", "-1", "i", "0"],
        answer: 1,
        chapter: 'complex-numbers',
        level: 'A2',
        difficulty: 'easy'
      }
    ]
  }
];

export const MATH_LEVELS: MathLevel[] = [
  {
    id: 'A1',
    title: 'A1 Mathematics (AS Level)',
    description: 'Foundation mathematics concepts for AS Level',
    chapters: A1_MATH_CHAPTERS
  },
  {
    id: 'A2',
    title: 'A2 Mathematics (A Level Full)',
    description: 'Complete A Level mathematics including A1 + A2 content',
    chapters: [...A1_MATH_CHAPTERS, ...A2_MATH_CHAPTERS]
  },
  {
    id: 'A2_ONLY',
    title: 'A2 Mathematics Only',
    description: 'Advanced A2 Level mathematics content only',
    chapters: A2_MATH_CHAPTERS
  }
];

export const getMathUnlockedChapters = (level: 'A1' | 'A2_ONLY' | 'A2', currentPoints: number): MathChapter[] => {
  const mathLevel = MATH_LEVELS.find(l => l.id === level);
  if (!mathLevel) return [];
  
  // For Diamond ranks (1200+ points), unlock ALL chapters
  if (currentPoints >= 1200) {
    return mathLevel.chapters;
  }
  
  // For Platinum 2+ (1000+ points), mix and integrate earlier chapters
  if (currentPoints >= 1000) {
    return mathLevel.chapters.filter(chapter => 
      currentPoints >= chapter.requiredRankPoints
    );
  }
  
  // Standard progression for Bronze to Platinum 1
  return mathLevel.chapters.filter(chapter => 
    currentPoints >= chapter.requiredRankPoints
  );
};

export const getMathQuestionsFromChapters = (chapters: MathChapter[], count: number = 5): MathQuestion[] => {
  const allQuestions: MathQuestion[] = [];
  chapters.forEach(chapter => {
    allQuestions.push(...chapter.questions);
  });
  
  const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, allQuestions.length));
};

// Get math questions based on rank progression (automatic chapter filtering)
export const getMathQuestionsByRank = (level: 'A1' | 'A2_ONLY' | 'A2', currentPoints: number, count: number = 5): MathQuestion[] => {
  const unlockedChapters = getMathUnlockedChapters(level, currentPoints);
  return getMathQuestionsFromChapters(unlockedChapters, count);
};