/**
 * Verify correctAnswer path in questions_v2
 * 
 * Checks if steps->0->>'correctAnswer' exists and returns sample data
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = path.resolve(__dirname, '..', '.env');
const envLocalPath = path.resolve(__dirname, '..', '.env.local');

let supabaseUrl = '';
let supabaseKey = '';

function loadEnv(filePath: string) {
  if (fs.existsSync(filePath)) {
    const envConfig = fs.readFileSync(filePath, 'utf-8');
    envConfig.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();
        if (key && value) {
          if (key.trim() === 'VITE_SUPABASE_URL' || key.trim() === 'SUPABASE_URL') {
            supabaseUrl = value.replace(/^["']|["']$/g, '');
          }
          if (key.trim() === 'VITE_SUPABASE_ANON_KEY' || key.trim() === 'SUPABASE_ANON_KEY' || key.trim() === 'SUPABASE_SERVICE_ROLE_KEY') {
            supabaseKey = value.replace(/^["']|["']$/g, '');
          }
        }
      }
    });
  }
}

loadEnv(envPath);
loadEnv(envLocalPath);

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env or .env.local');
  console.error('Need: VITE_SUPABASE_URL (or SUPABASE_URL) and VITE_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyCorrectAnswer() {
  console.log('\n🔍 Verifying correctAnswer path in questions_v2...\n');

  // Check 1: Does correctAnswer key exist?
  const { data: withCorrectAnswer, error: error1 } = await supabase
    .from('questions_v2')
    .select('id, title, steps')
    .limit(10);

  if (error1) {
    console.error('❌ Error fetching questions:', error1);
    return;
  }

  if (!withCorrectAnswer || withCorrectAnswer.length === 0) {
    console.log('⚠️  No questions found in questions_v2');
    return;
  }

  console.log(`✅ Found ${withCorrectAnswer.length} questions\n`);

  // Check first few questions for correctAnswer structure
  let foundCorrectAnswer = 0;
  let missingCorrectAnswer = 0;
  const samples: any[] = [];

  for (const q of withCorrectAnswer.slice(0, 5)) {
    const firstStep = Array.isArray(q.steps) ? q.steps[0] : null;
    
    if (firstStep) {
      if ('correctAnswer' in firstStep) {
        foundCorrectAnswer++;
        samples.push({
          id: q.id,
          title: q.title,
          correctAnswer: firstStep.correctAnswer,
          firstStep: firstStep
        });
      } else {
        missingCorrectAnswer++;
        console.log(`⚠️  Question "${q.title}" (${q.id}) - first step keys:`, Object.keys(firstStep));
      }
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`   ✅ Questions with correctAnswer: ${foundCorrectAnswer}`);
  console.log(`   ❌ Questions missing correctAnswer: ${missingCorrectAnswer}`);

  if (foundCorrectAnswer > 0) {
    console.log(`\n✅ SUCCESS: correctAnswer path is valid!`);
    console.log(`\n📝 Sample data (first ${Math.min(3, samples.length)} questions):\n`);
    samples.slice(0, 3).forEach((sample, idx) => {
      console.log(`${idx + 1}. "${sample.title}"`);
      console.log(`   ID: ${sample.id}`);
      console.log(`   correctAnswer: ${sample.correctAnswer}`);
      console.log(`   First step type: ${sample.firstStep.type || 'N/A'}`);
      console.log(`   Options count: ${Array.isArray(sample.firstStep.options) ? sample.firstStep.options.length : 'N/A'}`);
      console.log('');
    });
    console.log('✅ Path `steps->0->>\'correctAnswer\'` is CORRECT\n');
    return true;
  } else {
    console.log(`\n❌ ERROR: No questions found with correctAnswer key!`);
    console.log(`\n🔍 Inspecting first step structure...\n`);
    
    if (withCorrectAnswer[0] && Array.isArray(withCorrectAnswer[0].steps) && withCorrectAnswer[0].steps[0]) {
      const firstStep = withCorrectAnswer[0].steps[0];
      console.log('First step keys:', Object.keys(firstStep));
      console.log('First step sample:', JSON.stringify(firstStep, null, 2));
    }
    
    console.log('\n❌ Path `steps->0->>\'correctAnswer\'` is INCORRECT');
    console.log('⚠️  Need to update RPC to use correct key name\n');
    return false;
  }
}

verifyCorrectAnswer()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

