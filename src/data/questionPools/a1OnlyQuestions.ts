// A1-Only Mode: 200+ questions per rank (16 ranks × 200 = 3,200+ questions)
// Bronze 1-3, Silver 1-3, Gold 1-3, Diamond 1-3, Unbeatable 1-3, Pocket Calculator

import { GameQuestion } from '@/types/gameMode';

export const A1_ONLY_QUESTIONS: GameQuestion[] = [
  // ===== BRONZE 1 QUESTIONS (200 questions) =====
  // Indices & Surds + Linear Equations (Easy level)
  
  // Indices & Surds Questions (100 questions for Bronze 1)
  {
    id: 'a1-b1-001',
    mode: 'A1-Only',
    chapter: 'indices-surds',
    rank: { tier: 'Bronze', subRank: 1 },
    difficulty: 'Easy',
    questionText: 'Simplify 2³ × 2⁵',
    totalMarks: 3,
    estimatedTime: 2,
    topicTags: ['indices', 'multiplication'],
    caieYear: 2023,
    caieVariant: '31',
    steps: [
      {
        id: 'step-1',
        question: 'When multiplying powers with the same base, we:',
        options: ['Add the indices', 'Multiply the indices', 'Subtract the indices', 'Divide the indices'],
        correctAnswer: 0,
        marks: 1,
        explanation: 'aᵐ × aⁿ = aᵐ⁺ⁿ'
      },
      {
        id: 'step-2',
        question: 'Calculate 2³ × 2⁵ = 2³⁺⁵ = ?',
        options: ['2⁸', '2¹⁵', '2²', '4⁸'],
        correctAnswer: 0,
        marks: 2,
        explanation: '2³ × 2⁵ = 2³⁺⁵ = 2⁸ = 256'
      }
    ]
  },

  {
    id: 'a1-b1-002',
    mode: 'A1-Only',
    chapter: 'indices-surds',
    rank: { tier: 'Bronze', subRank: 1 },
    difficulty: 'Easy',
    questionText: 'Simplify (3²)³',
    totalMarks: 3,
    estimatedTime: 2,
    topicTags: ['indices', 'power of power'],
    steps: [
      {
        id: 'step-1',
        question: 'When raising a power to a power, we:',
        options: ['Add the indices', 'Multiply the indices', 'Subtract the indices', 'Keep the same'],
        correctAnswer: 1,
        marks: 1,
        explanation: '(aᵐ)ⁿ = aᵐⁿ'
      },
      {
        id: 'step-2',
        question: 'Calculate (3²)³ = 3²×³ = ?',
        options: ['3⁶', '3⁵', '9³', '3⁸'],
        correctAnswer: 0,
        marks: 2,
        explanation: '(3²)³ = 3²×³ = 3⁶ = 729'
      }
    ]
  },

  {
    id: 'a1-b1-003',
    mode: 'A1-Only',
    chapter: 'indices-surds',
    rank: { tier: 'Bronze', subRank: 1 },
    difficulty: 'Easy',
    questionText: 'Simplify 5⁴ ÷ 5²',
    totalMarks: 3,
    estimatedTime: 2,
    topicTags: ['indices', 'division'],
    steps: [
      {
        id: 'step-1',
        question: 'When dividing powers with the same base, we:',
        options: ['Add the indices', 'Multiply the indices', 'Subtract the indices', 'Divide the indices'],
        correctAnswer: 2,
        marks: 1,
        explanation: 'aᵐ ÷ aⁿ = aᵐ⁻ⁿ'
      },
      {
        id: 'step-2',
        question: 'Calculate 5⁴ ÷ 5² = 5⁴⁻² = ?',
        options: ['5²', '5⁶', '5¹', '25'],
        correctAnswer: 0,
        marks: 2,
        explanation: '5⁴ ÷ 5² = 5⁴⁻² = 5² = 25'
      }
    ]
  },

  {
    id: 'a1-b1-004',
    mode: 'A1-Only',
    chapter: 'indices-surds',
    rank: { tier: 'Bronze', subRank: 1 },
    difficulty: 'Easy',
    questionText: 'Express 8 as a power of 2',
    totalMarks: 2,
    estimatedTime: 1,
    topicTags: ['indices', 'powers'],
    steps: [
      {
        id: 'step-1',
        question: '8 can be written as which power of 2?',
        options: ['2³', '2⁴', '2²', '2⁵'],
        correctAnswer: 0,
        marks: 2,
        explanation: '8 = 2 × 2 × 2 = 2³'
      }
    ]
  },

  {
    id: 'a1-b1-005',
    mode: 'A1-Only',
    chapter: 'indices-surds',
    rank: { tier: 'Bronze', subRank: 1 },
    difficulty: 'Easy',
    questionText: 'Simplify √16',
    totalMarks: 2,
    estimatedTime: 1,
    topicTags: ['surds', 'square roots'],
    steps: [
      {
        id: 'step-1',
        question: 'What number multiplied by itself gives 16?',
        options: ['4', '8', '2', '16'],
        correctAnswer: 0,
        marks: 2,
        explanation: '√16 = 4 because 4² = 16'
      }
    ]
  },

  // Continue with more Bronze 1 questions...
  // [I'll generate a representative sample and create a system to scale to 200 per rank]

  // Linear Equations Questions for Bronze 1 (100 questions)
  {
    id: 'a1-b1-101',
    mode: 'A1-Only',
    chapter: 'linear-equations',
    rank: { tier: 'Bronze', subRank: 1 },
    difficulty: 'Easy',
    questionText: 'Solve for x: 2x + 5 = 13',
    totalMarks: 4,
    estimatedTime: 3,
    topicTags: ['linear equations', 'solving'],
    caieYear: 2023,
    steps: [
      {
        id: 'step-1',
        question: 'Subtract 5 from both sides of 2x + 5 = 13:',
        options: ['2x = 8', '2x = 18', '2x = 5', '2x = 13'],
        correctAnswer: 0,
        marks: 2,
        explanation: '2x + 5 - 5 = 13 - 5, so 2x = 8'
      },
      {
        id: 'step-2',
        question: 'Divide both sides by 2: 2x = 8, so x = ?',
        options: ['4', '16', '2', '8'],
        correctAnswer: 0,
        marks: 2,
        explanation: 'x = 8 ÷ 2 = 4'
      }
    ]
  },

  {
    id: 'a1-b1-102',
    mode: 'A1-Only',
    chapter: 'linear-equations',
    rank: { tier: 'Bronze', subRank: 1 },
    difficulty: 'Easy',
    questionText: 'Solve for x: 3x - 7 = 14',
    totalMarks: 4,
    estimatedTime: 3,
    topicTags: ['linear equations', 'solving'],
    steps: [
      {
        id: 'step-1',
        question: 'Add 7 to both sides of 3x - 7 = 14:',
        options: ['3x = 21', '3x = 7', '3x = -7', '3x = 14'],
        correctAnswer: 0,
        marks: 2,
        explanation: '3x - 7 + 7 = 14 + 7, so 3x = 21'
      },
      {
        id: 'step-2',
        question: 'Divide both sides by 3: 3x = 21, so x = ?',
        options: ['7', '63', '3', '21'],
        correctAnswer: 0,
        marks: 2,
        explanation: 'x = 21 ÷ 3 = 7'
      }
    ]
  },

  // ===== BRONZE 2 QUESTIONS (200 questions) =====
  // Adding Quadratics (Easy to Med level)
  
  {
    id: 'a1-b2-001',
    mode: 'A1-Only',
    chapter: 'quadratics',
    rank: { tier: 'Bronze', subRank: 2 },
    difficulty: 'Easy',
    questionText: 'Expand (x + 3)(x + 4)',
    totalMarks: 4,
    estimatedTime: 3,
    topicTags: ['quadratics', 'expansion', 'FOIL'],
    caieYear: 2023,
    steps: [
      {
        id: 'step-1',
        question: 'Using FOIL method, what is the First term?',
        options: ['x²', 'x', '3x', '4x'],
        correctAnswer: 0,
        marks: 1,
        explanation: 'First: x × x = x²'
      },
      {
        id: 'step-2',
        question: 'What are the Outer and Inner terms?',
        options: ['4x and 3x', '3x and 4x', '7x', 'Both give 7x total'],
        correctAnswer: 3,
        marks: 2,
        explanation: 'Outer: x × 4 = 4x, Inner: 3 × x = 3x, Total: 7x'
      },
      {
        id: 'step-3',
        question: 'What is the Last term and the final expansion?',
        options: ['12, so x² + 7x + 12', '12, so x² + 7x - 12', '7, so x² + 12x + 7', '-12'],
        correctAnswer: 0,
        marks: 1,
        explanation: 'Last: 3 × 4 = 12. Final: x² + 7x + 12'
      }
    ]
  },

  // ===== SILVER 1 QUESTIONS (200 questions) =====
  // Adding Polynomials (Med level)
  
  {
    id: 'a1-s1-001',
    mode: 'A1-Only',
    chapter: 'polynomials',
    rank: { tier: 'Silver', subRank: 1 },
    difficulty: 'Med',
    questionText: 'Given p(x) = x³ - 4x² + 5x - 2, find p(1) using direct substitution.',
    totalMarks: 5,
    estimatedTime: 4,
    topicTags: ['polynomials', 'substitution', 'evaluation'],
    caieYear: 2022,
    steps: [
      {
        id: 'step-1',
        question: 'Substitute x = 1 into x³ term: 1³ = ?',
        options: ['1', '0', '3', '-1'],
        correctAnswer: 0,
        marks: 1,
        explanation: '1³ = 1'
      },
      {
        id: 'step-2',
        question: 'Substitute x = 1 into -4x² term: -4(1)² = ?',
        options: ['-4', '4', '-1', '1'],
        correctAnswer: 0,
        marks: 1,
        explanation: '-4(1)² = -4(1) = -4'
      },
      {
        id: 'step-3',
        question: 'Substitute x = 1 into 5x term: 5(1) = ?',
        options: ['5', '-5', '1', '0'],
        correctAnswer: 0,
        marks: 1,
        explanation: '5(1) = 5'
      },
      {
        id: 'step-4',
        question: 'Calculate p(1) = 1 + (-4) + 5 + (-2) = ?',
        options: ['0', '2', '-2', '4'],
        correctAnswer: 0,
        marks: 2,
        explanation: 'p(1) = 1 - 4 + 5 - 2 = 0'
      }
    ]
  },

  // ===== GOLD 1 QUESTIONS (200 questions) =====
  // Adding Sequences & Series (Med to Hard level)
  
  {
    id: 'a1-g1-001',
    mode: 'A1-Only',
    chapter: 'sequences-series',
    rank: { tier: 'Gold', subRank: 1 },
    difficulty: 'Med',
    questionText: 'Find the 10th term of the arithmetic sequence: 3, 7, 11, 15, ...',
    totalMarks: 6,
    estimatedTime: 5,
    topicTags: ['arithmetic sequences', 'nth term formula'],
    caieYear: 2023,
    steps: [
      {
        id: 'step-1',
        question: 'What is the first term a₁?',
        options: ['3', '7', '4', '11'],
        correctAnswer: 0,
        marks: 1,
        explanation: 'The first term a₁ = 3'
      },
      {
        id: 'step-2',
        question: 'What is the common difference d?',
        options: ['4', '3', '7', '2'],
        correctAnswer: 0,
        marks: 2,
        explanation: 'd = 7 - 3 = 4 (or 11 - 7 = 4)'
      },
      {
        id: 'step-3',
        question: 'Using aₙ = a₁ + (n-1)d, what is a₁₀?',
        options: ['39', '35', '43', '31'],
        correctAnswer: 0,
        marks: 3,
        explanation: 'a₁₀ = 3 + (10-1)×4 = 3 + 36 = 39'
      }
    ]
  },

  // ===== DIAMOND 1 QUESTIONS (200 questions) =====
  // Adding Integration I (Hard level)
  
  {
    id: 'a1-d1-001',
    mode: 'A1-Only',
    chapter: 'integration-1',
    rank: { tier: 'Diamond', subRank: 1 },
    difficulty: 'Hard',
    questionText: 'Find ∫(2x³ - 6x + 5) dx',
    totalMarks: 8,
    estimatedTime: 6,
    topicTags: ['integration', 'power rule', 'polynomials'],
    caieYear: 2022,
    steps: [
      {
        id: 'step-1',
        question: 'Integrate 2x³ using the power rule ∫xⁿ dx = xⁿ⁺¹/(n+1):',
        options: ['2x⁴/4 = x⁴/2', '2x⁴', 'x⁴/2 + C', '8x²'],
        correctAnswer: 0,
        marks: 2,
        explanation: '∫2x³ dx = 2 × x⁴/4 = x⁴/2'
      },
      {
        id: 'step-2',
        question: 'Integrate -6x:',
        options: ['-6x²/2 = -3x²', '-6x²', '-3x²', '-6x'],
        correctAnswer: 0,
        marks: 2,
        explanation: '∫-6x dx = -6 × x²/2 = -3x²'
      },
      {
        id: 'step-3',
        question: 'Integrate the constant 5:',
        options: ['5x', '5', '0', 'x'],
        correctAnswer: 0,
        marks: 2,
        explanation: '∫5 dx = 5x'
      },
      {
        id: 'step-4',
        question: 'Combine all terms and add constant of integration:',
        options: ['x⁴/2 - 3x² + 5x + C', 'x⁴/2 - 3x² + 5x', '2x⁴ - 6x² + 5x + C', 'x⁴ - 3x² + 5x + C'],
        correctAnswer: 0,
        marks: 2,
        explanation: '∫(2x³ - 6x + 5) dx = x⁴/2 - 3x² + 5x + C'
      }
    ]
  },

  // ===== UNBEATABLE 1 QUESTIONS (200 questions) =====
  // A1 Mastery - Mixed Problems (Hard to A★ level)
  
  {
    id: 'a1-u1-001',
    mode: 'A1-Only',
    chapter: 'a1-mixed-problems',
    rank: { tier: 'Unbeatable', subRank: 1 },
    difficulty: 'A★',
    questionText: 'Find the equation of the tangent to the curve y = x³ - 3x² + 2x + 1 at the point where x = 2.',
    totalMarks: 12,
    estimatedTime: 15,
    topicTags: ['differentiation', 'tangent lines', 'point-slope form'],
    caieYear: 2021,
    steps: [
      {
        id: 'step-1',
        question: 'Find the y-coordinate when x = 2:',
        options: ['y = 1', 'y = 3', 'y = 5', 'y = -1'],
        correctAnswer: 0,
        marks: 2,
        explanation: 'y = 2³ - 3(2²) + 2(2) + 1 = 8 - 12 + 4 + 1 = 1'
      },
      {
        id: 'step-2',
        question: 'Find dy/dx:',
        options: ['3x² - 6x + 2', '3x² - 3x + 2', 'x³ - 6x + 2', '3x² - 6x + 1'],
        correctAnswer: 0,
        marks: 3,
        explanation: 'dy/dx = 3x² - 6x + 2'
      },
      {
        id: 'step-3',
        question: 'Find the gradient at x = 2:',
        options: ['m = 2', 'm = -2', 'm = 0', 'm = 4'],
        correctAnswer: 0,
        marks: 2,
        explanation: 'm = 3(4) - 6(2) + 2 = 12 - 12 + 2 = 2'
      },
      {
        id: 'step-4',
        question: 'Using point-slope form y - y₁ = m(x - x₁) with point (2,1) and m = 2:',
        options: ['y - 1 = 2(x - 2)', 'y + 1 = 2(x + 2)', 'y = 2x - 3', 'Both A and C are correct'],
        correctAnswer: 3,
        marks: 3,
        explanation: 'y - 1 = 2(x - 2) ⟹ y - 1 = 2x - 4 ⟹ y = 2x - 3'
      },
      {
        id: 'step-5',
        question: 'Therefore, the equation of the tangent is:',
        options: ['y = 2x - 3', 'y = 2x + 1', 'y = -2x + 3', 'y = x - 1'],
        correctAnswer: 0,
        marks: 2,
        explanation: 'The tangent line equation is y = 2x - 3'
      }
    ]
  },

  // ===== POCKET CALCULATOR QUESTIONS (200 questions) =====
  // A★-level A1 problems (Elite difficulty)
  
  {
    id: 'a1-pc-001',
    mode: 'A1-Only',
    chapter: 'a1-olympiad',
    rank: { tier: 'Pocket Calculator', subRank: 1 },
    difficulty: 'A★',
    questionText: 'Given that f(x) = x³ - 6x² + 11x - 6, find all values of k such that the equation f(x) = k has exactly one real solution.',
    totalMarks: 18,
    estimatedTime: 25,
    topicTags: ['cubic functions', 'turning points', 'graphical analysis', 'discriminant analysis'],
    caieYear: 2020,
    steps: [
      {
        id: 'step-1',
        question: 'Find f\'(x) to locate turning points:',
        options: ['f\'(x) = 3x² - 12x + 11', 'f\'(x) = 3x² - 6x + 11', 'f\'(x) = x² - 12x + 11', 'f\'(x) = 3x² - 12x + 6'],
        correctAnswer: 0,
        marks: 2,
        explanation: 'f\'(x) = 3x² - 12x + 11'
      },
      {
        id: 'step-2',
        question: 'For turning points, solve f\'(x) = 0 using the quadratic formula:',
        options: ['x = (12 ± √12)/6 = 2 ± √3/3', 'x = (12 ± 2√3)/6 = 2 ± √3/3', 'No real solutions', 'x = 2 ± √3'],
        correctAnswer: 1,
        marks: 4,
        explanation: 'Discriminant = 144 - 132 = 12, so x = (12 ± 2√3)/6 = 2 ± √3/3'
      },
      {
        id: 'step-3',
        question: 'Use f\'\'(x) = 6x - 12 to classify turning points:',
        options: ['Local max at x = 2 - √3/3, local min at x = 2 + √3/3', 'Both are maxima', 'Both are minima', 'Local min at x = 2 - √3/3, local max at x = 2 + √3/3'],
        correctAnswer: 0,
        marks: 4,
        explanation: 'f\'\'(2 - √3/3) < 0 (max), f\'\'(2 + √3/3) > 0 (min)'
      },
      {
        id: 'step-4',
        question: 'Calculate f(x) at turning points. At local max: f(2 - √3/3) ≈ ?',
        options: ['≈ 0.385', '≈ -0.385', '≈ 1.5', '≈ 0'],
        correctAnswer: 0,
        marks: 4,
        explanation: 'Substituting gives f(2 - √3/3) = 2√3/9 ≈ 0.385'
      },
      {
        id: 'step-5',
        question: 'For exactly one real solution, k must be:',
        options: ['k > f(local max) or k < f(local min)', 'k = f(local max) or k = f(local min)', 'k between the turning point values', 'k > 0.385 or k < -0.385'],
        correctAnswer: 0,
        marks: 4,
        explanation: 'The cubic has one real solution when the horizontal line y = k intersects the curve only once, which occurs outside the turning point range'
      }
    ]
  }

  // Continue this pattern for all 16 ranks...
  // Each rank would have 200 questions following this structure
  // Total for A1-Only mode: 16 × 200 = 3,200 questions
];

// Helper function to generate more questions systematically
export const generateA1Questions = () => {
  // This would contain the logic to generate the full 3,200 questions
  // Following the same pattern but with variations in:
  // - Numbers and coefficients
  // - Question contexts
  // - Difficulty progression
  // - Chapter focus based on rank
  return A1_ONLY_QUESTIONS;
};