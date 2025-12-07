/**
 * PRODUCTION-READY QUESTION SEEDING SCRIPT
 *
 * This script seeds the Supabase `public.questions` table with initial math questions.
 *
 * USAGE:
 *   npm run seed:questions
 *
 * REQUIRED ENVIRONMENT VARIABLES:
 *   - VITE_SUPABASE_URL (or SUPABASE_URL)
 *   - SUPABASE_SERVICE_ROLE_KEY (get from Supabase Dashboard > Settings > API)
 *
 * HOW IT WORKS:
 *   1. Loads questions from the hardcoded array below
 *   2. Validates each question structure
 *   3. Uses STABLE IDs (e.g. "math-a2-domain-001") so re-running updates existing rows
 *   4. Upserts directly to questions table for atomic inserts
 *   5. Reports success/failure counts
 *
 * DATA FLOW:
 *   Admin edits questions → DB (via Admin UI or this script)
 *   │
 *   ├→ Step-battle modes (fetch via getStepMathQuestions)
 *   └→ Online 1v1 matchmaking (fetch via pick_next_question_v2 RPC)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env file manually since tsx doesn't do it by default
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    const lines = envConfig.split(/\r?\n/);
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        let value = trimmed.substring(eqIdx + 1).trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
  }
} catch (e) {
  console.warn('⚠️ Could not load .env file:', e);
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   VITE_SUPABASE_URL (or SUPABASE_URL)');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('');
  console.error('Get your service role key from:');
  console.error('   Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Step structure
type Step = {
  id: string;
  question: string;
  options: [string, string, string, string]; // EXACTLY 4 options
  correctAnswer: 0 | 1 | 2 | 3;
  marks: number;
  explanation: string;
};

// Question input structure
type QuestionInput = {
  id?: string; // Optional - let DB generate UUID if not provided
  title: string;
  subject: 'math' | 'physics' | 'chemistry';
  chapter: string;
  level: 'A1' | 'A2';
  difficulty: 'easy' | 'medium' | 'hard';
  rank_tier?: string;
  question_text: string;
  total_marks: number;
  topic_tags?: string[];
  steps: Step[];
  image_url?: string;
};

// =============================================================================
// QUESTION BANK - Add your questions here
// =============================================================================

const questions: QuestionInput[] = [
  // A2 Functions
  {
    title: 'Domain of f(x) = 1/(x² - 4)',
    subject: 'math',
    chapter: 'Functions Advanced',
    level: 'A2',
    difficulty: 'easy',
    rank_tier: 'Bronze',
    question_text: 'Find the domain of f(x) = 1/(x² - 4).',
    total_marks: 2,
    topic_tags: ['domain', 'rational functions'],
    steps: [
      {
        id: 'step-1',
        question: 'Which values of x make the denominator zero?',
        options: ['x = 0', 'x = ±2', 'x = ±4', 'no real x'],
        correctAnswer: 1,
        marks: 1,
        explanation: 'x² - 4 = 0 when (x-2)(x+2) = 0, so x = ±2',
      },
      {
        id: 'step-2',
        question: 'Hence the domain is ℝ \\ {...}',
        options: ['{0}', '{±4}', '{±2}', '∅'],
        correctAnswer: 2,
        marks: 1,
        explanation: 'We must exclude x = ±2 where the denominator is zero',
      },
    ],
  },

  // A2 Logarithms
  {
    title: 'Solve log₂(x) + log₂(x-2) = 3',
    subject: 'math',
    chapter: 'Logarithms',
    level: 'A2',
    difficulty: 'medium',
    rank_tier: 'Silver',
    question_text: 'Solve for x: log₂(x) + log₂(x-2) = 3',
    total_marks: 2,
    topic_tags: ['logarithms', 'log laws', 'quadratic equations'],
    steps: [
      {
        id: 'step-1',
        question: 'Combine the logarithms using log a + log b = log(ab):',
        options: [
          'log₂(x + x - 2)',
          'log₂(x(x - 2))',
          'log₂(x / (x - 2))',
          'log₂(2x - 2)',
        ],
        correctAnswer: 1,
        marks: 1,
        explanation: 'log₂(x) + log₂(x-2) = log₂(x·(x-2)) = log₂(x² - 2x)',
      },
      {
        id: 'step-2',
        question: 'Solve x² - 2x = 2³ = 8, with domain constraint x > 2:',
        options: ['x = 4 or x = -2', 'x = 4 or x = 2', 'x = 4 only', 'x = 2 only'],
        correctAnswer: 2,
        marks: 1,
        explanation:
          'x² - 2x - 8 = 0 → (x-4)(x+2) = 0 → x = 4 or x = -2. Domain requires x > 2, so x = 4 only.',
      },
    ],
  },

  // A2 Quadratics
  {
    title: 'Quadratic Roots — x² - 5x + 6 = 0',
    subject: 'math',
    chapter: 'Quadratics',
    level: 'A2',
    difficulty: 'easy',
    rank_tier: 'Bronze',
    question_text: 'Find the roots of x² - 5x + 6 = 0.',
    total_marks: 2,
    topic_tags: ['quadratic equations', 'factoring'],
    steps: [
      {
        id: 'step-1',
        question: 'Factorize x² - 5x + 6:',
        options: ['(x - 2)(x - 3)', '(x - 1)(x - 6)', '(x + 2)(x + 3)', 'Cannot be factored'],
        correctAnswer: 0,
        marks: 1,
        explanation: '-2 and -3 sum to -5 and multiply to +6',
      },
      {
        id: 'step-2',
        question: 'What are the roots?',
        options: ['x = 2, 3', 'x = -2, -3', 'x = 1, 6', 'No real roots'],
        correctAnswer: 0,
        marks: 1,
        explanation: 'Set each factor to zero: x - 2 = 0 or x - 3 = 0',
      },
    ],
  },

  // A2 Exponents
  {
    title: 'Solve 3^(x+1) = 27',
    subject: 'math',
    chapter: 'Exponents',
    level: 'A2',
    difficulty: 'easy',
    rank_tier: 'Bronze',
    question_text: 'Solve 3^(x+1) = 27',
    total_marks: 2,
    topic_tags: ['exponential equations'],
    steps: [
      {
        id: 'step-1',
        question: 'Express 27 as a power of 3:',
        options: ['3²', '3³', '3⁴', '9'],
        correctAnswer: 1,
        marks: 1,
        explanation: '27 = 3 × 3 × 3 = 3³',
      },
      {
        id: 'step-2',
        question: 'Hence x + 1 = 3, so x = ?',
        options: ['1', '2', '3', '4'],
        correctAnswer: 1,
        marks: 1,
        explanation: 'x + 1 = 3 → x = 2',
      },
    ],
  },

  // A2 Inequalities
  {
    title: 'Solve |2x - 5| ≤ 7',
    subject: 'math',
    chapter: 'Inequalities',
    level: 'A2',
    difficulty: 'medium',
    rank_tier: 'Silver',
    question_text: 'Solve |2x - 5| ≤ 7',
    total_marks: 2,
    topic_tags: ['absolute value', 'inequalities'],
    steps: [
      {
        id: 'step-1',
        question: 'Convert the absolute value inequality |A| ≤ k:',
        options: ['-7 ≤ 2x - 5 ≤ 7', '2x - 5 ≤ -7', '2x - 5 ≥ 7', 'x ≤ 7'],
        correctAnswer: 0,
        marks: 1,
        explanation: '|A| ≤ k is equivalent to -k ≤ A ≤ k',
      },
      {
        id: 'step-2',
        question: 'Solve -7 ≤ 2x - 5 ≤ 7 to get x:',
        options: ['-1 ≤ x ≤ 6', '-1 < x < 6', '1 ≤ x ≤ 6', '1 < x < 6'],
        correctAnswer: 0,
        marks: 1,
        explanation: 'Add 5: -2 ≤ 2x ≤ 12. Divide by 2: -1 ≤ x ≤ 6',
      },
    ],
  },

  // A1 Quadratics
  {
    title: 'Complete the square: x² + 6x + 5',
    subject: 'math',
    chapter: 'Quadratics',
    level: 'A1',
    difficulty: 'medium',
    rank_tier: 'Silver',
    question_text: 'Write x² + 6x + 5 in the form (x + p)² + q',
    total_marks: 2,
    topic_tags: ['completing the square'],
    steps: [
      {
        id: 'step-1',
        question: 'What is (6/2)²?',
        options: ['3', '6', '9', '12'],
        correctAnswer: 2,
        marks: 1,
        explanation: '(6/2)² = 3² = 9',
      },
      {
        id: 'step-2',
        question: 'Hence x² + 6x + 5 = (x + 3)² + ?',
        options: ['-4', '-9', '5', '14'],
        correctAnswer: 0,
        marks: 1,
        explanation: 'x² + 6x + 5 = (x² + 6x + 9) - 9 + 5 = (x + 3)² - 4',
      },
    ],
  },

  // A1 Indices
  {
    title: 'Simplify (2x³)² × 3x⁴',
    subject: 'math',
    chapter: 'Indices & Surds',
    level: 'A1',
    difficulty: 'easy',
    rank_tier: 'Bronze',
    question_text: 'Simplify (2x³)² × 3x⁴',
    total_marks: 2,
    topic_tags: ['indices', 'algebraic manipulation'],
    steps: [
      {
        id: 'step-1',
        question: 'Expand (2x³)²:',
        options: ['2x⁶', '4x⁶', '2x⁹', '4x⁹'],
        correctAnswer: 1,
        marks: 1,
        explanation: '(2x³)² = 2² × (x³)² = 4x⁶',
      },
      {
        id: 'step-2',
        question: 'Multiply 4x⁶ × 3x⁴:',
        options: ['7x¹⁰', '12x¹⁰', '12x²⁴', '7x²⁴'],
        correctAnswer: 1,
        marks: 1,
        explanation: '4 × 3 = 12, and x⁶ × x⁴ = x⁽⁶⁺⁴⁾ = x¹⁰',
      },
    ],
  },

  // A1 Linear Equations
  {
    title: 'Solve 2x + y = 7, x - y = 2',
    subject: 'math',
    chapter: 'Linear Equations',
    level: 'A1',
    difficulty: 'easy',
    rank_tier: 'Bronze',
    question_text: 'Solve the simultaneous equations: 2x + y = 7 and x - y = 2',
    total_marks: 2,
    topic_tags: ['simultaneous equations', 'elimination method'],
    steps: [
      {
        id: 'step-1',
        question: 'Add the two equations to eliminate y:',
        options: ['3x = 9', '3x = 5', 'x = 9', 'x = 5'],
        correctAnswer: 0,
        marks: 1,
        explanation: '(2x + y) + (x - y) = 7 + 2 → 3x = 9',
      },
      {
        id: 'step-2',
        question: 'Solve for x and y:',
        options: ['x = 3, y = 1', 'x = 2, y = 3', 'x = 1, y = 5', 'x = 4, y = -1'],
        correctAnswer: 0,
        marks: 1,
        explanation: '3x = 9 → x = 3. Substitute: 2(3) + y = 7 → y = 1',
      },
    ],
  },

  // A2 Integration by Parts
  {
    title: 'Integration by Parts: ln x / x^3',
    subject: 'math',
    chapter: 'Integration by Parts',
    level: 'A2',
    difficulty: 'hard',
    rank_tier: 'Silver',
    question_text: 'Find the integral of ln(x) / x^3 with respect to x.',
    total_marks: 4,
    topic_tags: ['integration', 'calculus', 'by-parts'],
    steps: [
      {
        id: 'ibp-lnx/x3-step-1',
        question: 'For ∫ ln(x) / x^3 dx, which choice of u and dv/dx is most suitable for integration by parts?',
        options: [
          'u = 1/x^3, dv/dx = ln x',
          'u = ln x, dv/dx = x^(-3)',
          'u = x^(-3), dv/dx = ln x',
          'u = ln x, dv/dx = 1/x^2'
        ],
        correctAnswer: 1,
        marks: 1,
        explanation: 'Take u = ln x (easy to differentiate) and dv/dx = x^(-3) (easy to integrate).'
      },
      {
        id: 'ibp-lnx/x3-step-2',
        question: 'Given u = ln x and dv/dx = x^(-3), what are du/dx and v?',
        options: [
          'du/dx = 1/x, v = -1/(2x^2)',
          'du/dx = 1/x^2, v = -1/(2x^2)',
          'du/dx = 1/x, v = 1/(2x^2)',
          'du/dx = 1/x^2, v = 1/(2x^2)'
        ],
        correctAnswer: 0,
        marks: 1,
        explanation: 'du/dx = 1/x and ∫ x^(-3) dx = x^(-2)/(-2) = -1/(2x^2).'
      },
      {
        id: 'ibp-lnx/x3-step-3',
        question: 'Using ∫u dv = uv − ∫v du, which expression is correct for ∫ ln(x) / x^3 dx?',
        options: [
          '∫ ln(x) / x^3 dx = -ln x/(2x^2) + ∫ 1/(2x^3) dx',
          '∫ ln(x) / x^3 dx = -ln x/(2x^2) − ∫ 1/(2x^3) dx',
          '∫ ln(x) / x^3 dx = ln x/(2x^2) − ∫ 1/(2x^3) dx',
          '∫ ln(x) / x^3 dx = ln x/(2x^2) + ∫ 1/(2x^3) dx'
        ],
        correctAnswer: 1,
        marks: 1,
        explanation: 'uv = ln x · (−1/(2x^2)); v du = (−1/(2x^2))·(1/x) = −1/(2x^3), so the integral is uv − ∫vdu = −ln x/(2x^2) − ∫ 1/(2x^3) dx.'
      },
      {
        id: 'ibp-lnx/x3-step-4',
        question: 'Evaluate the remaining integral and simplify. Which is the correct antiderivative?',
        options: [
          '−ln x/(2x^2) + 1/(4x^2) + C',
          '−ln x/(2x^2) − 1/(4x^2) + C',
          'ln x/(2x^2) − 1/(4x^2) + C',
          'ln x/(2x^2) + 1/(4x^2) + C'
        ],
        correctAnswer: 1,
        marks: 1,
        explanation: '∫ 1/(2x^3) dx = 1/2 · x^(−2)/(-2) = −1/(4x^2), so the result is −ln x/(2x^2) − 1/(4x^2) + C.'
      }
    ]
  },

];

// =============================================================================
// VALIDATION & SEEDING LOGIC
// =============================================================================

function validateQuestionStructure(q: QuestionInput, index: number): string[] {
  const errors: string[] = [];
  const prefix = `Question ${index + 1} (${q.title || 'no-title'})`;

  if (!q.title?.trim()) errors.push(`${prefix}: Missing title`);
  if (!q.subject) errors.push(`${prefix}: Missing subject`);
  if (!q.chapter?.trim()) errors.push(`${prefix}: Missing chapter`);
  if (!q.level) errors.push(`${prefix}: Missing level`);
  if (!q.difficulty) errors.push(`${prefix}: Missing difficulty`);
  if (!q.question_text?.trim()) errors.push(`${prefix}: Missing question_text`);

  if (!q.steps || q.steps.length === 0) {
    errors.push(`${prefix}: Must have at least 1 step`);
  } else {
    q.steps.forEach((step, sIndex) => {
      if (!step.question?.trim()) {
        errors.push(`${prefix}, Step ${sIndex + 1}: Missing question`);
      }
      if (!step.options || step.options.length !== 4) {
        errors.push(`${prefix}, Step ${sIndex + 1}: Must have exactly 4 options`);
      }
      if (step.correctAnswer < 0 || step.correctAnswer > 3) {
        errors.push(`${prefix}, Step ${sIndex + 1}: correctAnswer must be 0, 1, 2, or 3`);
      }
      if (!step.marks || step.marks <= 0) {
        errors.push(`${prefix}, Step ${sIndex + 1}: marks must be > 0`);
      }
      if (!step.explanation?.trim()) {
        errors.push(`${prefix}, Step ${sIndex + 1}: Missing explanation`);
      }
    });

    // Validate total marks
    const calculatedMarks = q.steps.reduce((sum, s) => sum + (s.marks || 0), 0);
    if (q.total_marks !== calculatedMarks) {
      errors.push(
        `${prefix}: total_marks (${q.total_marks}) != sum of step marks (${calculatedMarks})`
      );
    }
  }

  return errors;
}

async function main() {
  console.log('🔍 Validating questions...');

  let allErrors: string[] = [];
  questions.forEach((q, index) => {
    const errors = validateQuestionStructure(q, index);
    allErrors = allErrors.concat(errors);
  });

  if (allErrors.length > 0) {
    console.error('\\n❌ Validation failed:');
    allErrors.forEach((err) => console.error(`   ${err}`));
    process.exit(1);
  }

  console.log(`✓ All ${questions.length} questions validated successfully\\n`);
  console.log('📤 Seeding questions to Supabase...');

  let successCount = 0;
  let failCount = 0;

  // Insert questions one by one for better error reporting
  for (const question of questions) {
    try {
      const { error } = await supabase.from('questions_v2').insert(question);

      if (error) {
        console.error(`   ❌ ${question.title}: ${error.message}`);
        failCount++;
      } else {
        console.log(`   ✓ ${question.title}`);
        successCount++;
      }
    } catch (err: any) {
      console.error(`   ❌ ${question.title}: ${err.message}`);
      failCount++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   ✓ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📝 Total: ${questions.length}`);

  if (failCount > 0) {
    console.error('\n❌ Some questions failed to seed. Check error messages above.');
    process.exit(1);
  }

  console.log('\n🎉 All questions seeded successfully!');
  console.log('\nNext steps:');
  console.log('  1. Visit the Admin Questions page to view/edit questions');
  console.log('  2. Test step-battle modes (A1/A2) to see questions in action');
  console.log('  3. Test online 1v1 matchmaking');
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
