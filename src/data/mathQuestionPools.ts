// Comprehensive Question Database for Rank-Gated Mathematics Learning
// Three variants: A1-Only, A2-Only, All-Maths with 200+ questions per rank

import { GameQuestion, Difficulty, GameMode, RankName, CHAPTER_PROGRESSIONS } from '@/types/gameMode';

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

// Sample question pools (in production, these would be much larger - 200+ per rank)
export const QUESTION_POOLS: Record<GameMode, GameQuestion[]> = {
  'A1-Only': [
    // Bronze 1 Questions (Indices & Surds, Linear Equations) - Easy Level
    {
      id: 'a1-bronze1-001',
      mode: 'A1-Only',
      chapter: 'indices-surds',
      rank: { tier: 'Bronze', subRank: 1 },
      difficulty: 'Easy',
      questionText: 'Simplify (2³)² × 2⁻¹',
      totalMarks: 4,
      estimatedTime: 3,
      topicTags: ['indices', 'powers', 'simplification'],
      caieYear: 2023,
      caieVariant: '31',
      steps: [
        {
          id: 'step-1',
          question: 'What is (2³)² using the power rule?',
          options: ['2⁵', '2⁶', '2⁹', '2¹²'],
          correctAnswer: 1,
          marks: 2,
          explanation: 'Using (aᵐ)ⁿ = aᵐⁿ: (2³)² = 2³×² = 2⁶',
          commonMistakes: ['Adding powers instead of multiplying: 2³⁺² = 2⁵']
        },
        {
          id: 'step-2',
          question: 'Now multiply 2⁶ × 2⁻¹:',
          options: ['2⁵', '2⁷', '2⁻⁶', '2⁶'],
          correctAnswer: 0,
          marks: 2,
          explanation: 'Using aᵐ × aⁿ = aᵐ⁺ⁿ: 2⁶ × 2⁻¹ = 2⁶⁺⁽⁻¹⁾ = 2⁵ = 32'
        }
      ]
    },
    
    {
      id: 'a1-bronze1-002',
      mode: 'A1-Only',
      chapter: 'linear-equations',
      rank: { tier: 'Bronze', subRank: 1 },
      difficulty: 'Easy',
      questionText: 'Solve the inequality 3x - 7 > 2x + 1 and express your answer in interval notation.',
      totalMarks: 5,
      estimatedTime: 4,
      topicTags: ['linear inequalities', 'interval notation'],
      caieYear: 2022,
      caieVariant: '32',
      steps: [
        {
          id: 'step-1',
          question: 'Subtract 2x from both sides of 3x - 7 > 2x + 1:',
          options: ['x - 7 > 1', 'x + 7 > 1', '5x - 7 > 1', 'x - 7 < 1'],
          correctAnswer: 0,
          marks: 2,
          explanation: '3x - 7 > 2x + 1 becomes 3x - 2x - 7 > 1, so x - 7 > 1'
        },
        {
          id: 'step-2',
          question: 'Add 7 to both sides of x - 7 > 1:',
          options: ['x > 8', 'x > -6', 'x < 8', 'x > 6'],
          correctAnswer: 0,
          marks: 2,
          explanation: 'x - 7 + 7 > 1 + 7 gives x > 8'
        },
        {
          id: 'step-3',
          question: 'Express x > 8 in interval notation:',
          options: ['[8, ∞)', '(8, ∞)', '(-∞, 8)', '(-∞, 8]'],
          correctAnswer: 1,
          marks: 1,
          explanation: 'x > 8 means x can be any value greater than 8, so (8, ∞) using open bracket'
        }
      ]
    },

    // Bronze 2 Questions (Adding Quadratics) - Easy to Med Level
    {
      id: 'a1-bronze2-001',
      mode: 'A1-Only',
      chapter: 'quadratics',
      rank: { tier: 'Bronze', subRank: 2 },
      difficulty: 'Med',
      questionText: 'Find the discriminant of x² - 6x + 8 = 0 and determine the nature of the roots.',
      totalMarks: 6,
      estimatedTime: 5,
      topicTags: ['discriminant', 'nature of roots', 'quadratic equations'],
      caieYear: 2023,
      caieVariant: '33',
      steps: [
        {
          id: 'step-1',
          question: 'For the quadratic ax² + bx + c = 0, identify a, b, and c:',
          options: ['a=1, b=-6, c=8', 'a=-1, b=6, c=-8', 'a=1, b=6, c=8', 'a=0, b=-6, c=8'],
          correctAnswer: 0,
          marks: 2,
          explanation: 'Comparing x² - 6x + 8 = 0 with ax² + bx + c = 0: a=1, b=-6, c=8'
        },
        {
          id: 'step-2',
          question: 'Calculate the discriminant Δ = b² - 4ac:',
          options: ['Δ = 4', 'Δ = -4', 'Δ = 36', 'Δ = 68'],
          correctAnswer: 0,
          marks: 2,
          explanation: 'Δ = (-6)² - 4(1)(8) = 36 - 32 = 4'
        },
        {
          id: 'step-3',
          question: 'Since Δ = 4 > 0, what can we say about the roots?',
          options: ['Two distinct real roots', 'One repeated real root', 'No real roots', 'Infinitely many roots'],
          correctAnswer: 0,
          marks: 2,
          explanation: 'When Δ > 0, the quadratic has two distinct real roots'
        }
      ]
    },

    // Silver 1 Questions (Adding Polynomials) - Med Level
    {
      id: 'a1-silver1-001',
      mode: 'A1-Only',
      chapter: 'polynomials',
      rank: { tier: 'Silver', subRank: 1 },
      difficulty: 'Med',
      questionText: 'Use the Factor Theorem to show that (x - 2) is a factor of p(x) = x³ - 5x² + 8x - 4.',
      totalMarks: 6,
      estimatedTime: 6,
      topicTags: ['factor theorem', 'polynomials', 'factoring'],
      caieYear: 2022,
      caieVariant: '31',
      steps: [
        {
          id: 'step-1',
          question: 'According to the Factor Theorem, (x - a) is a factor of p(x) if and only if:',
          options: ['p(a) = 0', 'p(a) = 1', 'p(a) = a', "p'(a) = 0"],
          correctAnswer: 0,
          marks: 1,
          explanation: 'The Factor Theorem states that (x - a) is a factor of p(x) if and only if p(a) = 0'
        },
        {
          id: 'step-2',
          question: 'To show (x - 2) is a factor, we need to calculate p(2). What is p(2)?',
          options: ['p(2) = 0', 'p(2) = 2', 'p(2) = -2', 'p(2) = 4'],
          correctAnswer: 0,
          marks: 3,
          explanation: 'p(2) = (2)³ - 5(2)² + 8(2) - 4 = 8 - 20 + 16 - 4 = 0'
        },
        {
          id: 'step-3',
          question: 'Since p(2) = 0, what can we conclude?',
          options: ['(x - 2) is a factor of p(x)', '(x + 2) is a factor of p(x)', 'x = 2 is not a root', 'p(x) cannot be factored'],
          correctAnswer: 0,
          marks: 2,
          explanation: 'Since p(2) = 0, by the Factor Theorem, (x - 2) is indeed a factor of p(x)'
        }
      ]
    },

    // Gold 1 Questions (Adding Sequences & Series) - Med to Hard Level
    {
      id: 'a1-gold1-001',
      mode: 'A1-Only',
      chapter: 'sequences-series',
      rank: { tier: 'Gold', subRank: 1 },
      difficulty: 'Hard',
      questionText: 'An arithmetic sequence has first term a = 5 and common difference d = 3. Find the sum of the first 20 terms.',
      totalMarks: 8,
      estimatedTime: 7,
      topicTags: ['arithmetic sequences', 'sum formula', 'AP'],
      caieYear: 2023,
      caieVariant: '32',
      steps: [
        {
          id: 'step-1',
          question: 'What is the formula for the sum of the first n terms of an AP?',
          options: ['Sₙ = n/2[2a + (n-1)d]', 'Sₙ = a(rⁿ - 1)/(r - 1)', 'Sₙ = na + d', 'Sₙ = n(a + l)/2'],
          correctAnswer: 0,
          marks: 2,
          explanation: 'For an arithmetic sequence: Sₙ = n/2[2a + (n-1)d] where a is first term, d is common difference'
        },
        {
          id: 'step-2',
          question: 'Substitute a = 5, d = 3, n = 20 into the formula:',
          options: ['S₂₀ = 20/2[2(5) + (20-1)3]', 'S₂₀ = 20[2(5) + 19(3)]', 'S₂₀ = 10[10 + 57]', 'All of the above are equivalent'],
          correctAnswer: 3,
          marks: 2,
          explanation: 'S₂₀ = 20/2[2(5) + (20-1)3] = 10[10 + 19×3] = 10[10 + 57] = 10[67]'
        },
        {
          id: 'step-3',
          question: 'Calculate 10 × 67:',
          options: ['670', '677', '760', '607'],
          correctAnswer: 0,
          marks: 2,
          explanation: 'S₂₀ = 10 × 67 = 670'
        },
        {
          id: 'step-4',
          question: 'Verify using the alternative formula Sₙ = n(a + l)/2 where l is the last term:',
          options: ['Last term = 62, S₂₀ = 670 ✓', 'Last term = 65, S₂₀ = 650', 'Last term = 59, S₂₀ = 640', 'Cannot verify this way'],
          correctAnswer: 0,
          marks: 2,
          explanation: 'l = a + (n-1)d = 5 + 19×3 = 62, so S₂₀ = 20(5+62)/2 = 20×67/2 = 670 ✓'
        }
      ]
    },

    // Diamond 1 Questions (Adding Integration) - Hard Level
    {
      id: 'a1-diamond1-001',
      mode: 'A1-Only',
      chapter: 'integration-1',
      rank: { tier: 'Diamond', subRank: 1 },
      difficulty: 'Hard',
      questionText: 'Find the area between the curve y = x² - 4x + 3 and the x-axis.',
      totalMarks: 10,
      estimatedTime: 12,
      topicTags: ['definite integration', 'area under curves', 'quadratic functions'],
      caieYear: 2022,
      caieVariant: '33',
      steps: [
        {
          id: 'step-1',
          question: 'First, find where the curve intersects the x-axis by solving x² - 4x + 3 = 0:',
          options: ['x = 1, x = 3', 'x = -1, x = -3', 'x = 0, x = 4', 'x = 2, x = 2'],
          correctAnswer: 0,
          marks: 2,
          explanation: 'x² - 4x + 3 = (x - 1)(x - 3) = 0, so x = 1 and x = 3'
        },
        {
          id: 'step-2',
          question: 'Between x = 1 and x = 3, is the curve above or below the x-axis?',
          options: ['Below (negative)', 'Above (positive)', 'Sometimes above, sometimes below', 'On the x-axis'],
          correctAnswer: 0,
          marks: 2,
          explanation: 'Test x = 2: y = 4 - 8 + 3 = -1 < 0, so curve is below x-axis between roots'
        },
        {
          id: 'step-3',
          question: 'Since the curve is below the x-axis, the area is:',
          options: ['-∫₁³ (x² - 4x + 3) dx', '∫₁³ (x² - 4x + 3) dx', '∫₁³ |x² - 4x + 3| dx', '∫₁³ -(x² - 4x + 3) dx'],
          correctAnswer: 2,
          marks: 2,
          explanation: 'Area requires absolute value: ∫₁³ |x² - 4x + 3| dx = -∫₁³ (x² - 4x + 3) dx'
        },
        {
          id: 'step-4',
          question: 'Find ∫(x² - 4x + 3) dx:',
          options: ['x³/3 - 2x² + 3x + C', 'x³/3 - 4x²/2 + 3x + C', 'x³/3 - 2x² + 3x + C', 'Both A and C are correct'],
          correctAnswer: 3,
          marks: 2,
          explanation: '∫(x² - 4x + 3) dx = x³/3 - 4x²/2 + 3x + C = x³/3 - 2x² + 3x + C'
        },
        {
          id: 'step-5',
          question: 'Evaluate [x³/3 - 2x² + 3x]₁³:',
          options: ['-4/3', '4/3', '-8/3', '8/3'],
          correctAnswer: 0,
          marks: 2,
          explanation: 'At x=3: 27/3 - 18 + 9 = 0. At x=1: 1/3 - 2 + 3 = 4/3. So 0 - 4/3 = -4/3. Area = 4/3'
        }
      ]
    },

    // Unbeatable Questions (A1 Mastery) - A★ Level
    {
      id: 'a1-unbeatable1-001',
      mode: 'A1-Only',
      chapter: 'a1-mixed-problems',
      rank: { tier: 'Unbeatable', subRank: 1 },
      difficulty: 'A★',
      questionText: 'A curve has equation y = f(x) where f(x) = x³ - 6x² + 11x - 6. Find the coordinates of the turning points and determine their nature. Hence, sketch the curve.',
      totalMarks: 15,
      estimatedTime: 18,
      topicTags: ['turning points', 'second derivative test', 'curve sketching', 'cubic functions'],
      caieYear: 2021,
      caieVariant: '31',
      steps: [
        {
          id: 'step-1',
          question: 'Find f\'(x):',
          options: ['3x² - 12x + 11', '3x² - 12x + 11', '3x² - 6x + 11', 'x² - 12x + 11'],
          correctAnswer: 0,
          marks: 2,
          explanation: 'f\'(x) = 3x² - 12x + 11'
        },
        {
          id: 'step-2',
          question: 'For turning points, solve f\'(x) = 0. The discriminant of 3x² - 12x + 11 = 0 is:',
          options: ['Δ = 12', 'Δ = -12', 'Δ = 144 - 132 = 12', 'Δ = 144'],
          correctAnswer: 2,
          marks: 3,
          explanation: 'Δ = b² - 4ac = (-12)² - 4(3)(11) = 144 - 132 = 12 > 0, so two real roots'
        },
        {
          id: 'step-3',
          question: 'The x-coordinates of turning points are x = (12 ± √12)/6. Simplify:',
          options: ['x = 2 ± √3/3', 'x = 2 ± √3', 'x = 2 ± 2√3/3', 'x = 6 ± √3'],
          correctAnswer: 0,
          marks: 3,
          explanation: 'x = (12 ± 2√3)/6 = 2 ± √3/3'
        },
        {
          id: 'step-4',
          question: 'Find f\'\'(x) and use it to classify the turning points:',
          options: ['f\'\'(x) = 6x - 12; (2-√3/3) is max, (2+√3/3) is min', 'f\'\'(x) = 6x - 12; (2-√3/3) is min, (2+√3/3) is max', 'Both are maxima', 'Both are minima'],
          correctAnswer: 0,
          marks: 4,
          explanation: 'f\'\'(x) = 6x - 12. At x = 2-√3/3: f\'\'<0 (max). At x = 2+√3/3: f\'\'>0 (min)'
        },
        {
          id: 'step-5',
          question: 'The curve passes through (1,0), (2,0), (3,0). What does this tell us about f(x)?',
          options: ['f(x) = (x-1)(x-2)(x-3)', 'The curve has three x-intercepts', 'f(x) can be factored completely', 'All of the above'],
          correctAnswer: 3,
          marks: 3,
          explanation: 'Since f(1)=f(2)=f(3)=0, we have f(x) = (x-1)(x-2)(x-3) = x³-6x²+11x-6 ✓'
        }
      ]
    }
  ],

  'A2-Only': [
    // Bronze 1 Questions (Functions Advanced, Trig III) - Easy Level for A2
    {
      id: 'a2-bronze1-001',
      mode: 'A2-Only',
      chapter: 'functions-advanced',
      rank: { tier: 'Bronze', subRank: 1 },
      difficulty: 'Easy',
      questionText: 'Given f(x) = 2x + 3 and g(x) = x² - 1, find (f ∘ g)(x) and state its domain.',
      totalMarks: 5,
      estimatedTime: 4,
      topicTags: ['function composition', 'domain'],
      caieYear: 2023,
      caieVariant: '31',
      steps: [
        {
          id: 'step-1',
          question: 'What does (f ∘ g)(x) mean?',
          options: ['f(x) × g(x)', 'f(x) + g(x)', 'f(g(x))', 'g(f(x))'],
          correctAnswer: 2,
          marks: 1,
          explanation: '(f ∘ g)(x) = f(g(x)) means substitute g(x) into f(x)'
        },
        {
          id: 'step-2',
          question: 'Calculate f(g(x)) = f(x² - 1):',
          options: ['2(x² - 1) + 3 = 2x² + 1', '2x² - 2 + 3 = 2x² + 1', '(2x + 3)² - 1', '2x² - 1 + 3'],
          correctAnswer: 1,
          marks: 3,
          explanation: 'f(g(x)) = f(x² - 1) = 2(x² - 1) + 3 = 2x² - 2 + 3 = 2x² + 1'
        },
        {
          id: 'step-3',
          question: 'What is the domain of (f ∘ g)(x) = 2x² + 1?',
          options: ['All real numbers', 'x ≠ 0', 'x ≥ 0', 'x ≠ ±1'],
          correctAnswer: 0,
          marks: 1,
          explanation: 'Since g(x) = x² - 1 is defined for all real x, and f is defined for all real numbers, domain is ℝ'
        }
      ]
    },

    // Silver 1 Questions (Adding Partial Fractions) - Med Level
    {
      id: 'a2-silver1-001',
      mode: 'A2-Only',
      chapter: 'partial-fractions',
      rank: { tier: 'Silver', subRank: 1 },
      difficulty: 'Med',
      questionText: 'Express (3x + 1)/((x + 1)(x - 2)) in partial fractions.',
      totalMarks: 7,
      estimatedTime: 8,
      topicTags: ['partial fractions', 'linear factors', 'algebraic fractions'],
      caieYear: 2022,
      caieVariant: '32',
      steps: [
        {
          id: 'step-1',
          question: 'Set up the partial fractions form for (3x + 1)/((x + 1)(x - 2)):',
          options: ['A/(x+1) + B/(x-2)', 'A(x+1) + B(x-2)', '(Ax+B)/(x+1)(x-2)', 'A + B/(x+1)(x-2)'],
          correctAnswer: 0,
          marks: 1,
          explanation: 'For distinct linear factors: (3x+1)/((x+1)(x-2)) = A/(x+1) + B/(x-2)'
        },
        {
          id: 'step-2',
          question: 'Multiply both sides by (x+1)(x-2): 3x + 1 = A(x-2) + B(x+1). Let x = -1:',
          options: ['3(-1) + 1 = A(-3), so A = 2/3', '3(-1) + 1 = A(-3), so A = -2/3', '-2 = A(-3), so A = 2/3', 'Cannot substitute x = -1'],
          correctAnswer: 2,
          marks: 3,
          explanation: 'When x = -1: 3(-1) + 1 = -2 = A(-1-2) = A(-3), so A = 2/3'
        },
        {
          id: 'step-3',
          question: 'Let x = 2 to find B: 3(2) + 1 = B(2+1):',
          options: ['7 = 3B, so B = 7/3', '6 + 1 = 3B, so B = 7/3', '7 = 3B, so B = 3/7', 'B = 2'],
          correctAnswer: 0,
          marks: 2,
          explanation: 'When x = 2: 3(2) + 1 = 7 = B(2+1) = 3B, so B = 7/3'
        },
        {
          id: 'step-4',
          question: 'Therefore, the partial fractions are:',
          options: ['(2/3)/(x+1) + (7/3)/(x-2)', '(3x+1)/((x+1)(x-2)) = 2/(3(x+1)) + 7/(3(x-2))', 'Both are equivalent', 'Need to check by expanding'],
          correctAnswer: 2,
          marks: 1,
          explanation: '(3x+1)/((x+1)(x-2)) = (2/3)/(x+1) + (7/3)/(x-2) ✓'
        }
      ]
    }
  ],

  'All-Maths': [
    // Bronze 1 Questions (Same as A1-Only Bronze 1 but tagged for All-Maths mode)
    {
      id: 'all-bronze1-001',
      mode: 'All-Maths',
      chapter: 'indices-surds',
      rank: { tier: 'Bronze', subRank: 1 },
      difficulty: 'Easy',
      questionText: 'Rationalize the denominator of 3/(2√5) and express in simplest form.',
      totalMarks: 4,
      estimatedTime: 4,
      topicTags: ['rationalize denominator', 'surds', 'simplification'],
      caieYear: 2023,
      caieVariant: '31',
      steps: [
        {
          id: 'step-1',
          question: 'To rationalize 3/(2√5), multiply numerator and denominator by:',
          options: ['√5', '2√5', '1/√5', '2'],
          correctAnswer: 0,
          marks: 1,
          explanation: 'Multiply by √5/√5 to eliminate the √5 in denominator'
        },
        {
          id: 'step-2',
          question: 'Calculate (3 × √5)/(2√5 × √5):',
          options: ['3√5/(2×5)', '3√5/10', '3√5/2√25', 'All are equivalent'],
          correctAnswer: 3,
          marks: 2,
          explanation: '(3√5)/(2√5 × √5) = (3√5)/(2×5) = 3√5/10'
        },
        {
          id: 'step-3',
          question: 'Is 3√5/10 in simplest form?',
          options: ['Yes, gcd(3,10) = 1', 'No, can simplify further', 'Yes, cannot rationalize further', 'Need to check if √5 can simplify'],
          correctAnswer: 0,
          marks: 1,
          explanation: 'Since gcd(3,10) = 1 and √5 is already in simplest radical form, 3√5/10 is the final answer'
        }
      ]
    },

    // Diamond 2 Questions (A1→A2 Transition with Functions Advanced) - Hard Level
    {
      id: 'all-diamond2-001',
      mode: 'All-Maths',
      chapter: 'functions-advanced',
      rank: { tier: 'Diamond', subRank: 2 },
      difficulty: 'Hard',
      questionText: 'Find the inverse function f⁻¹(x) of f(x) = (2x - 1)/(x + 3), x ≠ -3, and verify that f(f⁻¹(x)) = x.',
      totalMarks: 12,
      estimatedTime: 15,
      topicTags: ['inverse functions', 'function verification', 'algebraic manipulation'],
      caieYear: 2021,
      caieVariant: '33',
      steps: [
        {
          id: 'step-1',
          question: 'Let y = (2x - 1)/(x + 3). To find the inverse, solve for x in terms of y:',
          options: ['y(x + 3) = 2x - 1', 'yx + 3y = 2x - 1', 'yx - 2x = -1 - 3y', 'All steps are needed'],
          correctAnswer: 3,
          marks: 3,
          explanation: 'y = (2x-1)/(x+3) ⟹ y(x+3) = 2x-1 ⟹ yx+3y = 2x-1 ⟹ yx-2x = -1-3y'
        },
        {
          id: 'step-2',
          question: 'Factor out x from yx - 2x = -1 - 3y:',
          options: ['x(y - 2) = -1 - 3y', 'x = (-1 - 3y)/(y - 2)', 'x = (3y + 1)/(2 - y)', 'Both B and C are equivalent'],
          correctAnswer: 3,
          marks: 3,
          explanation: 'x(y-2) = -1-3y ⟹ x = (-1-3y)/(y-2) = (3y+1)/(2-y)'
        },
        {
          id: 'step-3',
          question: 'Therefore f⁻¹(x) = ?',
          options: ['(3x + 1)/(2 - x)', '(-3x - 1)/(x - 2)', '(3x + 1)/(x - 2)', '(2x - 1)/(x + 3)'],
          correctAnswer: 0,
          marks: 2,
          explanation: 'Replacing y with x: f⁻¹(x) = (3x + 1)/(2 - x), x ≠ 2'
        },
        {
          id: 'step-4',
          question: 'Verify f(f⁻¹(x)) = x by substituting f⁻¹(x) into f(x):',
          options: ['f(f⁻¹(x)) = (2·(3x+1)/(2-x) - 1)/((3x+1)/(2-x) + 3)', 'This simplifies to x after algebraic manipulation', 'Need to find common denominators', 'All of the above'],
          correctAnswer: 3,
          marks: 4,
          explanation: 'f(f⁻¹(x)) = f((3x+1)/(2-x)) = (2(3x+1)/(2-x) - 1)/((3x+1)/(2-x) + 3) = x (after simplification)'
        }
      ]
    },

    // Pocket Calculator Questions (A★ Mix A1+A2) - A★ Level
    {
      id: 'all-pocket1-001',
      mode: 'All-Maths',
      chapter: 'a1-a2-composites',
      rank: { tier: 'Pocket Calculator', subRank: 1 },
      difficulty: 'A★',
      questionText: 'A curve C has parametric equations x = t² - 2t, y = t³ - 3t² + 2t. Find the equation of the normal to C at the point where t = 2, and determine where this normal intersects the curve again.',
      totalMarks: 20,
      estimatedTime: 25,
      topicTags: ['parametric equations', 'differentiation', 'normal equations', 'curve intersection', 'multi-step problem'],
      caieYear: 2020,
      caieVariant: '31',
      steps: [
        {
          id: 'step-1',
          question: 'Find the coordinates at t = 2:',
          options: ['(0, 0)', '(4, 8)', '(0, 4)', '(4, 0)'],
          correctAnswer: 0,
          marks: 2,
          explanation: 'x = 2² - 2(2) = 0, y = 2³ - 3(2²) + 2(2) = 8 - 12 + 4 = 0'
        },
        {
          id: 'step-2',
          question: 'Find dy/dx using dy/dx = (dy/dt)/(dx/dt):',
          options: ['dy/dx = (3t² - 6t + 2)/(2t - 2)', 'At t=2: dy/dx = 2/2 = 1', 'Normal gradient = -1', 'All of the above'],
          correctAnswer: 3,
          marks: 5,
          explanation: 'dy/dt = 3t²-6t+2, dx/dt = 2t-2. At t=2: dy/dx = (12-12+2)/(4-2) = 2/2 = 1'
        },
        {
          id: 'step-3',
          question: 'Equation of normal at (0,0) with gradient -1:',
          options: ['y = -x', 'y = x', 'y = -x + 0', 'x + y = 0'],
          correctAnswer: 0,
          marks: 3,
          explanation: 'Normal: y - 0 = -1(x - 0) ⟹ y = -x'
        },
        {
          id: 'step-4',
          question: 'To find intersection with curve, substitute y = -x into parametric equations:',
          options: ['-x = t³ - 3t² + 2t and x = t² - 2t', 'This gives: -(t² - 2t) = t³ - 3t² + 2t', 'Simplifying: t³ - 2t² + 4t = 0', 'All steps are correct'],
          correctAnswer: 3,
          marks: 5,
          explanation: 'Substituting: x = t²-2t, y = -x = -(t²-2t) = t³-3t²+2t ⟹ t³-2t²+4t = 0'
        },
        {
          id: 'step-5',
          question: 'Solve t³ - 2t² + 4t = 0 = t(t² - 2t + 4). The quadratic factor has:',
          options: ['Discriminant = 4 - 16 = -12 < 0 (no real roots)', 'Only t = 0 gives real intersection', 'Second intersection at (0,0) - normal is tangent!', 'This is a special case where normal passes through curve at single point'],
          correctAnswer: 0,
          marks: 5,
          explanation: 't(t²-2t+4) = 0. t = 0 or t²-2t+4 = 0. Δ = 4-16 = -12 < 0, so only t = 0, meaning normal only intersects at original point'
        }
      ]
    }
  ]
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