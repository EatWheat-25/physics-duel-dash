// Seed questions from TypeScript files into Supabase database
// Usage: npx tsx scripts/seed-questions.ts

import { createClient } from '@supabase/supabase-js';
import { A2_ONLY_QUESTIONS } from '../src/data/questionPools/a2OnlyQuestions';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface QuestionRow {
  id?: string;
  title: string;
  subject: string;
  chapter: string;
  level: string;
  difficulty: string;
  rank_tier: string;
  question_text: string;
  total_marks: number;
  steps: any[];
  topic_tags: string[];
}

function transformToRow(q: any): QuestionRow {
  return {
    id: q.id,
    title: q.title || q.questionText?.substring(0, 50) || 'Untitled',
    subject: q.subject || 'math',
    chapter: q.chapter || 'unknown',
    level: q.level || 'A2',
    difficulty: q.difficulty || 'medium',
    rank_tier: q.rankTier || 'Bronze',
    question_text: q.questionText || q.question || '',
    total_marks: q.totalMarks || 1,
    steps: q.steps || [],
    topic_tags: q.topicTags || []
  };
}

async function seedQuestions() {
  console.log('Starting question seeding...');

  const a2Questions = A2_ONLY_QUESTIONS.map(transformToRow);
  console.log(`Loaded ${a2Questions.length} A2 questions`);

  let successCount = 0;
  let errorCount = 0;

  for (const row of a2Questions) {
    try {
      const { error } = await supabase.rpc('upsert_questions', { q: row as any });
      if (error) {
        errorCount++;
        console.error(`Failed: ${row.title}`);
      } else {
        successCount++;
      }
    } catch (error) {
      errorCount++;
    }
  }

  console.log(`Complete! Success: ${successCount}, Errors: ${errorCount}`);
  return { successCount, errorCount };
}

seedQuestions().then(() => process.exit(0)).catch(() => process.exit(1));
