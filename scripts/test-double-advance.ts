/**
 * Double-advance test (server-only)
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_URL=... npx tsx scripts/test-double-advance.ts <match_id>
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qvunaswogfwhixecjpcn.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const matchId = process.argv[2];
if (!matchId) {
  console.error('❌ Please provide a match ID');
  console.log('Usage: npx tsx scripts/test-double-advance.ts <match_id>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  const { data: matchRow, error: matchError } = await supabase
    .from('matches')
    .select('current_round_id')
    .eq('id', matchId)
    .single();

  if (matchError || !matchRow?.current_round_id) {
    console.error('❌ Failed to load match round:', matchError);
    process.exit(1);
  }

  const roundId = matchRow.current_round_id as string;
  const { data: roundRow, error: roundError } = await supabase
    .from('match_rounds')
    .select('id, phase, phase_seq, ends_at')
    .eq('id', roundId)
    .single();

  if (roundError || !roundRow) {
    console.error('❌ Failed to load round:', roundError);
    process.exit(1);
  }

  const payload = {
    p_match_id: matchId,
    p_round_id: roundId,
    p_expected_phase_seq: roundRow.phase_seq,
    p_client_seen_at: new Date().toISOString()
  };

  console.log('🔁 Firing two concurrent advance calls...');
  const [a, b] = await Promise.all([
    supabase.rpc('advance_round_phase_v1', payload),
    supabase.rpc('advance_round_phase_v1', payload)
  ]);

  console.log('Call A:', a.data, a.error ?? '');
  console.log('Call B:', b.data, b.error ?? '');

  const { data: afterRow } = await supabase
    .from('match_rounds')
    .select('phase, phase_seq, ends_at')
    .eq('id', roundId)
    .single();

  console.log('✅ Round after:', afterRow);
}

main().catch((err) => {
  console.error('❌ Unhandled error:', err);
  process.exit(1);
});
