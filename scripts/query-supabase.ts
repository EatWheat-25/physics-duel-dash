/**
 * Supabase Query Script
 * 
 * Run this script to query Supabase and share results with me.
 * 
 * Usage:
 *   npx tsx scripts/query-supabase.ts <command> [args]
 * 
 * Commands:
 *   matches          - List all matches
 *   queue            - List matchmaking queue
 *   questions        - List questions
 *   match <id>       - Get specific match
 *   user <id>        - Get user info
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qvunaswogfwhixecjpcn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dW5hc3dvZ2Z3aGl4ZWNqcGNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NDIyNDAsImV4cCI6MjA3MzUxODI0MH0.mNFMhdalJrFdpQNbORIC4FZVRNSHrrTEqx63zVILqlg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function queryMatches() {
  console.log('\n📊 Fetching matches...\n');
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`✅ Found ${data?.length || 0} matches:\n`);
  console.log(JSON.stringify(data, null, 2));
}

async function queryQueue() {
  console.log('\n📊 Fetching matchmaking queue...\n');
  const { data, error } = await supabase
    .from('matchmaking_queue')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`✅ Found ${data?.length || 0} queue entries:\n`);
  console.log(JSON.stringify(data, null, 2));
}

async function queryQuestions() {
  console.log('\n📊 Fetching questions...\n');
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .limit(10);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`✅ Found ${data?.length || 0} questions:\n`);
  console.log(JSON.stringify(data, null, 2));
}

async function queryMatch(id: string) {
  console.log(`\n📊 Fetching match ${id}...\n`);
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!data) {
    console.error('❌ Match not found');
    return;
  }

  console.log('✅ Match found:\n');
  console.log(JSON.stringify(data, null, 2));
}

async function checkTables() {
  console.log('\n📊 Checking table existence and row counts...\n');
  
  const tables = ['matches', 'matchmaking_queue', 'questions'];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: ${count || 0} rows`);
      }
    } catch (err: any) {
      console.log(`❌ ${table}: ${err.message}`);
    }
  }
}

async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'matches':
      await queryMatches();
      break;
    case 'queue':
      await queryQueue();
      break;
    case 'questions':
      await queryQuestions();
      break;
    case 'match':
      if (!arg) {
        console.error('❌ Please provide a match ID');
        process.exit(1);
      }
      await queryMatch(arg);
      break;
    case 'check':
      await checkTables();
      break;
    default:
      console.log(`
Usage: npx tsx scripts/query-supabase.ts <command> [args]

Commands:
  matches          - List all matches
  queue            - List matchmaking queue
  questions        - List questions
  match <id>       - Get specific match
  check            - Check table existence and row counts
      `);
      process.exit(1);
  }
}

main().catch(console.error);

