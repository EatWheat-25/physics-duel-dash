/**
 * Debug Connection Script
 * 
 * Tests WebSocket connection to game-ws edge function
 * 
 * Usage:
 *   npx tsx scripts/debug-connection.ts <match_id> <token>
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qvunaswogfwhixecjpcn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dW5hc3dvZ2Z3aGl4ZWNqcGNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NDIyNDAsImV4cCI6MjA3MzUxODI0MH0.mNFMhdalJrFdpQNbORIC4FZVRNSHrrTEqx63zVILqlg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugConnection() {
  const matchId = process.argv[2];
  
  if (!matchId) {
    console.error('❌ Please provide a match ID');
    console.log('Usage: npx tsx scripts/debug-connection.ts <match_id>');
    process.exit(1);
  }

  console.log(`\n🔍 Debugging connection for match: ${matchId}\n`);

  // 1. Check if match exists
  console.log('1️⃣ Checking if match exists...');
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (matchError || !match) {
    console.error('❌ Match not found:', matchError?.message);
    console.log('\n💡 Try checking matches first: npx tsx scripts/query-supabase.ts matches');
    process.exit(1);
  }

  console.log('✅ Match found:');
  console.log(JSON.stringify(match, null, 2));

  // 2. Check current user
  console.log('\n2️⃣ Checking authentication...');
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('❌ Not authenticated:', userError?.message);
    console.log('\n💡 You need to be logged in. Check browser console for session token.');
    process.exit(1);
  }

  console.log('✅ Authenticated as:', user.email);
  console.log('   User ID:', user.id);

  // 3. Verify user is in match
  console.log('\n3️⃣ Verifying user is in match...');
  const isPlayer1 = match.player1_id === user.id;
  const isPlayer2 = match.player2_id === user.id;

  if (!isPlayer1 && !isPlayer2) {
    console.error('❌ User is not part of this match!');
    console.log(`   Match players: ${match.player1_id}, ${match.player2_id}`);
    console.log(`   Your ID: ${user.id}`);
    process.exit(1);
  }

  console.log(`✅ User is ${isPlayer1 ? 'Player 1' : 'Player 2'}`);

  // 4. Get session token
  console.log('\n4️⃣ Getting session token...');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    console.error('❌ No session:', sessionError?.message);
    process.exit(1);
  }

  console.log('✅ Session token obtained');
  console.log('   Token (first 50 chars):', session.access_token.substring(0, 50) + '...');

  // 5. Test WebSocket URL
  console.log('\n5️⃣ WebSocket connection info:');
  const wsUrl = `wss://qvunaswogfwhixecjpcn.supabase.co/functions/v1/game-ws?token=${session.access_token}&match_id=${matchId}`;
  console.log('   URL (first 100 chars):', wsUrl.substring(0, 100) + '...');
  console.log('\n💡 Copy this URL and test in browser console:');
  console.log(`   const ws = new WebSocket('${wsUrl}');`);
  console.log('   ws.onopen = () => console.log("Connected!");');
  console.log('   ws.onerror = (e) => console.error("Error:", e);');
  console.log('   ws.onmessage = (e) => console.log("Message:", e.data);');

  console.log('\n✅ Debug complete!');
}

debugConnection().catch(console.error);

