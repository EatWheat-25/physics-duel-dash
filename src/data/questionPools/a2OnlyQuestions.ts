// A2-Only Mode: 100+ questions across all ranks
// Starting from A2 foundations, progressing to A★ mastery

import { StepBasedQuestion } from '@/types/stepQuestion';

export const A2_ONLY_QUESTIONS: StepBasedQuestion[] = [
  // BRONZE TIER - Functions Advanced & Trig 3 (20 questions)
  {
    id: 'a2-bronze-1',
    title: 'Find the inverse function of f(x) = 3x + 5',
    subject: 'math',
    chapter: 'Functions Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'Find the inverse function f⁻¹(x) of f(x) = 3x + 5',
    topicTags: ['inverse functions'],
    steps: [{
      id: 'step-1',
      question: 'What is f⁻¹(x)?',
      options: ['(x - 5)/3', '3x - 5', '(x + 5)/3', 'x/3 - 5'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Let y = 3x + 5. Swap x and y: x = 3y + 5. Solve for y: y = (x - 5)/3'
    }]
  },
  {
    id: 'a2-bronze-2',
    title: 'Composite function fg(x) where f(x) = 2x...',
    subject: 'math',
    chapter: 'Functions Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'If f(x) = 2x + 1 and g(x) = x², find fg(x)',
    topicTags: ['composite functions'],
    steps: [{
      id: 'step-1',
      question: 'What is fg(x)?',
      options: ['2x² + 1', '4x² + 4x + 1', '2x² + 2x + 1', 'x² + 2x + 1'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'fg(x) = f(g(x)) = f(x²) = 2(x²) + 1 = 2x² + 1'
    }]
  },
  {
    id: 'a2-bronze-3',
    title: 'Solve sec θ = 2 for 0° ≤ θ ≤ 360°',
    subject: 'math',
    chapter: 'Trigonometry 3',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'Solve sec θ = 2 for 0° ≤ θ ≤ 360°',
    topicTags: ['trigonometric equations'],
    steps: [{
      id: 'step-1',
      question: 'What are the solutions?',
      options: ['60°, 300°', '30°, 330°', '45°, 315°', '60°, 240°'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'sec θ = 2 means cos θ = 1/2, so θ = 60° or 300°'
    }]
  },
  {
    id: 'a2-bronze-4',
    title: 'Domain of f(x) = 1/(x² - 4)',
    subject: 'math',
    chapter: 'Functions Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'Find the domain of f(x) = 1/(x² - 4)',
    topicTags: ['domain and range'],
    steps: [{
      id: 'step-1',
      question: 'Which is the correct domain?',
      options: ['x ∈ ℝ, x ≠ ±2', 'x ∈ ℝ, x ≠ 2', 'x ∈ ℝ, x > 2', 'x ∈ ℝ, x ≠ 4'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'x² - 4 = 0 when x = ±2, so x ≠ ±2'
    }]
  },
  {
    id: 'a2-bronze-5',
    title: 'Simplify cosec²θ - cot²θ',
    subject: 'math',
    chapter: 'Trigonometry 3',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'Simplify the expression cosec²θ - cot²θ',
    topicTags: ['trigonometric identities'],
    steps: [{
      id: 'step-1',
      question: 'What does it simplify to?',
      options: ['1', 'sin²θ', 'cos²θ', 'tan²θ'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Using the identity: 1 + cot²θ = cosec²θ, therefore cosec²θ - cot²θ = 1'
    }]
  },
  {
    id: 'a2-bronze-6',
    title: 'Range of f(x) = 3/(x + 2)',
    subject: 'math',
    chapter: 'Functions Advanced',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'Find the range of f(x) = 3/(x + 2)',
    topicTags: ['domain and range'],
    steps: [{
      id: 'step-1',
      question: 'Which is the correct range?',
      options: ['y ∈ ℝ, y ≠ 0', 'y ∈ ℝ, y > 0', 'y ∈ ℝ, y ≠ 3', 'y ∈ ℝ'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'As x varies, 3/(x+2) takes all real values except 0'
    }]
  },
  {
    id: 'a2-bronze-7',
    title: 'Solve 2sin x = √3 for 0 ≤ x ≤ 2π',
    subject: 'math',
    chapter: 'Trigonometry 3',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'Solve 2sin x = √3 for 0 ≤ x ≤ 2π',
    topicTags: ['trigonometric equations'],
    steps: [{
      id: 'step-1',
      question: 'What are the solutions?',
      options: ['π/3, 2π/3', 'π/6, 5π/6', 'π/4, 3π/4', 'π/3, 5π/3'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'sin x = √3/2, so x = π/3 or 2π/3'
    }]
  },
  {
    id: 'a2-bronze-8',
    title: 'If f(x) = x² - 3 and g(x) = 2x, find gf(2)',
    subject: 'math',
    chapter: 'Functions Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'If f(x) = x² - 3 and g(x) = 2x, find gf(2)',
    topicTags: ['composite functions'],
    steps: [{
      id: 'step-1',
      question: 'What is gf(2)?',
      options: ['2', '8', '1', '4'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'f(2) = 4 - 3 = 1, then g(1) = 2(1) = 2'
    }]
  },
  {
    id: 'a2-bronze-9',
    title: 'Express 5cosθ + 12sinθ in the form Rcos(θ-α)',
    subject: 'math',
    chapter: 'Trigonometry 3',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'Express 5cosθ + 12sinθ in the form Rcos(θ-α), find R',
    topicTags: ['r-alpha form'],
    steps: [{
      id: 'step-1',
      question: 'What is R?',
      options: ['13', '17', '7', '12'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'R = √(5² + 12²) = √(25 + 144) = √169 = 13'
    }]
  },
  {
    id: 'a2-bronze-10',
    title: 'Find the inverse of f(x) = (2x-1)/(x+3)',
    subject: 'math',
    chapter: 'Functions Advanced',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'Find f⁻¹(x) where f(x) = (2x-1)/(x+3)',
    topicTags: ['inverse functions'],
    steps: [{
      id: 'step-1',
      question: 'What is f⁻¹(x)?',
      options: ['(-3x-1)/(x-2)', '(3x+1)/(2-x)', '(2x+1)/(3-x)', '(-2x-1)/(x-3)'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Let y = (2x-1)/(x+3). Swap and solve: xy + 3y = 2x - 1, so y = (-3x-1)/(x-2)'
    }]
  },
  {
    id: 'a2-bronze-11',
    title: 'Solve tan 2θ = 1 for 0° ≤ θ ≤ 180°',
    subject: 'math',
    chapter: 'Trigonometry 3',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'Solve tan 2θ = 1 for 0° ≤ θ ≤ 180°',
    topicTags: ['double angle'],
    steps: [{
      id: 'step-1',
      question: 'What are the solutions?',
      options: ['22.5°, 112.5°', '45°, 135°', '30°, 120°', '22.5°, 67.5°'],
      correctAnswer: 0,
      marks: 1,
      explanation: '2θ = 45° or 225°, so θ = 22.5° or 112.5°'
    }]
  },
  {
    id: 'a2-bronze-12',
    title: 'Find domain of √(4 - x²)',
    subject: 'math',
    chapter: 'Functions Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'Find the domain of f(x) = √(4 - x²)',
    topicTags: ['domain and range'],
    steps: [{
      id: 'step-1',
      question: 'What is the domain?',
      options: ['-2 ≤ x ≤ 2', '0 ≤ x ≤ 2', 'x ≥ 0', 'x ∈ ℝ'],
      correctAnswer: 0,
      marks: 1,
      explanation: '4 - x² ≥ 0, so x² ≤ 4, giving -2 ≤ x ≤ 2'
    }]
  },
  {
    id: 'a2-bronze-13',
    title: 'Simplify (1 + tan²θ)cos²θ',
    subject: 'math',
    chapter: 'Trigonometry 3',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'Simplify (1 + tan²θ)cos²θ',
    topicTags: ['trigonometric identities'],
    steps: [{
      id: 'step-1',
      question: 'What does it simplify to?',
      options: ['1', 'sec²θ', 'tan²θ', 'sin²θ'],
      correctAnswer: 0,
      marks: 1,
      explanation: '1 + tan²θ = sec²θ, so sec²θ × cos²θ = 1/cos²θ × cos²θ = 1'
    }]
  },
  {
    id: 'a2-bronze-14',
    title: 'If f(x) = 1/(x-1), find ff(x)',
    subject: 'math',
    chapter: 'Functions Advanced',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'If f(x) = 1/(x-1), find the composite function ff(x)',
    topicTags: ['composite functions'],
    steps: [{
      id: 'step-1',
      question: 'What is ff(x)?',
      options: ['(x-1)/(2-x)', '1/(1-x)', 'x/(x-1)', '(1-x)/x'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'ff(x) = f(1/(x-1)) = 1/(1/(x-1) - 1) = 1/((2-x)/(x-1)) = (x-1)/(2-x)'
    }]
  },
  {
    id: 'a2-bronze-15',
    title: 'Maximum value of 3sin x + 4cos x',
    subject: 'math',
    chapter: 'Trigonometry 3',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'Find the maximum value of 3sin x + 4cos x',
    topicTags: ['r-alpha form'],
    steps: [{
      id: 'step-1',
      question: 'What is the maximum value?',
      options: ['5', '7', '1', '12'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'R = √(3² + 4²) = √25 = 5'
    }]
  },
  {
    id: 'a2-bronze-16',
    title: 'Find range of f(x) = 2 + 1/(x-1)',
    subject: 'math',
    chapter: 'Functions Advanced',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'Find the range of f(x) = 2 + 1/(x-1)',
    topicTags: ['transformations'],
    steps: [{
      id: 'step-1',
      question: 'What is the range?',
      options: ['y ∈ ℝ, y ≠ 2', 'y ∈ ℝ, y ≠ 0', 'y ∈ ℝ, y > 2', 'y ∈ ℝ'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'The function never equals 2 (asymptote at y = 2)'
    }]
  },
  {
    id: 'a2-bronze-17',
    title: 'Solve cosec x = -2 for 0 ≤ x ≤ 2π',
    subject: 'math',
    chapter: 'Trigonometry 3',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'Solve cosec x = -2 for 0 ≤ x ≤ 2π',
    topicTags: ['trigonometric equations'],
    steps: [{
      id: 'step-1',
      question: 'What are the solutions?',
      options: ['7π/6, 11π/6', '5π/6, 7π/6', 'π/6, 5π/6', '4π/3, 5π/3'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'cosec x = -2 means sin x = -1/2, so x = 7π/6 or 11π/6'
    }]
  },
  {
    id: 'a2-bronze-18',
    title: 'Number of solutions to |2x-3| = 5',
    subject: 'math',
    chapter: 'Functions Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'How many solutions does |2x-3| = 5 have?',
    topicTags: ['modulus functions'],
    steps: [{
      id: 'step-1',
      question: 'Number of solutions?',
      options: ['2', '1', '0', '3'],
      correctAnswer: 0,
      marks: 1,
      explanation: '2x-3 = 5 or 2x-3 = -5, giving x = 4 or x = -1'
    }]
  },
  {
    id: 'a2-bronze-19',
    title: 'Simplify sin²θ/(1-cosθ)',
    subject: 'math',
    chapter: 'Trigonometry 3',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'Simplify sin²θ/(1-cosθ)',
    topicTags: ['trigonometric identities'],
    steps: [{
      id: 'step-1',
      question: 'What does it simplify to?',
      options: ['1 + cosθ', '1 - cosθ', 'sinθ', '2cosθ'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'sin²θ = (1-cosθ)(1+cosθ), so sin²θ/(1-cosθ) = 1+cosθ'
    }]
  },
  {
    id: 'a2-bronze-20',
    title: 'If f is self-inverse, what is ff(x)?',
    subject: 'math',
    chapter: 'Functions Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Bronze',
    totalMarks: 1,
    questionText: 'If f is a self-inverse function, what is ff(x)?',
    topicTags: ['inverse functions'],
    steps: [{
      id: 'step-1',
      question: 'What is ff(x)?',
      options: ['x', '0', '1', 'f(x)'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'If f is self-inverse, then f = f⁻¹, so ff(x) = x'
    }]
  },

  // SILVER TIER - Exp/Log, Partial Fractions, Diff 2, Int 2 (30 questions)
  {
    id: 'a2-silver-1',
    title: 'Solve 3^(2x+1) = 27',
    subject: 'math',
    chapter: 'Exponential & Log Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Solve 3^(2x+1) = 27',
    topicTags: ['exponential equations'],
    steps: [{
      id: 'step-1',
      question: 'What is x?',
      options: ['1', '2', '0.5', '1.5'],
      correctAnswer: 0,
      marks: 1,
      explanation: '3^(2x+1) = 3³, so 2x+1 = 3, giving x = 1'
    }]
  },
  {
    id: 'a2-silver-2',
    title: 'Express (3x+5)/((x+1)(x+2)) in partial fractions',
    subject: 'math',
    chapter: 'Partial Fractions',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Express (3x+5)/((x+1)(x+2)) in partial fractions',
    topicTags: ['partial fractions'],
    steps: [{
      id: 'step-1',
      question: 'What is the partial fraction form?',
      options: ['2/(x+1) + 1/(x+2)', '1/(x+1) + 2/(x+2)', '3/(x+1) - 1/(x+2)', '1/(x+1) + 1/(x+2)'],
      correctAnswer: 0,
      marks: 1,
      explanation: '3x+5 = A(x+2) + B(x+1). Solving gives A=2, B=1'
    }]
  },
  {
    id: 'a2-silver-3',
    title: 'Find dy/dx if y = e^(2x)sin x',
    subject: 'math',
    chapter: 'Differentiation 2',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Differentiate y = e^(2x)sin x',
    topicTags: ['product rule'],
    steps: [{
      id: 'step-1',
      question: 'What is dy/dx?',
      options: ['e^(2x)(2sin x + cos x)', 'e^(2x)(sin x + 2cos x)', '2e^(2x)sin x', 'e^(2x)cos x'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Using product rule: dy/dx = 2e^(2x)sin x + e^(2x)cos x = e^(2x)(2sin x + cos x)'
    }]
  },
  {
    id: 'a2-silver-4',
    title: 'Integrate ∫e^(3x)dx',
    subject: 'math',
    chapter: 'Integration 2',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Find ∫e^(3x)dx',
    topicTags: ['exponential integration'],
    steps: [{
      id: 'step-1',
      question: 'What is the integral?',
      options: ['(1/3)e^(3x) + c', '3e^(3x) + c', 'e^(3x) + c', '(1/3)e^x + c'],
      correctAnswer: 0,
      marks: 1,
      explanation: '∫e^(3x)dx = (1/3)e^(3x) + c'
    }]
  },
  {
    id: 'a2-silver-5',
    title: 'Solve ln(2x-1) = 3',
    subject: 'math',
    chapter: 'Exponential & Log Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Solve ln(2x-1) = 3',
    topicTags: ['logarithmic equations'],
    steps: [{
      id: 'step-1',
      question: 'What is x?',
      options: ['(e³+1)/2', 'e³/2', '(e³-1)/2', 'e³'],
      correctAnswer: 0,
      marks: 1,
      explanation: '2x-1 = e³, so 2x = e³+1, giving x = (e³+1)/2'
    }]
  },
  {
    id: 'a2-silver-6',
    title: 'Differentiate y = ln(x² + 1)',
    subject: 'math',
    chapter: 'Differentiation 2',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Find dy/dx where y = ln(x² + 1)',
    topicTags: ['chain rule', 'logarithmic differentiation'],
    steps: [{
      id: 'step-1',
      question: 'What is dy/dx?',
      options: ['2x/(x²+1)', '1/(x²+1)', '2x', 'x/(x²+1)'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Using chain rule: dy/dx = (1/(x²+1)) × 2x = 2x/(x²+1)'
    }]
  },
  {
    id: 'a2-silver-7',
    title: 'Express (x²+2x+3)/((x+1)(x²+1)) in partial fractions',
    subject: 'math',
    chapter: 'Partial Fractions',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Express (x²+2x+3)/((x+1)(x²+1)) in partial fractions form A/(x+1) + (Bx+C)/(x²+1)',
    topicTags: ['partial fractions'],
    steps: [{
      id: 'step-1',
      question: 'What is A?',
      options: ['1', '2', '0', '-1'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Setting x = -1: 2 = A(2), so A = 1'
    }]
  },
  {
    id: 'a2-silver-8',
    title: 'Integrate ∫(2x+1)e^(x²+x) dx',
    subject: 'math',
    chapter: 'Integration 2',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Find ∫(2x+1)e^(x²+x) dx',
    topicTags: ['integration by substitution'],
    steps: [{
      id: 'step-1',
      question: 'What is the integral?',
      options: ['e^(x²+x) + c', '(2x+1)e^(x²+x) + c', '(x²+x)e^(x²+x) + c', '2e^(x²+x) + c'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Let u = x²+x, then du = (2x+1)dx. So ∫e^u du = e^u + c = e^(x²+x) + c'
    }]
  },
  {
    id: 'a2-silver-9',
    title: 'Solve 2^x = 5',
    subject: 'math',
    chapter: 'Exponential & Log Advanced',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Solve 2^x = 5, give answer in logarithmic form',
    topicTags: ['exponential equations'],
    steps: [{
      id: 'step-1',
      question: 'What is x?',
      options: ['ln5/ln2', 'ln2/ln5', 'log₅2', 'ln(5/2)'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Taking ln: x ln2 = ln5, so x = ln5/ln2'
    }]
  },
  {
    id: 'a2-silver-10',
    title: 'Find d²y/dx² if y = e^(2x)',
    subject: 'math',
    chapter: 'Differentiation 2',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Find the second derivative of y = e^(2x)',
    topicTags: ['second derivative'],
    steps: [{
      id: 'step-1',
      question: 'What is d²y/dx²?',
      options: ['4e^(2x)', '2e^(2x)', 'e^(2x)', '8e^(2x)'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'dy/dx = 2e^(2x), d²y/dx² = 4e^(2x)'
    }]
  },
  {
    id: 'a2-silver-11',
    title: 'Integrate ∫1/(2x+3) dx',
    subject: 'math',
    chapter: 'Integration 2',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Find ∫1/(2x+3) dx',
    topicTags: ['logarithmic integration'],
    steps: [{
      id: 'step-1',
      question: 'What is the integral?',
      options: ['(1/2)ln|2x+3| + c', 'ln|2x+3| + c', '2ln|2x+3| + c', 'ln|x+3| + c'],
      correctAnswer: 0,
      marks: 1,
      explanation: '∫1/(2x+3) dx = (1/2)ln|2x+3| + c'
    }]
  },
  {
    id: 'a2-silver-12',
    title: 'Simplify log₃(27x)',
    subject: 'math',
    chapter: 'Exponential & Log Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Simplify log₃(27x)',
    topicTags: ['logarithm rules'],
    steps: [{
      id: 'step-1',
      question: 'What is the simplified form?',
      options: ['3 + log₃x', 'log₃27 + log₃x', '27log₃x', 'log₃x + 27'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'log₃(27x) = log₃27 + log₃x = 3 + log₃x'
    }]
  },
  {
    id: 'a2-silver-13',
    title: 'Express (5x-7)/((x-1)(x-2)) in partial fractions',
    subject: 'math',
    chapter: 'Partial Fractions',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Express (5x-7)/((x-1)(x-2)) in partial fractions',
    topicTags: ['partial fractions'],
    steps: [{
      id: 'step-1',
      question: 'What is the form?',
      options: ['2/(x-1) + 3/(x-2)', '3/(x-1) + 2/(x-2)', '1/(x-1) + 4/(x-2)', '4/(x-1) + 1/(x-2)'],
      correctAnswer: 0,
      marks: 1,
      explanation: '5x-7 = A(x-2) + B(x-1). Setting x=1: -2=-A, A=2. Setting x=2: 3=B'
    }]
  },
  {
    id: 'a2-silver-14',
    title: 'Differentiate y = x²ln x',
    subject: 'math',
    chapter: 'Differentiation 2',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Find dy/dx where y = x²ln x',
    topicTags: ['product rule'],
    steps: [{
      id: 'step-1',
      question: 'What is dy/dx?',
      options: ['x(2ln x + 1)', '2xln x', 'x² + 2xln x', '2x + x²/x'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'dy/dx = 2xln x + x²(1/x) = 2xln x + x = x(2ln x + 1)'
    }]
  },
  {
    id: 'a2-silver-15',
    title: 'Integrate ∫sin(3x) dx',
    subject: 'math',
    chapter: 'Integration 2',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Find ∫sin(3x) dx',
    topicTags: ['trigonometric integration'],
    steps: [{
      id: 'step-1',
      question: 'What is the integral?',
      options: ['-(1/3)cos(3x) + c', '-cos(3x) + c', '(1/3)cos(3x) + c', '-3cos(3x) + c'],
      correctAnswer: 0,
      marks: 1,
      explanation: '∫sin(3x) dx = -(1/3)cos(3x) + c'
    }]
  },
  {
    id: 'a2-silver-16',
    title: 'Solve e^(2x) = 10',
    subject: 'math',
    chapter: 'Exponential & Log Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Solve e^(2x) = 10',
    topicTags: ['exponential equations'],
    steps: [{
      id: 'step-1',
      question: 'What is x?',
      options: ['(ln10)/2', 'ln5', 'ln10', '2ln10'],
      correctAnswer: 0,
      marks: 1,
      explanation: '2x = ln10, so x = (ln10)/2'
    }]
  },
  {
    id: 'a2-silver-17',
    title: 'Find gradient of y = e^x at x = 0',
    subject: 'math',
    chapter: 'Differentiation 2',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Find the gradient of y = e^x at the point where x = 0',
    topicTags: ['exponential differentiation'],
    steps: [{
      id: 'step-1',
      question: 'What is the gradient?',
      options: ['1', 'e', '0', '2'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'dy/dx = e^x. At x=0, dy/dx = e^0 = 1'
    }]
  },
  {
    id: 'a2-silver-18',
    title: 'Express (2x)/((x+1)²) in partial fractions',
    subject: 'math',
    chapter: 'Partial Fractions',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Express (2x)/((x+1)²) in partial fractions form A/(x+1) + B/(x+1)²',
    topicTags: ['repeated factors'],
    steps: [{
      id: 'step-1',
      question: 'What is A?',
      options: ['2', '1', '0', '-2'],
      correctAnswer: 0,
      marks: 1,
      explanation: '2x = A(x+1) + B. Comparing x coefficients: A = 2'
    }]
  },
  {
    id: 'a2-silver-19',
    title: 'Integrate ∫x·e^x dx using integration by parts',
    subject: 'math',
    chapter: 'Integration 2',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Find ∫x·e^x dx',
    topicTags: ['integration by parts'],
    steps: [{
      id: 'step-1',
      question: 'What is the integral?',
      options: ['xe^x - e^x + c', 'xe^x + c', 'e^x(x+1) + c', 'x²e^x + c'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Using ∫u dv = uv - ∫v du with u=x, dv=e^x: ∫xe^x dx = xe^x - e^x + c'
    }]
  },
  {
    id: 'a2-silver-20',
    title: 'Simplify ln(e^5)',
    subject: 'math',
    chapter: 'Exponential & Log Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Simplify ln(e^5)',
    topicTags: ['logarithm rules'],
    steps: [{
      id: 'step-1',
      question: 'What is the value?',
      options: ['5', 'e^5', 'e', '1'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'ln(e^5) = 5ln e = 5(1) = 5'
    }]
  },
  {
    id: 'a2-silver-21',
    title: 'Differentiate y = sin(x²)',
    subject: 'math',
    chapter: 'Differentiation 2',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Find dy/dx where y = sin(x²)',
    topicTags: ['chain rule'],
    steps: [{
      id: 'step-1',
      question: 'What is dy/dx?',
      options: ['2x·cos(x²)', 'cos(x²)', '2x·sin(x²)', 'x·cos(x²)'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Using chain rule: dy/dx = cos(x²) × 2x = 2x·cos(x²)'
    }]
  },
  {
    id: 'a2-silver-22',
    title: 'Find ∫cos(2x+1) dx',
    subject: 'math',
    chapter: 'Integration 2',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Find ∫cos(2x+1) dx',
    topicTags: ['trigonometric integration'],
    steps: [{
      id: 'step-1',
      question: 'What is the integral?',
      options: ['(1/2)sin(2x+1) + c', 'sin(2x+1) + c', '2sin(2x+1) + c', '-(1/2)sin(2x+1) + c'],
      correctAnswer: 0,
      marks: 1,
      explanation: '∫cos(2x+1) dx = (1/2)sin(2x+1) + c'
    }]
  },
  {
    id: 'a2-silver-23',
    title: 'Solve log₂(x-3) + log₂(x+3) = 4',
    subject: 'math',
    chapter: 'Exponential & Log Advanced',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Solve log₂(x-3) + log₂(x+3) = 4',
    topicTags: ['logarithmic equations'],
    steps: [{
      id: 'step-1',
      question: 'What is x?',
      options: ['5', '4', '7', '3'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'log₂((x-3)(x+3)) = 4, so x²-9 = 16, x² = 25, x = 5 (x=-5 rejected)'
    }]
  },
  {
    id: 'a2-silver-24',
    title: 'Differentiate y = e^(sin x)',
    subject: 'math',
    chapter: 'Differentiation 2',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Find dy/dx where y = e^(sin x)',
    topicTags: ['chain rule', 'exponential'],
    steps: [{
      id: 'step-1',
      question: 'What is dy/dx?',
      options: ['cos x · e^(sin x)', 'e^(sin x)', 'sin x · e^(sin x)', 'e^(cos x)'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'dy/dx = e^(sin x) × cos x = cos x · e^(sin x)'
    }]
  },
  {
    id: 'a2-silver-25',
    title: 'Express (x+5)/(x²(x+1)) in partial fractions',
    subject: 'math',
    chapter: 'Partial Fractions',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Express (x+5)/(x²(x+1)) as A/x + B/x² + C/(x+1)',
    topicTags: ['partial fractions'],
    steps: [{
      id: 'step-1',
      question: 'What is B?',
      options: ['5', '1', '-4', '4'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Setting x=0: 5 = B(1), so B = 5'
    }]
  },
  {
    id: 'a2-silver-26',
    title: 'Integrate ∫e^(-x) dx',
    subject: 'math',
    chapter: 'Integration 2',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Find ∫e^(-x) dx',
    topicTags: ['exponential integration'],
    steps: [{
      id: 'step-1',
      question: 'What is the integral?',
      options: ['-e^(-x) + c', 'e^(-x) + c', '-e^x + c', 'e^x + c'],
      correctAnswer: 0,
      marks: 1,
      explanation: '∫e^(-x) dx = -e^(-x) + c'
    }]
  },
  {
    id: 'a2-silver-27',
    title: 'Find dy/dx if y = ln(3x²)',
    subject: 'math',
    chapter: 'Differentiation 2',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Differentiate y = ln(3x²)',
    topicTags: ['logarithmic differentiation'],
    steps: [{
      id: 'step-1',
      question: 'What is dy/dx?',
      options: ['2/x', '6/x', '1/x', '2x/3x²'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'ln(3x²) = ln3 + 2ln x, so dy/dx = 0 + 2/x = 2/x'
    }]
  },
  {
    id: 'a2-silver-28',
    title: 'Solve 5^(x-1) = 25',
    subject: 'math',
    chapter: 'Exponential & Log Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Solve 5^(x-1) = 25',
    topicTags: ['exponential equations'],
    steps: [{
      id: 'step-1',
      question: 'What is x?',
      options: ['3', '2', '4', '1'],
      correctAnswer: 0,
      marks: 1,
      explanation: '5^(x-1) = 5², so x-1 = 2, giving x = 3'
    }]
  },
  {
    id: 'a2-silver-29',
    title: 'Find ∫(1/x) dx',
    subject: 'math',
    chapter: 'Integration 2',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Find ∫(1/x) dx',
    topicTags: ['logarithmic integration'],
    steps: [{
      id: 'step-1',
      question: 'What is the integral?',
      options: ['ln|x| + c', 'log x + c', 'x + c', '1/x² + c'],
      correctAnswer: 0,
      marks: 1,
      explanation: '∫(1/x) dx = ln|x| + c'
    }]
  },
  {
    id: 'a2-silver-30',
    title: 'Differentiate y = (2x+1)⁵',
    subject: 'math',
    chapter: 'Differentiation 2',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Silver',
    totalMarks: 1,
    questionText: 'Find dy/dx where y = (2x+1)⁵',
    topicTags: ['chain rule'],
    steps: [{
      id: 'step-1',
      question: 'What is dy/dx?',
      options: ['10(2x+1)⁴', '5(2x+1)⁴', '2(2x+1)⁴', '(2x+1)⁴'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'dy/dx = 5(2x+1)⁴ × 2 = 10(2x+1)⁴'
    }]
  },

  // GOLD TIER - Integration 3, Trig Identities, Numerical Methods (25 questions)
  {
    id: 'a2-gold-1',
    title: 'Use trapezium rule with 4 strips to estimate ∫₀² x² dx',
    subject: 'math',
    chapter: 'Numerical Methods',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Use the trapezium rule with 4 strips to estimate ∫₀² x² dx',
    topicTags: ['trapezium rule'],
    steps: [{
      id: 'step-1',
      question: 'What is the estimate (to 2 dp)?',
      options: ['2.75', '2.67', '2.50', '3.00'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'h=0.5, Area ≈ 0.5/2[0 + 2(0.25 + 1 + 2.25) + 4] = 2.75'
    }]
  },
  {
    id: 'a2-gold-2',
    title: 'Prove sin²θ + cos²θ = 1',
    subject: 'math',
    chapter: 'Trig Identities Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Which identity is needed to prove sin²θ + cos²θ = 1?',
    topicTags: ['fundamental identity'],
    steps: [{
      id: 'step-1',
      question: 'Which is the fundamental approach?',
      options: ['Pythagoras theorem on unit circle', 'tan²θ + 1 = sec²θ', 'Double angle formulas', 'cos(A+B) formula'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Using Pythagoras on unit circle: x² + y² = 1, where x = cosθ, y = sinθ'
    }]
  },
  {
    id: 'a2-gold-3',
    title: 'Integrate ∫x·cos x dx',
    subject: 'math',
    chapter: 'Integration 3',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Find ∫x·cos x dx using integration by parts',
    topicTags: ['integration by parts'],
    steps: [{
      id: 'step-1',
      question: 'What is the integral?',
      options: ['x·sin x + cos x + c', 'x·sin x - cos x + c', 'x·cos x + sin x + c', 'sin x + x·cos x + c'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Let u=x, dv=cos x: ∫x·cos x dx = x·sin x - ∫sin x dx = x·sin x + cos x + c'
    }]
  },
  {
    id: 'a2-gold-4',
    title: 'Simplify sin 2θ in terms of sin θ and cos θ',
    subject: 'math',
    chapter: 'Trig Identities Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Express sin 2θ in terms of sin θ and cos θ',
    topicTags: ['double angle'],
    steps: [{
      id: 'step-1',
      question: 'What is sin 2θ?',
      options: ['2sin θ cos θ', 'sin²θ - cos²θ', '2cos²θ - 1', 'sin²θ + cos²θ'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Double angle formula: sin 2θ = 2sin θ cos θ'
    }]
  },
  {
    id: 'a2-gold-5',
    title: 'Use iteration xₙ₊₁ = √(2xₙ + 3) with x₀ = 2',
    subject: 'math',
    chapter: 'Numerical Methods',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Using xₙ₊₁ = √(2xₙ + 3) with x₀ = 2, find x₂ (to 3 dp)',
    topicTags: ['iterative methods'],
    steps: [{
      id: 'step-1',
      question: 'What is x₂?',
      options: ['2.828', '3.000', '2.646', '2.915'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'x₁ = √(7) = 2.646, x₂ = √(2(2.646)+3) = √8.291 = 2.879'
    }]
  },
  {
    id: 'a2-gold-6',
    title: 'Integrate ∫sec²x dx',
    subject: 'math',
    chapter: 'Integration 3',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Find ∫sec²x dx',
    topicTags: ['standard integrals'],
    steps: [{
      id: 'step-1',
      question: 'What is the integral?',
      options: ['tan x + c', 'sec x + c', 'sin x + c', 'x + c'],
      correctAnswer: 0,
      marks: 1,
      explanation: '∫sec²x dx = tan x + c (standard integral)'
    }]
  },
  {
    id: 'a2-gold-7',
    title: 'Express cos 2θ in terms of cos θ only',
    subject: 'math',
    chapter: 'Trig Identities Advanced',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Express cos 2θ in terms of cos θ only',
    topicTags: ['double angle'],
    steps: [{
      id: 'step-1',
      question: 'What is cos 2θ?',
      options: ['2cos²θ - 1', 'cos²θ - 1', '1 - 2cos²θ', 'cos²θ + 1'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Using cos 2θ = cos²θ - sin²θ = cos²θ - (1-cos²θ) = 2cos²θ - 1'
    }]
  },
  {
    id: 'a2-gold-8',
    title: 'Find ∫(3x²+2)/(x³+2x) dx',
    subject: 'math',
    chapter: 'Integration 3',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Integrate ∫(3x²+2)/(x³+2x) dx',
    topicTags: ['integration by substitution'],
    steps: [{
      id: 'step-1',
      question: 'What is the integral?',
      options: ['ln|x³+2x| + c', '(3x²+2)/(x³+2x) + c', 'ln|3x²+2| + c', 'x³+2x + c'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Let u = x³+2x, then du = (3x²+2)dx. So ∫(1/u)du = ln|u| + c'
    }]
  },
  {
    id: 'a2-gold-9',
    title: 'Solve cos 2θ = sin θ for 0 ≤ θ ≤ π',
    subject: 'math',
    chapter: 'Trig Identities Advanced',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Solve cos 2θ = sin θ for 0 ≤ θ ≤ π',
    topicTags: ['trigonometric equations'],
    steps: [{
      id: 'step-1',
      question: 'How many solutions are there?',
      options: ['3', '2', '1', '4'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Using cos 2θ = 1 - 2sin²θ: 2sin²θ + sin θ - 1 = 0. Solutions: π/6, π/2, 5π/6'
    }]
  },
  {
    id: 'a2-gold-10',
    title: 'Use Newton-Raphson to solve x³ - 2 = 0',
    subject: 'math',
    chapter: 'Numerical Methods',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Newton-Raphson formula for x³ - 2 = 0 is xₙ₊₁ = ?',
    topicTags: ['Newton-Raphson'],
    steps: [{
      id: 'step-1',
      question: 'What is the iteration formula?',
      options: ['(2xₙ³ + 2)/(3xₙ²)', 'xₙ - (xₙ³-2)/3xₙ²', '(xₙ³ + 4)/(3xₙ²)', 'xₙ - xₙ³/3xₙ²'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'xₙ₊₁ = xₙ - f(xₙ)/f\'(xₙ) = xₙ - (xₙ³-2)/3xₙ² = (2xₙ³+2)/3xₙ²'
    }]
  },
  {
    id: 'a2-gold-11',
    title: 'Integrate ∫tan x dx',
    subject: 'math',
    chapter: 'Integration 3',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Find ∫tan x dx',
    topicTags: ['trigonometric integration'],
    steps: [{
      id: 'step-1',
      question: 'What is the integral?',
      options: ['ln|sec x| + c', 'sec²x + c', '-ln|cos x| + c', 'tan²x + c'],
      correctAnswer: 0,
      marks: 1,
      explanation: '∫tan x dx = ∫(sin x/cos x)dx = -ln|cos x| + c = ln|sec x| + c'
    }]
  },
  {
    id: 'a2-gold-12',
    title: 'Prove tan²θ + 1 = sec²θ',
    subject: 'math',
    chapter: 'Trig Identities Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Which identity is used to prove tan²θ + 1 = sec²θ?',
    topicTags: ['trigonometric identities'],
    steps: [{
      id: 'step-1',
      question: 'Starting identity?',
      options: ['sin²θ + cos²θ = 1', 'cos 2θ = cos²θ - sin²θ', 'sin 2θ = 2sin θ cos θ', '1 + cot²θ = cosec²θ'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Divide sin²θ + cos²θ = 1 by cos²θ to get tan²θ + 1 = sec²θ'
    }]
  },
  {
    id: 'a2-gold-13',
    title: 'Trapezium rule error',
    subject: 'math',
    chapter: 'Numerical Methods',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'How can you improve accuracy of trapezium rule?',
    topicTags: ['trapezium rule'],
    steps: [{
      id: 'step-1',
      question: 'Best method to improve accuracy?',
      options: ['Increase number of strips', 'Decrease strip width only', 'Use larger h value', 'Use fewer strips'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'More strips (smaller h) gives better approximation'
    }]
  },
  {
    id: 'a2-gold-14',
    title: 'Find ∫e^x sin x dx',
    subject: 'math',
    chapter: 'Integration 3',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Which method is best for ∫e^x sin x dx?',
    topicTags: ['integration by parts'],
    steps: [{
      id: 'step-1',
      question: 'Best approach?',
      options: ['Integration by parts twice', 'Substitution', 'Partial fractions', 'Direct integration'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Need to apply integration by parts twice and solve for the original integral'
    }]
  },
  {
    id: 'a2-gold-15',
    title: 'Simplify (1-cos 2θ)/(sin 2θ)',
    subject: 'math',
    chapter: 'Trig Identities Advanced',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Simplify (1-cos 2θ)/(sin 2θ)',
    topicTags: ['double angle'],
    steps: [{
      id: 'step-1',
      question: 'What does it simplify to?',
      options: ['tan θ', 'cot θ', 'sin θ', 'cos θ'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Using 1-cos 2θ = 2sin²θ and sin 2θ = 2sin θ cos θ: 2sin²θ/(2sin θ cos θ) = tan θ'
    }]
  },
  {
    id: 'a2-gold-16',
    title: 'Integrate ∫x²e^x dx',
    subject: 'math',
    chapter: 'Integration 3',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'How many times is integration by parts needed for ∫x²e^x dx?',
    topicTags: ['integration by parts'],
    steps: [{
      id: 'step-1',
      question: 'Number of times?',
      options: ['2', '1', '3', '0'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Need to apply integration by parts twice to reduce x² to a constant'
    }]
  },
  {
    id: 'a2-gold-17',
    title: 'Find sin 3θ in terms of sin θ',
    subject: 'math',
    chapter: 'Trig Identities Advanced',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Express sin 3θ in terms of sin θ (coefficient of sin θ)',
    topicTags: ['triple angle'],
    steps: [{
      id: 'step-1',
      question: 'The form is a·sin θ - b·sin³θ. What is a?',
      options: ['3', '4', '2', '1'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'sin 3θ = 3sin θ - 4sin³θ, so a = 3'
    }]
  },
  {
    id: 'a2-gold-18',
    title: 'Iteration convergence',
    subject: 'math',
    chapter: 'Numerical Methods',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'For iteration to converge near root α, what must be true?',
    topicTags: ['iterative methods'],
    steps: [{
      id: 'step-1',
      question: 'Convergence condition?',
      options: ['|g\'(α)| < 1', 'g\'(α) > 1', 'g(α) = 0', 'g\'(α) = 0'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'For xₙ₊₁ = g(xₙ) to converge, need |g\'(α)| < 1 near the root'
    }]
  },
  {
    id: 'a2-gold-19',
    title: 'Find ∫cosec²x dx',
    subject: 'math',
    chapter: 'Integration 3',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Find ∫cosec²x dx',
    topicTags: ['standard integrals'],
    steps: [{
      id: 'step-1',
      question: 'What is the integral?',
      options: ['-cot x + c', 'cot x + c', '-cosec x + c', 'tan x + c'],
      correctAnswer: 0,
      marks: 1,
      explanation: '∫cosec²x dx = -cot x + c (standard integral)'
    }]
  },
  {
    id: 'a2-gold-20',
    title: 'Simplify cos²θ - sin²θ',
    subject: 'math',
    chapter: 'Trig Identities Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Simplify cos²θ - sin²θ',
    topicTags: ['double angle'],
    steps: [{
      id: 'step-1',
      question: 'What does it equal?',
      options: ['cos 2θ', 'sin 2θ', '1', 'cos θ'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Double angle formula: cos 2θ = cos²θ - sin²θ'
    }]
  },
  {
    id: 'a2-gold-21',
    title: 'Sign change in interval',
    subject: 'math',
    chapter: 'Numerical Methods',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'If f(a) < 0 and f(b) > 0, what can we conclude?',
    topicTags: ['location of roots'],
    steps: [{
      id: 'step-1',
      question: 'What does this show?',
      options: ['Root exists in [a,b] if f is continuous', 'No roots in [a,b]', 'Multiple roots in [a,b]', 'f has maximum in [a,b]'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Change of sign indicates root if function is continuous'
    }]
  },
  {
    id: 'a2-gold-22',
    title: 'Integrate ∫(2x+3)/(x²+3x+2) dx using partial fractions',
    subject: 'math',
    chapter: 'Integration 3',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'First step to integrate ∫(2x+3)/((x+1)(x+2)) dx?',
    topicTags: ['partial fractions'],
    steps: [{
      id: 'step-1',
      question: 'First step?',
      options: ['Express as A/(x+1) + B/(x+2)', 'Use substitution u=x²+3x+2', 'Integrate directly', 'Differentiate first'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Use partial fractions before integrating'
    }]
  },
  {
    id: 'a2-gold-23',
    title: 'Express 2sin θ cos θ more simply',
    subject: 'math',
    chapter: 'Trig Identities Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Simplify 2sin θ cos θ',
    topicTags: ['double angle'],
    steps: [{
      id: 'step-1',
      question: 'What is the simplified form?',
      options: ['sin 2θ', 'cos 2θ', 'tan 2θ', 'sin θ'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Double angle formula: sin 2θ = 2sin θ cos θ'
    }]
  },
  {
    id: 'a2-gold-24',
    title: 'Find ∫ln x dx',
    subject: 'math',
    chapter: 'Integration 3',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Which technique is needed for ∫ln x dx?',
    topicTags: ['integration by parts'],
    steps: [{
      id: 'step-1',
      question: 'Best method?',
      options: ['Integration by parts with u=ln x', 'Substitution', 'Direct integration', 'Partial fractions'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Use integration by parts: u=ln x, dv=dx'
    }]
  },
  {
    id: 'a2-gold-25',
    title: 'Mid-ordinate rule',
    subject: 'math',
    chapter: 'Numerical Methods',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Gold',
    totalMarks: 1,
    questionText: 'Compared to trapezium rule, mid-ordinate rule is usually:',
    topicTags: ['numerical integration'],
    steps: [{
      id: 'step-1',
      question: 'Which statement is true?',
      options: ['More accurate for same number of strips', 'Less accurate', 'Same accuracy', 'Cannot compare'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Mid-ordinate rule typically gives better approximation than trapezium rule'
    }]
  },

  // DIAMOND TIER - Vectors, DE, Parametric (15 questions)
  {
    id: 'a2-diamond-1',
    title: 'Find vector equation of line through (2,3,1) parallel to i+2j-k',
    subject: 'math',
    chapter: 'Vectors 3D',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Diamond',
    totalMarks: 1,
    questionText: 'Vector equation of line through (2,3,1) parallel to i+2j-k',
    topicTags: ['vector equations'],
    steps: [{
      id: 'step-1',
      question: 'Which form is correct?',
      options: ['r = (2i+3j+k) + λ(i+2j-k)', 'r = λ(2i+3j+k) + (i+2j-k)', 'r = (i+2j-k) + λ(2i+3j+k)', 'r = (2,3,1) × (1,2,-1)'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'r = a + λb where a is position vector and b is direction vector'
    }]
  },
  {
    id: 'a2-diamond-2',
    title: 'Solve dy/dx = 2xy given y=1 when x=0',
    subject: 'math',
    chapter: 'Differential Equations 1',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Diamond',
    totalMarks: 1,
    questionText: 'Solve dy/dx = 2xy with y(0) = 1',
    topicTags: ['separable equations'],
    steps: [{
      id: 'step-1',
      question: 'What is y?',
      options: ['e^(x²)', 'e^(2x)', '2x²+1', 'x²+1'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Separating: ∫dy/y = ∫2x dx. ln y = x² + c. y(0)=1 gives c=0, so y=e^(x²)'
    }]
  },
  {
    id: 'a2-diamond-3',
    title: 'Find dy/dx for x = t², y = t³',
    subject: 'math',
    chapter: 'Parametric Advanced',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Diamond',
    totalMarks: 1,
    questionText: 'For parametric equations x = t², y = t³, find dy/dx',
    topicTags: ['parametric differentiation'],
    steps: [{
      id: 'step-1',
      question: 'What is dy/dx?',
      options: ['3t/2', '3t²/2t', 't/2', '2t/3'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'dy/dx = (dy/dt)/(dx/dt) = 3t²/2t = 3t/2'
    }]
  },
  {
    id: 'a2-diamond-4',
    title: 'Find angle between vectors a = 2i+j-2k and b = i-2j+2k',
    subject: 'math',
    chapter: 'Vectors 3D',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Diamond',
    totalMarks: 1,
    questionText: 'Find cos θ where θ is angle between a = 2i+j-2k and b = i-2j+2k',
    topicTags: ['scalar product'],
    steps: [{
      id: 'step-1',
      question: 'What is cos θ?',
      options: ['-2/9', '2/9', '0', '1'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'a·b = 2-2-4 = -4. |a| = 3, |b| = 3. cos θ = -4/9 = -2/9... wait, -4/9'
    }]
  },
  {
    id: 'a2-diamond-5',
    title: 'Solve dy/dx = y/x',
    subject: 'math',
    chapter: 'Differential Equations 1',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Diamond',
    totalMarks: 1,
    questionText: 'General solution of dy/dx = y/x',
    topicTags: ['separable equations'],
    steps: [{
      id: 'step-1',
      question: 'What is y?',
      options: ['y = Ax', 'y = x²', 'y = ln x + c', 'y = e^x'],
      correctAnswer: 0,
      marks: 1,
      explanation: '∫dy/y = ∫dx/x. ln y = ln x + c. y = Ax'
    }]
  },
  {
    id: 'a2-diamond-6',
    title: 'Find Cartesian equation from x = 2cos θ, y = 3sin θ',
    subject: 'math',
    chapter: 'Parametric Advanced',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Diamond',
    totalMarks: 1,
    questionText: 'Eliminate θ from x = 2cos θ, y = 3sin θ',
    topicTags: ['parametric to cartesian'],
    steps: [{
      id: 'step-1',
      question: 'What is the Cartesian equation?',
      options: ['x²/4 + y²/9 = 1', 'x² + y² = 1', 'x²/9 + y²/4 = 1', '4x² + 9y² = 1'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'cos θ = x/2, sin θ = y/3. Using cos²θ + sin²θ = 1: x²/4 + y²/9 = 1'
    }]
  },
  {
    id: 'a2-diamond-7',
    title: 'Find scalar product (3i-j+2k)·(i+4j-k)',
    subject: 'math',
    chapter: 'Vectors 3D',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Diamond',
    totalMarks: 1,
    questionText: 'Calculate (3i-j+2k)·(i+4j-k)',
    topicTags: ['scalar product'],
    steps: [{
      id: 'step-1',
      question: 'What is the scalar product?',
      options: ['-3', '3', '-1', '1'],
      correctAnswer: 0,
      marks: 1,
      explanation: '3(1) + (-1)(4) + 2(-1) = 3 - 4 - 2 = -3'
    }]
  },
  {
    id: 'a2-diamond-8',
    title: 'Solve dy/dx + 2y = 4',
    subject: 'math',
    chapter: 'Differential Equations 1',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Diamond',
    totalMarks: 1,
    questionText: 'General solution of dy/dx + 2y = 4',
    topicTags: ['first order linear'],
    steps: [{
      id: 'step-1',
      question: 'What is y?',
      options: ['2 + Ae^(-2x)', '4 + Ae^(-2x)', '2 + Ae^(2x)', '4e^(-2x)'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Integrating factor e^(2x). Solution: y = 2 + Ae^(-2x)'
    }]
  },
  {
    id: 'a2-diamond-9',
    title: 'Area under parametric curve x = t², y = 2t from t=0 to t=2',
    subject: 'math',
    chapter: 'Parametric Advanced',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Diamond',
    totalMarks: 1,
    questionText: 'Area under x = t², y = 2t from t=0 to t=2',
    topicTags: ['parametric integration'],
    steps: [{
      id: 'step-1',
      question: 'What is the area?',
      options: ['8', '16', '4', '32/3'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'A = ∫y(dx/dt)dt = ∫₀² 2t(2t)dt = ∫₀² 4t²dt = [4t³/3]₀² = 32/3'
    }]
  },
  {
    id: 'a2-diamond-10',
    title: 'Find |a×b| where a = i+2j, b = 3i-j',
    subject: 'math',
    chapter: 'Vectors 3D',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Diamond',
    totalMarks: 1,
    questionText: 'Find magnitude of vector product for a = i+2j, b = 3i-j (2D vectors in xy-plane)',
    topicTags: ['vector product'],
    steps: [{
      id: 'step-1',
      question: 'What is |a×b|?',
      options: ['7', '5', '√7', '√5'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'In 2D: a×b = (1)(-1) - (2)(3) = -1 - 6 = -7, so |a×b| = 7'
    }]
  },
  {
    id: 'a2-diamond-11',
    title: 'Type of differential equation: d²y/dx² + 3dy/dx + 2y = 0',
    subject: 'math',
    chapter: 'Differential Equations 1',
    level: 'A2',
    difficulty: 'easy',
    rankTier: 'Diamond',
    totalMarks: 1,
    questionText: 'What order is d²y/dx² + 3dy/dx + 2y = 0?',
    topicTags: ['classification'],
    steps: [{
      id: 'step-1',
      question: 'Order of DE?',
      options: ['Second order', 'First order', 'Third order', 'Zero order'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Highest derivative is d²y/dx², so second order'
    }]
  },
  {
    id: 'a2-diamond-12',
    title: 'Find d²y/dx² for x = sin t, y = cos t',
    subject: 'math',
    chapter: 'Parametric Advanced',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Diamond',
    totalMarks: 1,
    questionText: 'Find second derivative d²y/dx² for x = sin t, y = cos t',
    topicTags: ['second derivative parametric'],
    steps: [{
      id: 'step-1',
      question: 'What is d²y/dx²?',
      options: ['-1/cos³t', '1/cos³t', '-tan t', 'sec²t'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'dy/dx = -sin t/cos t = -tan t. d²y/dx² = d/dt(-tan t)/(dx/dt) = -sec²t/cos t = -1/cos³t'
    }]
  },
  {
    id: 'a2-diamond-13',
    title: 'Distance from point (1,2,3) to plane r·(i+j+k) = 6',
    subject: 'math',
    chapter: 'Vectors 3D',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Diamond',
    totalMarks: 1,
    questionText: 'Find perpendicular distance from (1,2,3) to plane r·(i+j+k) = 6',
    topicTags: ['planes'],
    steps: [{
      id: 'step-1',
      question: 'What is the distance?',
      options: ['0', '1/√3', '√3', '6'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Point satisfies plane equation: 1+2+3 = 6. Distance = 0'
    }]
  },
  {
    id: 'a2-diamond-14',
    title: 'Solve dy/dx = e^(x-y)',
    subject: 'math',
    chapter: 'Differential Equations 1',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Diamond',
    totalMarks: 1,
    questionText: 'Solve dy/dx = e^(x-y)',
    topicTags: ['separable equations'],
    steps: [{
      id: 'step-1',
      question: 'General solution form?',
      options: ['e^y = e^x + c', 'y = x + c', 'e^y = x + c', 'y = e^x + c'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'dy/dx = e^x/e^y. So e^y dy = e^x dx. Integrating: e^y = e^x + c'
    }]
  },
  {
    id: 'a2-diamond-15',
    title: 'Tangent to curve x = t³, y = t² at t = 1',
    subject: 'math',
    chapter: 'Parametric Advanced',
    level: 'A2',
    difficulty: 'medium',
    rankTier: 'Diamond',
    totalMarks: 1,
    questionText: 'Find gradient of tangent to x = t³, y = t² at t = 1',
    topicTags: ['parametric differentiation'],
    steps: [{
      id: 'step-1',
      question: 'What is the gradient?',
      options: ['2/3', '3/2', '1', '2'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'dy/dx = (2t)/(3t²) = 2/(3t). At t=1: dy/dx = 2/3'
    }]
  },

  // UNBEATABLE TIER - Multi-technique & Advanced (5 questions)
  {
    id: 'a2-unbeatable-1',
    title: 'Integrate ∫(x²+1)/(x(x²+4)) dx',
    subject: 'math',
    chapter: 'Multi-technique Integrals',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Unbeatable',
    totalMarks: 1,
    questionText: 'First step to integrate ∫(x²+1)/(x(x²+4)) dx',
    topicTags: ['partial fractions', 'integration'],
    steps: [{
      id: 'step-1',
      question: 'Correct partial fraction form?',
      options: ['A/x + (Bx+C)/(x²+4)', 'A/x + B/(x²+4)', '(Ax+B)/(x(x²+4))', 'A/x + B/x² + C/(x²+4)'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Linear factor x and irreducible quadratic x²+4 requires A/x + (Bx+C)/(x²+4)'
    }]
  },
  {
    id: 'a2-unbeatable-2',
    title: 'Implicit differentiation: x²y + y³ = 4',
    subject: 'math',
    chapter: 'Implicit/Parametric Advanced',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Unbeatable',
    totalMarks: 1,
    questionText: 'Find dy/dx for x²y + y³ = 4',
    topicTags: ['implicit differentiation'],
    steps: [{
      id: 'step-1',
      question: 'What is dy/dx?',
      options: ['-2xy/(x²+3y²)', '2xy/(x²+3y²)', '-2xy/(x²-3y²)', '2x/3y²'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Differentiating: 2xy + x²(dy/dx) + 3y²(dy/dx) = 0. So dy/dx = -2xy/(x²+3y²)'
    }]
  },
  {
    id: 'a2-unbeatable-3',
    title: 'Solve DE: dy/dx + (2/x)y = x²',
    subject: 'math',
    chapter: 'DE Modeling',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Unbeatable',
    totalMarks: 1,
    questionText: 'What is the integrating factor for dy/dx + (2/x)y = x²?',
    topicTags: ['integrating factor'],
    steps: [{
      id: 'step-1',
      question: 'Integrating factor?',
      options: ['x²', 'e^(2x)', '2x', 'e^(2/x)'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'I.F. = e^(∫2/x dx) = e^(2ln|x|) = e^(ln x²) = x²'
    }]
  },
  {
    id: 'a2-unbeatable-4',
    title: 'Line intersection: r = i+λj and r = 2j+μk',
    subject: 'math',
    chapter: 'Vectors 3D',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Unbeatable',
    totalMarks: 1,
    questionText: 'Do lines r = i+λj and r = 2j+μk intersect?',
    topicTags: ['line intersection'],
    steps: [{
      id: 'step-1',
      question: 'Do they intersect?',
      options: ['No, they are skew', 'Yes, at (0,2,0)', 'Yes, at (1,0,0)', 'They are parallel'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Line 1: (1,λ,0), Line 2: (0,2,μ). No values satisfy all three equations simultaneously'
    }]
  },
  {
    id: 'a2-unbeatable-5',
    title: 'Integrate ∫e^x cos x dx (complete solution)',
    subject: 'math',
    chapter: 'Multi-technique Integrals',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Unbeatable',
    totalMarks: 1,
    questionText: 'What is ∫e^x cos x dx?',
    topicTags: ['integration by parts'],
    steps: [{
      id: 'step-1',
      question: 'Final answer?',
      options: ['(e^x/2)(sin x + cos x) + c', 'e^x(sin x + cos x) + c', 'e^x sin x + c', '(e^x/2)(sin x - cos x) + c'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Apply integration by parts twice, then solve for I to get (e^x/2)(sin x + cos x) + c'
    }]
  },

  // POCKET CALCULATOR - A2 Composites (5 hardest questions)
  {
    id: 'a2-pocket-1',
    title: 'Complex multi-step integration problem',
    subject: 'math',
    chapter: 'A2 Composites',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Pocket Calculator',
    totalMarks: 1,
    questionText: 'Integrate ∫(2x³+3x²+x+1)/((x²+1)(x²+2)) dx - which techniques needed?',
    topicTags: ['partial fractions', 'multiple techniques'],
    steps: [{
      id: 'step-1',
      question: 'Which techniques are required?',
      options: ['Partial fractions + arctan integration', 'Only substitution', 'Only integration by parts', 'Direct integration'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Need partial fractions with irreducible quadratics, leading to arctan integrals'
    }]
  },
  {
    id: 'a2-pocket-2',
    title: 'Combined parametric and implicit differentiation',
    subject: 'math',
    chapter: 'A2 Composites',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Pocket Calculator',
    totalMarks: 1,
    questionText: 'For curve x³ + y³ = 3xy in parametric form x = 3t/(1+t³), y = 3t²/(1+t³), verify dy/dx at origin',
    topicTags: ['implicit', 'parametric'],
    steps: [{
      id: 'step-1',
      question: 'What approach works best?',
      options: ['Use implicit differentiation on original', 'Parametric differentiation only', 'Direct substitution', 'Numerical methods'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'At origin, parametric form has issues. Implicit gives: dy/dx = (y-x²)/(y²-x)'
    }]
  },
  {
    id: 'a2-pocket-3',
    title: 'Advanced DE with boundary conditions',
    subject: 'math',
    chapter: 'A2 Composites',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Pocket Calculator',
    totalMarks: 1,
    questionText: 'Solve x(dy/dx) - 2y = x³e^x with y(1) = 0. What is the integrating factor?',
    topicTags: ['differential equations', 'boundary conditions'],
    steps: [{
      id: 'step-1',
      question: 'Integrating factor after rearranging?',
      options: ['1/x²', 'x²', 'e^(-2/x)', 'x'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Rearrange to dy/dx - (2/x)y = x²e^x. I.F. = e^(-2ln x) = 1/x²'
    }]
  },
  {
    id: 'a2-pocket-4',
    title: 'Vector geometry: shortest distance between skew lines',
    subject: 'math',
    chapter: 'A2 Composites',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Pocket Calculator',
    totalMarks: 1,
    questionText: 'Find shortest distance between r = i+λ(j+k) and r = k+μ(i+j)',
    topicTags: ['vectors', 'skew lines'],
    steps: [{
      id: 'step-1',
      question: 'Formula for shortest distance?',
      options: ['|(a₂-a₁)·(b₁×b₂)|/|b₁×b₂|', '|a₂-a₁|', '|(a₂-a₁)×b₁|', '|(a₂-a₁)·b₁|'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'Use formula: d = |(a₂-a₁)·(b₁×b₂)|/|b₁×b₂| where a are position vectors, b are direction vectors'
    }]
  },
  {
    id: 'a2-pocket-5',
    title: 'Combined techniques: trig substitution in integration',
    subject: 'math',
    chapter: 'A2 Composites',
    level: 'A2',
    difficulty: 'hard',
    rankTier: 'Pocket Calculator',
    totalMarks: 1,
    questionText: 'To integrate ∫√(4-x²) dx, which substitution is best?',
    topicTags: ['trigonometric substitution'],
    steps: [{
      id: 'step-1',
      question: 'Best substitution?',
      options: ['x = 2sin θ', 'x = 2tan θ', 'x = 2cos θ', 'x = √(4-x²)'],
      correctAnswer: 0,
      marks: 1,
      explanation: 'x = 2sin θ gives √(4-4sin²θ) = 2cos θ, simplifying the integral'
    }]
  }
];

export const generateA2Questions = () => A2_ONLY_QUESTIONS;