/**
 * LEAN REAL QUESTIONS SEED
 * 
 * Seeds 5 real educational questions (mix of True/False and MCQ)
 * Enough to stress-test the pipeline without over-engineering.
 * 
 * USAGE:
 *   npm run seed:real-questions
 * 
 * REQUIRED ENVIRONMENT VARIABLES:
 *   - VITE_SUPABASE_URL (or SUPABASE_URL)
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env file
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
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
  }
} catch (err) {
  console.warn('⚠️ Could not load .env file:', err);
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 5 Real Educational Questions
const questions = [
  // Math A1 - True/False
  {
    title: 'Basic Addition',
    subject: 'math',
    chapter: 'Arithmetic',
    level: 'A1',
    difficulty: 'easy',
    rank_tier: null,
    stem: 'Is the following statement true or false?',
    total_marks: 1,
    topic_tags: ['addition', 'arithmetic'],
    steps: [{
      id: 'step-1',
      index: 0,
      type: 'true_false',
      title: 'Step 1',
      prompt: '2 + 2 = 4',
      options: ['True', 'False'],
      correctAnswer: 0,
      timeLimitSeconds: 30,
      marks: 1,
      explanation: '2 + 2 equals 4, so the statement is true.'
    }],
    image_url: null
  },
  
  // Math A2 - MCQ
  {
    title: 'Quadratic Equation',
    subject: 'math',
    chapter: 'Algebra',
    level: 'A2',
    difficulty: 'medium',
    rank_tier: null,
    stem: 'What is the solution to x² - 5x + 6 = 0?',
    total_marks: 2,
    topic_tags: ['quadratic', 'algebra'],
    steps: [{
      id: 'step-1',
      index: 0,
      type: 'mcq',
      title: 'Step 1',
      prompt: 'Solve the quadratic equation',
      options: ['x = 2 or x = 3', 'x = 1 or x = 6', 'x = -2 or x = -3', 'x = 0 or x = 5'],
      correctAnswer: 0,
      timeLimitSeconds: 60,
      marks: 2,
      explanation: 'Factoring: (x - 2)(x - 3) = 0, so x = 2 or x = 3'
    }],
    image_url: null
  },
  
  // Physics A1 - True/False
  {
    title: 'Newton\'s First Law',
    subject: 'physics',
    chapter: 'Mechanics',
    level: 'A1',
    difficulty: 'easy',
    rank_tier: null,
    stem: 'Is the following statement true or false?',
    total_marks: 1,
    topic_tags: ['mechanics', 'newton'],
    steps: [{
      id: 'step-1',
      index: 0,
      type: 'true_false',
      title: 'Step 1',
      prompt: 'An object at rest stays at rest unless acted upon by an external force.',
      options: ['True', 'False'],
      correctAnswer: 0,
      timeLimitSeconds: 30,
      marks: 1,
      explanation: 'This is Newton\'s First Law of Motion (Law of Inertia).'
    }],
    image_url: null
  },
  
  // Physics A2 - MCQ
  {
    title: 'Kinetic Energy',
    subject: 'physics',
    chapter: 'Energy',
    level: 'A2',
    difficulty: 'medium',
    rank_tier: null,
    stem: 'A 2 kg object moves at 3 m/s. What is its kinetic energy?',
    total_marks: 2,
    topic_tags: ['energy', 'kinetics'],
    steps: [{
      id: 'step-1',
      index: 0,
      type: 'mcq',
      title: 'Step 1',
      prompt: 'Calculate kinetic energy using KE = ½mv²',
      options: ['9 J', '18 J', '6 J', '12 J'],
      correctAnswer: 0,
      timeLimitSeconds: 60,
      marks: 2,
      explanation: 'KE = ½ × 2 × 3² = ½ × 2 × 9 = 9 J'
    }],
    image_url: null
  },
  
  // Chemistry A1 - True/False
  {
    title: 'Atomic Structure',
    subject: 'chemistry',
    chapter: 'Atoms',
    level: 'A1',
    difficulty: 'easy',
    rank_tier: null,
    stem: 'Is the following statement true or false?',
    total_marks: 1,
    topic_tags: ['atoms', 'structure'],
    steps: [{
      id: 'step-1',
      index: 0,
      type: 'true_false',
      title: 'Step 1',
      prompt: 'The number of protons in an atom determines its atomic number.',
      options: ['True', 'False'],
      correctAnswer: 0,
      timeLimitSeconds: 30,
      marks: 1,
      explanation: 'The atomic number is defined as the number of protons in the nucleus.'
    }],
    image_url: null
  }
];

async function main() {
  console.log('🌱 Seeding 5 real educational questions...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const q of questions) {
    try {
      // Validate question structure
      if (!q.steps || q.steps.length === 0) {
        throw new Error('Question must have at least one step');
      }
      
      // Check type detection
      const firstStep = q.steps[0];
      const nonEmptyOptions = firstStep.options.filter((o: string) => o.trim() !== '');
      const normalized = nonEmptyOptions.map((o: string) => o.toLowerCase().trim()).sort().join(',');
      const isTrueFalse = nonEmptyOptions.length === 2 && normalized === 'false,true';
      
      if (firstStep.type === 'true_false' && !isTrueFalse) {
        throw new Error(`Question "${q.title}": Type mismatch - marked as true_false but options don't match`);
      }
      
      // Insert question (let DB generate UUID)
      const { data, error } = await supabase
        .from('questions_v2')
        .insert([q])
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`✅ ${q.title} (${firstStep.type})`);
      successCount++;
    } catch (error: any) {
      console.error(`❌ ${q.title}: ${error.message}`);
      failCount++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📝 Total: ${questions.length}`);
  
  if (failCount === 0) {
    console.log('\n🎉 All questions seeded successfully!');
  } else {
    console.log('\n⚠️ Some questions failed to seed. Check errors above.');
    process.exit(1);
  }
}

main().catch(console.error);

