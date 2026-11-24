// Insert a reviewed draft batch (question-drafts/<batch>/questions.json) into questions_v2.
//
//   npx tsx scripts/insert-question-batch.ts question-drafts/physics-batch-04 --dry-run
//   npx tsx scripts/insert-question-batch.ts question-drafts/physics-batch-04
//
// - Every step gets timeLimitSeconds = 15 (the server already runs steps on a fixed 15s timer).
// - main_question_timer_seconds is capped at MAX_MAIN_SECONDS.
// - Rows are inserted enabled (is_enabled = true) so they can be picked for matches.
// - A question whose title already exists in questions_v2 is skipped, so re-running is safe.
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const STEP_SECONDS = 15;
const MAX_MAIN_SECONDS = 180;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dir = args.find((a) => !a.startsWith('--'));
if (!dir) {
  console.error('Usage: tsx scripts/insert-question-batch.ts <batch-dir> [--dry-run]');
  process.exit(1);
}

const env: Record<string, string> = {};
for (const line of fs.readFileSync(path.resolve('.env'), 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  const i = t.indexOf('=');
  if (!t || t.startsWith('#') || i <= 0) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

type Step = { options: string[]; correctAnswer: number; timeLimitSeconds?: number };
type Draft = { title: string; steps: Step[]; total_marks: number; main_question_timer_seconds: number; [k: string]: unknown };

const drafts: Draft[] = JSON.parse(fs.readFileSync(path.join(dir, 'questions.json'), 'utf8'));

for (const q of drafts) {
  if (!q.steps?.length) throw new Error(`${q.title}: no steps`);
  for (const s of q.steps) {
    if (s.options?.length !== 4 || !(s.correctAnswer >= 0 && s.correctAnswer < 4)) {
      throw new Error(`${q.title}: step needs 4 options and a valid correctAnswer`);
    }
  }
}

const rows = drafts.map((q) => ({
  ...q,
  steps: q.steps.map((s) => ({ ...s, timeLimitSeconds: STEP_SECONDS })),
  main_question_timer_seconds: Math.min(q.main_question_timer_seconds ?? MAX_MAIN_SECONDS, MAX_MAIN_SECONDS),
  is_enabled: true,
  is_done: false,
}));

const { data: existing, error: readError } = await supabase
  .from('questions_v2')
  .select('title')
  .in('title', rows.map((r) => r.title));
if (readError) throw readError;
const taken = new Set((existing ?? []).map((r) => r.title));
const toInsert = rows.filter((r) => !taken.has(r.title));

for (const r of rows) {
  console.log(`${taken.has(r.title) ? 'SKIP (exists)' : 'insert'}  ${r.main_question_timer_seconds}s main, ${r.steps.length}×${STEP_SECONDS}s  ${r.title}`);
}

if (dryRun) {
  console.log(`\nDry run: would insert ${toInsert.length} of ${rows.length}.`);
  process.exit(0);
}
if (toInsert.length === 0) {
  console.log('\nNothing to insert.');
  process.exit(0);
}

const { data, error } = await supabase.from('questions_v2').insert(toInsert).select('id,title');
if (error) {
  console.error('Insert failed:', error.message);
  process.exit(1);
}
console.log(`\nInserted ${data.length} questions:`);
for (const r of data) console.log(`  ${r.id}  ${r.title}`);
