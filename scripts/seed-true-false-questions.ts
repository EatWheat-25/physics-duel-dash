/**
 * Seed True/False Questions for Stage 1
 * 
 * This script seeds questions_v2 with True/False questions where step[0] has exactly 2 options.
 * 
 * USAGE:
 *   npx tsx scripts/seed-true-false-questions.ts
 * 
 * REQUIRED ENVIRONMENT VARIABLES:
 *   - VITE_SUPABASE_URL (or SUPABASE_URL)
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// True/False questions - step[0] has exactly 2 options
const trueFalseQuestions = [
  {
    title: 'Is the derivative of x² equal to 2x?',
    subject: 'math',
    chapter: 'Calculus',
    level: 'A2',
    difficulty: 'easy',
    rank_tier: 'Bronze',
    stem: 'Determine if the following statement is true or false.',
    total_marks: 1,
    topic_tags: ['calculus', 'derivatives'],
    steps: [
      {
        id: 'step-1',
        index: 0,
        type: 'mcq',
        title: 'True or False',
        prompt: 'Is the derivative of x² equal to 2x?',
        options: ['True', 'False'], // Exactly 2 options for True/False
        correctAnswer: 0, // True
        timeLimitSeconds: 15,
        marks: 1,
        explanation: 'The derivative of x² is indeed 2x. Using the power rule: d/dx(x²) = 2x²⁻¹ = 2x'
      }
    ],
    image_url: null
  },
  {
    title: 'Is the integral of 1/x equal to ln|x|?',
    subject: 'math',
    chapter: 'Integration',
    level: 'A2',
    difficulty: 'easy',
    rank_tier: 'Bronze',
    stem: 'Determine if the following statement is true or false.',
    total_marks: 1,
    topic_tags: ['integration', 'logarithms'],
    steps: [
      {
        id: 'step-1',
        index: 0,
        type: 'mcq',
        title: 'True or False',
        prompt: 'Is the integral of 1/x equal to ln|x|?',
        options: ['True', 'False'],
        correctAnswer: 0, // True
        timeLimitSeconds: 15,
        marks: 1,
        explanation: 'Yes, ∫(1/x)dx = ln|x| + C. This is a fundamental integration result.'
      }
    ],
    image_url: null
  },
  {
    title: 'Is the limit of sin(x)/x as x approaches 0 equal to 1?',
    subject: 'math',
    chapter: 'Limits',
    level: 'A2',
    difficulty: 'medium',
    rank_tier: 'Silver',
    stem: 'Determine if the following statement is true or false.',
    total_marks: 1,
    topic_tags: ['limits', 'trigonometry'],
    steps: [
      {
        id: 'step-1',
        index: 0,
        type: 'mcq',
        title: 'True or False',
        prompt: 'Is the limit of sin(x)/x as x approaches 0 equal to 1?',
        options: ['True', 'False'],
        correctAnswer: 0, // True
        timeLimitSeconds: 20,
        marks: 1,
        explanation: 'Yes, lim(x→0) sin(x)/x = 1. This is a fundamental limit result, often proven using L\'Hôpital\'s rule or geometric methods.'
      }
    ],
    image_url: null
  },
  {
    title: 'Is the derivative of e^x equal to e^x?',
    subject: 'math',
    chapter: 'Calculus',
    level: 'A2',
    difficulty: 'easy',
    rank_tier: 'Bronze',
    stem: 'Determine if the following statement is true or false.',
    total_marks: 1,
    topic_tags: ['calculus', 'exponentials'],
    steps: [
      {
        id: 'step-1',
        index: 0,
        type: 'mcq',
        title: 'True or False',
        prompt: 'Is the derivative of e^x equal to e^x?',
        options: ['True', 'False'],
        correctAnswer: 0, // True
        timeLimitSeconds: 15,
        marks: 1,
        explanation: 'Yes, d/dx(e^x) = e^x. The exponential function is its own derivative.'
      }
    ],
    image_url: null
  },
  {
    title: 'Is the integral of cos(x) equal to sin(x)?',
    subject: 'math',
    chapter: 'Integration',
    level: 'A2',
    difficulty: 'easy',
    rank_tier: 'Bronze',
    stem: 'Determine if the following statement is true or false.',
    total_marks: 1,
    topic_tags: ['integration', 'trigonometry'],
    steps: [
      {
        id: 'step-1',
        index: 0,
        type: 'mcq',
        title: 'True or False',
        prompt: 'Is the integral of cos(x) equal to sin(x)?',
        options: ['True', 'False'],
        correctAnswer: 0, // True
        timeLimitSeconds: 15,
        marks: 1,
        explanation: 'Yes, ∫cos(x)dx = sin(x) + C. The derivative of sin(x) is cos(x), so the integral of cos(x) is sin(x).'
      }
    ],
    image_url: null
  },
  {
    title: 'Is the derivative of ln(x) equal to 1/x?',
    subject: 'math',
    chapter: 'Calculus',
    level: 'A2',
    difficulty: 'easy',
    rank_tier: 'Bronze',
    stem: 'Determine if the following statement is true or false.',
    total_marks: 1,
    topic_tags: ['calculus', 'logarithms'],
    steps: [
      {
        id: 'step-1',
        index: 0,
        type: 'mcq',
        title: 'True or False',
        prompt: 'Is the derivative of ln(x) equal to 1/x?',
        options: ['True', 'False'],
        correctAnswer: 0, // True
        timeLimitSeconds: 15,
        marks: 1,
        explanation: 'Yes, d/dx(ln(x)) = 1/x for x > 0. This is a fundamental derivative result.'
      }
    ],
    image_url: null
  },
  {
    title: 'Is the limit of (1 + 1/n)^n as n approaches infinity equal to e?',
    subject: 'math',
    chapter: 'Limits',
    level: 'A2',
    difficulty: 'medium',
    rank_tier: 'Silver',
    stem: 'Determine if the following statement is true or false.',
    total_marks: 1,
    topic_tags: ['limits', 'euler'],
    steps: [
      {
        id: 'step-1',
        index: 0,
        type: 'mcq',
        title: 'True or False',
        prompt: 'Is the limit of (1 + 1/n)^n as n approaches infinity equal to e?',
        options: ['True', 'False'],
        correctAnswer: 0, // True
        timeLimitSeconds: 20,
        marks: 1,
        explanation: 'Yes, lim(n→∞) (1 + 1/n)^n = e. This is the definition of Euler\'s number e.'
      }
    ],
    image_url: null
  },
  {
    title: 'Is the chain rule: d/dx[f(g(x))] = f\'(g(x)) · g\'(x)?',
    subject: 'math',
    chapter: 'Calculus',
    level: 'A2',
    difficulty: 'medium',
    rank_tier: 'Silver',
    stem: 'Determine if the following statement is true or false.',
    total_marks: 1,
    topic_tags: ['calculus', 'chain-rule'],
    steps: [
      {
        id: 'step-1',
        index: 0,
        type: 'mcq',
        title: 'True or False',
        prompt: 'Is the chain rule: d/dx[f(g(x))] = f\'(g(x)) · g\'(x)?',
        options: ['True', 'False'],
        correctAnswer: 0, // True
        timeLimitSeconds: 20,
        marks: 1,
        explanation: 'Yes, this is the correct statement of the chain rule for derivatives of composite functions.'
      }
    ],
    image_url: null
  }
];

async function seed() {
  console.log('🌱 Seeding True/False questions to questions_v2...\n');

  // Validate environment
  if (!process.env.VITE_SUPABASE_URL && !process.env.SUPABASE_URL) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_URL');
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Check table exists
  const { error: checkError } = await supabase
    .from('questions_v2')
    .select('id')
    .limit(1);

  if (checkError) {
    console.error('❌ Error: questions_v2 table may not exist');
    console.error('Run migration first: supabase db push');
    console.error('Error:', checkError);
    process.exit(1);
  }

  console.log(`📝 Seeding ${trueFalseQuestions.length} True/False questions...\n`);

  let successCount = 0;
  let failCount = 0;
  let updateCount = 0;

  for (const question of trueFalseQuestions) {
    try {
      // Check if question already exists
      const { data: existing } = await supabase
        .from('questions_v2')
        .select('id')
        .eq('title', question.title)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('questions_v2')
          .update(question)
          .eq('id', existing.id);

        if (error) {
          console.error(`   ❌ Failed to update: ${question.title}`);
          console.error(`      Error: ${error.message}`);
          failCount++;
        } else {
          console.log(`   ✓ Updated: ${question.title}`);
          updateCount++;
        }
      } else {
        // Insert new
        const { error } = await supabase
          .from('questions_v2')
          .insert([question]);

        if (error) {
          console.error(`   ❌ Failed to insert: ${question.title}`);
          console.error(`      Error: ${error.message}`);
          failCount++;
        } else {
          console.log(`   ✓ Inserted: ${question.title}`);
          successCount++;
        }
      }
    } catch (err: any) {
      console.error(`   ❌ Error processing: ${question.title}`);
      console.error(`      ${err.message}`);
      failCount++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   ✓ Inserted: ${successCount}`);
  console.log(`   ✓ Updated: ${updateCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📝 Total: ${trueFalseQuestions.length}`);

  if (failCount === 0) {
    console.log('\n🎉 All True/False questions seeded successfully!');
    console.log('\n✅ Stage 1 filtering should now work - questions have exactly 2 options in step[0]');
  } else {
    console.log('\n⚠️  Some questions failed to seed. Check errors above.');
  }
}

seed().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

