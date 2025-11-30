/**
 * Check Match Script
 * 
 * Diagnoses why a match might not be found
 * 
 * Usage: npx tsx scripts/check-match.ts <match-id>
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qvunaswogfwhixecjpcn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dW5hc3dvZ2Z3aGl4ZWNqcGNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NDIyNDAsImV4cCI6MjA3MzUxODI0MH0.mNFMhdalJrFdpQNbORIC4FZVRNSHrrTEqx63zVILqlg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkMatch(matchId: string) {
  console.log(`\n🔍 Checking match: ${matchId}\n`);

  // 1. Check if matches table exists
  console.log('1️⃣ Checking if matches table exists...');
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error accessing matches table:', error.message);
      console.log('\n💡 The matches table might not exist. Run: supabase db push');
      return;
    }
    console.log('✅ matches table exists');
  } catch (err: any) {
    console.error('❌ Cannot access matches table:', err.message);
    return;
  }

  // 2. Check if match exists in matches table
  console.log('\n2️⃣ Checking if match exists in matches table...');
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle();

  if (matchError) {
    console.error('❌ Error:', matchError.message);
    console.error('   Code:', matchError.code);
    console.error('   Details:', matchError.details);
    return;
  }

  if (match) {
    console.log('✅ Match found in matches table:');
    console.log(JSON.stringify(match, null, 2));
    
    // Check structure
    console.log('\n3️⃣ Checking match structure...');
    const hasPlayer1Id = 'player1_id' in match;
    const hasPlayer2Id = 'player2_id' in match;
    const hasStatus = 'status' in match;
    
    console.log(`   player1_id: ${hasPlayer1Id ? '✅' : '❌'}`);
    console.log(`   player2_id: ${hasPlayer2Id ? '✅' : '❌'}`);
    console.log(`   status: ${hasStatus ? '✅' : '❌'}`);
    
    if (!hasPlayer1Id || !hasPlayer2Id) {
      console.log('\n⚠️  Match has wrong structure!');
      console.log('   Run migration: supabase db push');
    }
  } else {
    console.log('❌ Match not found in matches table');
    
    // 3. Check if it exists in matches_new
    console.log('\n3️⃣ Checking matches_new table...');
    const { data: matchNew, error: newError } = await supabase
      .from('matches_new')
      .select('*')
      .eq('id', matchId)
      .maybeSingle();

    if (matchNew) {
      console.log('⚠️  Match found in matches_new (old table)!');
      console.log('   This means the migration hasn\'t been applied.');
      console.log('   Run: supabase db push');
      console.log('\n   Match data:', JSON.stringify(matchNew, null, 2));
    } else if (!newError) {
      console.log('❌ Not in matches_new either');
    }

    // 4. List recent matches
    console.log('\n4️⃣ Recent matches in matches table:');
    const { data: recentMatches } = await supabase
      .from('matches')
      .select('id, player1_id, player2_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentMatches && recentMatches.length > 0) {
      console.log(`   Found ${recentMatches.length} recent matches:`);
      recentMatches.forEach(m => {
        console.log(`   - ${m.id} (${m.status})`);
      });
    } else {
      console.log('   No matches found in matches table');
    }
  }

  // 5. Check current user
  console.log('\n5️⃣ Checking authentication...');
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    console.log('⚠️  Not authenticated');
    console.log('   You need to be logged in to view matches');
  } else {
    console.log(`✅ Authenticated as: ${user.email} (${user.id})`);
    
    if (match) {
      const isPlayer1 = match.player1_id === user.id;
      const isPlayer2 = match.player2_id === user.id;
      
      if (isPlayer1 || isPlayer2) {
        console.log(`✅ You are ${isPlayer1 ? 'Player 1' : 'Player 2'} in this match`);
      } else {
        console.log('❌ You are NOT part of this match!');
        console.log(`   Match players: ${match.player1_id}, ${match.player2_id}`);
        console.log(`   Your ID: ${user.id}`);
      }
    }
  }
}

async function main() {
  const matchId = process.argv[2];
  
  if (!matchId) {
    console.error('❌ Please provide a match ID');
    console.log('Usage: npx tsx scripts/check-match.ts <match-id>');
    process.exit(1);
  }

  await checkMatch(matchId);
}

main().catch(console.error);

