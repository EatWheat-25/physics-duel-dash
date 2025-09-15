import { StepBasedQuestion } from '@/types/stepQuestion';

// CAIE-style step-by-step math questions with authentic marking schemes
export const STEP_MATH_QUESTIONS: StepBasedQuestion[] = [
  // Differentiation Questions
  {
    id: 'diff-chain-rule-1',
    title: 'Chain Rule Differentiation',
    subject: 'math',
    chapter: 'differentiation',
    level: 'A1',
    difficulty: 'medium',
    totalMarks: 6,
    questionText: 'Find dy/dx when y = (3x² + 2)⁵',
    topicTags: ['chain rule', 'differentiation', 'composite functions'],
    steps: [
      {
        id: 'step-1',
        question: 'To differentiate y = (3x² + 2)⁵, which rule should we use?',
        options: [
          'Power rule only',
          'Chain rule',
          'Product rule',
          'Quotient rule'
        ],
        correctAnswer: 1,
        marks: 1,
        explanation: 'Chain rule is needed because we have a function raised to a power, where the function itself contains x.'
      },
      {
        id: 'step-2',
        question: 'Using chain rule dy/dx = dy/du × du/dx, what should u be?',
        options: [
          'u = 3x² + 2',
          'u = (3x² + 2)⁵',
          'u = 3x²',
          'u = 5'
        ],
        correctAnswer: 0,
        marks: 1,
        explanation: 'Let u = 3x² + 2, so y = u⁵. This allows us to differentiate the outer function first.'
      },
      {
        id: 'step-3',
        question: 'What is dy/du when y = u⁵?',
        options: [
          '5u⁴',
          'u⁴',
          '5u',
          '4u⁵'
        ],
        correctAnswer: 0,
        marks: 1,
        explanation: 'Using the power rule: dy/du = 5u⁴'
      },
      {
        id: 'step-4',
        question: 'What is du/dx when u = 3x² + 2?',
        options: [
          '3x',
          '6x',
          '6x + 2',
          '3x² + 2'
        ],
        correctAnswer: 1,
        marks: 1,
        explanation: 'du/dx = d/dx(3x² + 2) = 6x + 0 = 6x'
      },
      {
        id: 'step-5',
        question: 'Combining the results: dy/dx = dy/du × du/dx = 5u⁴ × 6x. Substituting u = 3x² + 2:',
        options: [
          'dy/dx = 30x(3x² + 2)⁴',
          'dy/dx = 5(3x² + 2)⁴ × 6x',
          'dy/dx = 30x(3x² + 2)⁵',
          'dy/dx = 6x(3x² + 2)⁴'
        ],
        correctAnswer: 0,
        marks: 2,
        explanation: 'dy/dx = 5(3x² + 2)⁴ × 6x = 30x(3x² + 2)⁴'
      }
    ]
  },

  {
    id: 'stationary-points-1',
    title: 'Finding Stationary Points',
    subject: 'math',
    chapter: 'differentiation',
    level: 'A1',
    difficulty: 'medium',
    totalMarks: 7,
    questionText: 'Find the coordinates of the stationary point of f(x) = x³ - 6x² + 9x + 1',
    topicTags: ['stationary points', 'differentiation', 'coordinate geometry'],
    steps: [
      {
        id: 'step-1',
        question: 'To find stationary points, what do we need to find first?',
        options: [
          'The second derivative f\'\'(x)',
          'The first derivative f\'(x)',
          'The integral of f(x)',
          'The value of f(x)'
        ],
        correctAnswer: 1,
        marks: 1,
        explanation: 'At stationary points, the gradient is zero, so we need f\'(x) = 0'
      },
      {
        id: 'step-2',
        question: 'Find f\'(x) when f(x) = x³ - 6x² + 9x + 1:',
        options: [
          'f\'(x) = 3x² - 12x + 9',
          'f\'(x) = x² - 6x + 9',
          'f\'(x) = 3x² - 6x + 9',
          'f\'(x) = 3x² - 12x + 1'
        ],
        correctAnswer: 0,
        marks: 2,
        explanation: 'f\'(x) = 3x² - 12x + 9 (differentiating term by term)'
      },
      {
        id: 'step-3',
        question: 'For stationary points, set f\'(x) = 0: 3x² - 12x + 9 = 0. Factoring gives:',
        options: [
          '3(x - 1)(x - 3) = 0',
          '3(x + 1)(x + 3) = 0',
          '(3x - 1)(x - 3) = 0',
          '3(x² - 4x + 3) = 0'
        ],
        correctAnswer: 0,
        marks: 2,
        explanation: '3x² - 12x + 9 = 3(x² - 4x + 3) = 3(x - 1)(x - 3) = 0'
      },
      {
        id: 'step-4',
        question: 'The x-coordinates of stationary points are:',
        options: [
          'x = 1 and x = 3',
          'x = -1 and x = -3',
          'x = 0 and x = 4',
          'x = 1 only'
        ],
        correctAnswer: 0,
        marks: 1,
        explanation: 'From 3(x - 1)(x - 3) = 0, we get x = 1 and x = 3'
      },
      {
        id: 'step-5',
        question: 'The coordinates of the stationary points are:',
        options: [
          '(1, 5) and (3, 1)',
          '(1, 1) and (3, 5)',
          '(1, 7) and (3, 3)',
          '(1, 3) and (3, 7)'
        ],
        correctAnswer: 0,
        marks: 1,
        explanation: 'When x = 1: f(1) = 1 - 6 + 9 + 1 = 5. When x = 3: f(3) = 27 - 54 + 27 + 1 = 1'
      }
    ]
  },

  {
    id: 'integration-parts-1',
    title: 'Integration by Parts',
    subject: 'math',
    chapter: 'integration',
    level: 'A1',
    difficulty: 'hard',
    totalMarks: 8,
    questionText: 'Find ∫x ln(x) dx using integration by parts',
    topicTags: ['integration by parts', 'logarithmic functions', 'integration'],
    steps: [
      {
        id: 'step-1',
        question: 'Integration by parts formula is ∫u dv = uv - ∫v du. For ∫x ln(x) dx, which choice is best?',
        options: [
          'u = x, dv = ln(x) dx',
          'u = ln(x), dv = x dx',
          'u = x ln(x), dv = dx',
          'u = 1, dv = x ln(x) dx'
        ],
        correctAnswer: 1,
        marks: 2,
        explanation: 'Choose u = ln(x) (gets simpler when differentiated) and dv = x dx (easy to integrate)'
      },
      {
        id: 'step-2',
        question: 'If u = ln(x), then du = ?',
        options: [
          'du = x dx',
          'du = (1/x) dx',
          'du = ln(x) dx',
          'du = 1 dx'
        ],
        correctAnswer: 1,
        marks: 1,
        explanation: 'du = d/dx[ln(x)] dx = (1/x) dx'
      },
      {
        id: 'step-3',
        question: 'If dv = x dx, then v = ?',
        options: [
          'v = x²',
          'v = x²/2',
          'v = x',
          'v = x³/3'
        ],
        correctAnswer: 1,
        marks: 1,
        explanation: 'v = ∫x dx = x²/2'
      },
      {
        id: 'step-4',
        question: 'Using ∫u dv = uv - ∫v du, we get ∫x ln(x) dx = uv - ∫v du = ?',
        options: [
          'ln(x) × (x²/2) - ∫(x²/2) × (1/x) dx',
          'x × ln(x) - ∫(1/x) × (x²/2) dx',
          'ln(x) × x² - ∫x² × (1/x) dx',
          '(x²/2) × ln(x) - ∫x × (1/x) dx'
        ],
        correctAnswer: 0,
        marks: 2,
        explanation: '∫x ln(x) dx = ln(x) × (x²/2) - ∫(x²/2) × (1/x) dx'
      },
      {
        id: 'step-5',
        question: 'Simplify ∫(x²/2) × (1/x) dx = ∫(x/2) dx = ?',
        options: [
          'x²/2 + C',
          'x²/4 + C',
          'x/2 + C',
          'x³/6 + C'
        ],
        correctAnswer: 1,
        marks: 1,
        explanation: '∫(x/2) dx = (1/2) × (x²/2) = x²/4 + C'
      },
      {
        id: 'step-6',
        question: 'Therefore, ∫x ln(x) dx = ?',
        options: [
          '(x²/2)ln(x) - x²/4 + C',
          'x ln(x) - x²/2 + C',
          '(x²/2)ln(x) - x²/2 + C',
          'x²ln(x) - x²/4 + C'
        ],
        correctAnswer: 0,
        marks: 1,
        explanation: '∫x ln(x) dx = (x²/2)ln(x) - x²/4 + C'
      }
    ]
  },

  {
    id: 'quadratic-discriminant-1',
    title: 'Quadratic Discriminant Analysis',
    subject: 'math',
    chapter: 'quadratic-functions',
    level: 'A1',
    difficulty: 'medium',
    totalMarks: 5,
    questionText: 'For what values of k does the equation x² + (k+1)x + k = 0 have two distinct real roots?',
    topicTags: ['discriminant', 'quadratic equations', 'inequalities'],
    steps: [
      {
        id: 'step-1',
        question: 'For a quadratic ax² + bx + c = 0 to have two distinct real roots, what condition must the discriminant satisfy?',
        options: [
          'Δ > 0',
          'Δ = 0',
          'Δ < 0',
          'Δ ≥ 0'
        ],
        correctAnswer: 0,
        marks: 1,
        explanation: 'Two distinct real roots require Δ = b² - 4ac > 0'
      },
      {
        id: 'step-2',
        question: 'For x² + (k+1)x + k = 0, identify a, b, and c:',
        options: [
          'a = 1, b = k+1, c = k',
          'a = k, b = k+1, c = 1',
          'a = 1, b = k, c = k+1',
          'a = k+1, b = 1, c = k'
        ],
        correctAnswer: 0,
        marks: 1,
        explanation: 'Comparing with ax² + bx + c = 0: a = 1, b = k+1, c = k'
      },
      {
        id: 'step-3',
        question: 'Calculate the discriminant Δ = b² - 4ac:',
        options: [
          'Δ = (k+1)² - 4k',
          'Δ = k² - 4(k+1)',
          'Δ = (k+1)² - 4(1)(k)',
          'Δ = k + 1 - 4k'
        ],
        correctAnswer: 2,
        marks: 1,
        explanation: 'Δ = (k+1)² - 4(1)(k) = (k+1)² - 4k'
      },
      {
        id: 'step-4',
        question: 'Expand (k+1)² - 4k:',
        options: [
          'k² + 2k + 1 - 4k = k² - 2k + 1',
          'k² + k + 1 - 4k = k² - 3k + 1',
          'k² + 2k - 4k = k² - 2k',
          'k² + 2k + 1 - 4k = k² + 2k - 3'
        ],
        correctAnswer: 0,
        marks: 1,
        explanation: '(k+1)² - 4k = k² + 2k + 1 - 4k = k² - 2k + 1'
      },
      {
        id: 'step-5',
        question: 'For two distinct real roots, solve k² - 2k + 1 > 0. Note that k² - 2k + 1 = (k-1)². So (k-1)² > 0 when:',
        options: [
          'k ≠ 1',
          'k > 1',
          'k < 1',
          'k = 1'
        ],
        correctAnswer: 0,
        marks: 1,
        explanation: '(k-1)² > 0 for all real k except k = 1. So k ∈ ℝ, k ≠ 1'
      }
    ]
  },

  {
    id: 'parametric-derivatives-1',
    title: 'Parametric Differentiation',
    subject: 'math',
    chapter: 'parametric-equations',
    level: 'A2',
    difficulty: 'medium',
    totalMarks: 6,
    questionText: 'Given x = t³ - 2t and y = 2t² + 1, find dy/dx in terms of t',
    topicTags: ['parametric equations', 'differentiation', 'chain rule'],
    steps: [
      {
        id: 'step-1',
        question: 'For parametric equations x = f(t), y = g(t), the formula for dy/dx is:',
        options: [
          'dy/dx = (dy/dt) × (dx/dt)',
          'dy/dx = (dy/dt) ÷ (dx/dt)',
          'dy/dx = (dx/dt) ÷ (dy/dt)',
          'dy/dx = dt/dx × dt/dy'
        ],
        correctAnswer: 1,
        marks: 1,
        explanation: 'dy/dx = (dy/dt) ÷ (dx/dt) using the chain rule'
      },
      {
        id: 'step-2',
        question: 'Find dx/dt when x = t³ - 2t:',
        options: [
          'dx/dt = 3t² - 2',
          'dx/dt = t² - 2t',
          'dx/dt = 3t² - 2t',
          'dx/dt = 3t³ - 2'
        ],
        correctAnswer: 0,
        marks: 2,
        explanation: 'dx/dt = d/dt(t³ - 2t) = 3t² - 2'
      },
      {
        id: 'step-3',
        question: 'Find dy/dt when y = 2t² + 1:',
        options: [
          'dy/dt = 4t',
          'dy/dt = 2t + 1',
          'dy/dt = 4t + 1',
          'dy/dt = 2t'
        ],
        correctAnswer: 0,
        marks: 2,
        explanation: 'dy/dt = d/dt(2t² + 1) = 4t + 0 = 4t'
      },
      {
        id: 'step-4',
        question: 'Therefore, dy/dx = (dy/dt) ÷ (dx/dt) = ?',
        options: [
          'dy/dx = 4t ÷ (3t² - 2) = 4t/(3t² - 2)',
          'dy/dx = (3t² - 2) ÷ 4t = (3t² - 2)/4t',
          'dy/dx = 4t × (3t² - 2) = 4t(3t² - 2)',
          'dy/dx = 4/(3t² - 2)'
        ],
        correctAnswer: 0,
        marks: 1,
        explanation: 'dy/dx = (dy/dt) ÷ (dx/dt) = 4t ÷ (3t² - 2) = 4t/(3t² - 2)'
      }
    ]
  }
];

// Function to get step-based questions filtered by chapter and level
export const getStepMathQuestions = (
  chapter?: string, 
  level?: 'A1' | 'A2', 
  count: number = 3
): StepBasedQuestion[] => {
  let filtered = STEP_MATH_QUESTIONS;
  
  if (chapter) {
    filtered = filtered.filter(q => q.chapter === chapter);
  }
  
  if (level) {
    filtered = filtered.filter(q => q.level === level);
  }
  
  // Shuffle and return requested count
  const shuffled = [...filtered].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

// Get questions based on difficulty and total marks
export const getStepMathQuestionsByDifficulty = (
  difficulty: 'easy' | 'medium' | 'hard',
  totalMarksRange: [number, number] = [0, 20],
  count: number = 3
): StepBasedQuestion[] => {
  const filtered = STEP_MATH_QUESTIONS.filter(q => 
    q.difficulty === difficulty && 
    q.totalMarks >= totalMarksRange[0] && 
    q.totalMarks <= totalMarksRange[1]
  );
  
  const shuffled = [...filtered].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
};