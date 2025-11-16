// Seed questions into Supabase database
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-questions.ts

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Minimal, clean step shape
type Step = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  marks: number;
  explanation: string;
};

type Q = {
  id?: string;
  title: string;
  subject: 'math';
  chapter: string;
  level: 'A2' | 'A1';
  difficulty: 'easy' | 'medium' | 'hard';
  rank_tier?: string;
  question_text: string;
  steps: Step[];
};

// === SAMPLE A2 QUESTIONS ===
const qs: Q[] = [
  {
    title: 'Domain of f(x) = 1/(x^2 - 4)',
    subject: 'math',
    chapter: 'Functions Advanced',
    level: 'A2',
    difficulty: 'easy',
    question_text: 'Find the domain of f(x) = 1/(x^2 - 4).',
    steps: [
      {
        id: 's1',
        question: 'Which x make the denominator zero?',
        options: ['x = 0', 'x = ±2', 'x = ±4', 'no real x'],
        correctAnswer: 1,
        marks: 1,
        explanation: 'x^2 - 4 = 0 → x = ±2'
      },
      {
        id: 's2',
        question: 'Hence the domain is ℝ \\ {…}',
        options: ['{0}', '{±4}', '{±2}', '∅'],
        correctAnswer: 2,
        marks: 1,
        explanation: 'Exclude the roots where denominator = 0.'
      }
    ]
  },
  {
    title: 'Log Laws — Solve log₂(x) + log₂(x−2) = 3',
    subject: 'math',
    chapter: 'Logarithms',
    level: 'A2',
    difficulty: 'medium',
    question_text: 'Solve for x: log₂(x) + log₂(x−2) = 3.',
    steps: [
      {
        id: 's1',
        question: 'Combine logs:',
        options: [
          'log₂(x + x−2)',
          'log₂(x(x−2))',
          'log₂(x/(x−2))',
          'log₂(2x−2)'
        ],
        correctAnswer: 1,
        marks: 1,
        explanation: 'log a + log b = log(ab).'
      },
      {
        id: 's2',
        question: 'Solve x(x−2) = 2³ under domain x>2:',
        options: ['x = 4 or −2', 'x = 4 or 2', 'x = 4 only', 'x = 2 only'],
        correctAnswer: 0,
        marks: 1,
        explanation: 'x² − 2x − 8 = 0 → (x−4)(x+2)=0 → x=4 or −2; domain forces x=4.'
      }
    ]
  },
  {
    title: 'Quadratic Roots — x² − 5x + 6 = 0',
    subject: 'math',
    chapter: 'Quadratics',
    level: 'A2',
    difficulty: 'easy',
    question_text: 'Find the roots of x² − 5x + 6 = 0.',
    steps: [
      {
        id: 's1',
        question: 'Factorization:',
        options: [
          '(x−2)(x−3)',
          '(x−1)(x−6)',
          '(x+2)(x+3)',
          'Irreducible'
        ],
        correctAnswer: 0,
        marks: 1,
        explanation: '−2 −3 sum to −5 and multiply to +6.'
      },
      {
        id: 's2',
        question: 'Roots are:',
        options: ['x=2,3', 'x=−2,−3', 'x=1,6', 'no real roots'],
        correctAnswer: 0,
        marks: 1,
        explanation: 'Set each factor to zero.'
      }
    ]
  },
  {
    title: 'Exponential Equation — 3^(x+1) = 27',
    subject: 'math',
    chapter: 'Exponents',
    level: 'A2',
    difficulty: 'easy',
    question_text: 'Solve 3^(x+1) = 27.',
    steps: [
      {
        id: 's1',
        question: 'Rewrite 27 as power of 3:',
        options: ['3²', '3³', '3⁴', '9'],
        correctAnswer: 1,
        marks: 1,
        explanation: '27 = 3³.'
      },
      {
        id: 's2',
        question: 'Hence x+1 = 3 ⇒ x = ?',
        options: ['1', '2', '3', '4'],
        correctAnswer: 1,
        marks: 1,
        explanation: 'x = 2.'
      }
    ]
  },
  {
    title: 'Inequality — |2x−5| ≤ 7',
    subject: 'math',
    chapter: 'Inequalities',
    level: 'A2',
    difficulty: 'medium',
    question_text: 'Solve |2x−5| ≤ 7.',
    steps: [
      {
        id: 's1',
        question: 'Convert absolute inequality:',
        options: [
          '−7 ≤ 2x−5 ≤ 7',
          '2x−5 ≤ −7',
          '2x−5 ≥ 7',
          'x ≤ 7'
        ],
        correctAnswer: 0,
        marks: 1,
        explanation: '|A| ≤ k → −k ≤ A ≤ k.'
      },
      {
        id: 's2',
        question: 'Solve and simplify:',
        options: [
          '−1 ≤ x ≤ 6',
          '−1 ≤ x < 6',
          '1 ≤ x ≤ 6',
          '1 ≤ x < 6'
        ],
        correctAnswer: 2,
        marks: 1,
        explanation: 'Add 5: −2 ≤ 2x ≤ 12 → divide by 2 → −1 ≤ x ≤ 6; check original: both valid.'
      }
    ]
  }
];

async function main() {
  console.log('Starting question seeding...');
  console.log(`Seeding ${qs.length} questions...`);
  
  const { data, error } = await supabase.rpc('upsert_questions', {
    qrows: qs as any
  });
  
  if (error) {
    console.error('Error seeding questions:', error);
    throw error;
  }
  
  console.log('✓ Successfully upserted', data, 'questions');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
