/**
 * Delete ALL questions from questions_v2 table
 * This will also clean up related records in match_rounds, match_answers, etc.
 * 
 * USAGE:
 *   npm run seed:delete-all
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

async function main() {
    console.log('🗑️  Deleting ALL questions from questions_v2...\n');
  
  try {
    // Get all question IDs first
    const { data: allQuestions, error: fetchError } = await supabase
      .from('questions_v2')
      .select('id');
    
    if (fetchError) {
      console.error('❌ Error fetching questions:', fetchError.message);
      process.exit(1);
    }
    
    if (!allQuestions || allQuestions.length === 0) {
      console.log('✅ No questions to delete. Database is already empty.');
      return;
    }
    
    const questionIds = allQuestions.map(q => q.id);
    console.log(`📋 Found ${questionIds.length} question(s) to delete\n`);
    
    // Delete related records first to avoid foreign key constraint violations
    console.log('🧹 Cleaning up related records...');
    
    // Delete match_answers for all questions
    const { error: answersError } = await supabase
      .from('match_answers')
      .delete()
      .in('question_id', questionIds);
    
    if (answersError && !answersError.message.includes('does not exist')) {
      console.warn('⚠️  Warning deleting match_answers:', answersError.message);
    } else {
      console.log('   ✅ Cleaned match_answers');
    }
    
    // Delete match_rounds for all questions
    const { error: roundsError } = await supabase
      .from('match_rounds')
      .delete()
      .in('question_id', questionIds);
    
    if (roundsError && !roundsError.message.includes('does not exist')) {
      console.warn('⚠️  Warning deleting match_rounds:', roundsError.message);
    } else {
      console.log('   ✅ Cleaned match_rounds');
    }
    
    // Delete match_questions (if table exists)
    const { error: matchQuestionsError } = await supabase
      .from('match_questions')
      .delete()
      .in('question_id', questionIds);
    
    if (matchQuestionsError && !matchQuestionsError.message.includes('does not exist')) {
      console.warn('⚠️  Warning deleting match_questions:', matchQuestionsError.message);
    } else {
      console.log('   ✅ Cleaned match_questions');
    }
    
    console.log('\n🗑️  Deleting all questions...');
    
    // Now delete all questions
    const { error: deleteError } = await supabase
      .from('questions_v2')
      .delete()
      .in('id', questionIds)
    
    if (deleteError) {
      console.error('❌ Error deleting questions:', deleteError.message);
      process.exit(1);
    }
    
    console.log(`\n✅ Successfully deleted ${questionIds.length} question(s) from questions_v2`);
    console.log('\n📝 Next steps:');
    console.log('   1. Add new questions via Admin UI at /admin/questions');
    console.log('   2. Or use a seeding script to add questions in bulk');
    console.log('   3. Questions are now ready to be used in the game!');
    
  } catch (error: any) {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

