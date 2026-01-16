/**
 * WebSocket sync simulation (two clients + reconnect)
 *
 * Usage:
 *   npx tsx scripts/ws-sync-sim.ts <match_id> <token_1> <token_2>
 *
 * Notes:
 * - Requires WebSocket support in Node (Node 18+).
 * - Tokens should be valid Supabase JWTs for the two players in the match.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qvunaswogfwhixecjpcn.supabase.co';

const matchId = process.argv[2];
const token1 = process.argv[3];
const token2 = process.argv[4];

if (!matchId || !token1 || !token2) {
  console.error('❌ Usage: npx tsx scripts/ws-sync-sim.ts <match_id> <token_1> <token_2>');
  process.exit(1);
}

const WSImpl: typeof WebSocket | undefined = (globalThis as any).WebSocket;
if (!WSImpl) {
  console.error('❌ WebSocket not available in this Node runtime.');
  console.error('   Use Node 18+ or run in a browser console.');
  process.exit(1);
}

const wsBase = SUPABASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');
const wsUrl = (token: string) => `${wsBase}/functions/v1/game-ws?token=${encodeURIComponent(token)}&match_id=${encodeURIComponent(matchId)}`;

type ClientState = {
  name: string;
  lastSeq: number;
  lastRoundId: string | null;
};

const clients: Record<string, ClientState> = {
  A: { name: 'A', lastSeq: -1, lastRoundId: null },
  B: { name: 'B', lastSeq: -1, lastRoundId: null }
};

const logState = () => {
  const a = clients.A;
  const b = clients.B;
  if (a.lastRoundId && b.lastRoundId && a.lastRoundId !== b.lastRoundId) {
    console.warn('⚠️ RoundId mismatch', { A: a.lastRoundId, B: b.lastRoundId });
  }
  if (a.lastSeq !== -1 && b.lastSeq !== -1 && a.lastSeq !== b.lastSeq) {
    console.warn('⚠️ PhaseSeq mismatch', { A: a.lastSeq, B: b.lastSeq });
  }
};

const attachClient = (name: 'A' | 'B', token: string) => {
  const ws = new WSImpl(wsUrl(token));
  ws.onopen = () => console.log(`✅ Client ${name} connected`);
  ws.onclose = () => console.log(`❌ Client ${name} closed`);
  ws.onerror = (err) => console.error(`❌ Client ${name} error`, err);
  ws.onmessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(String(event.data));
      if (msg.type === 'STATE_SNAPSHOT' || msg.type === 'PHASE_UPDATE') {
        clients[name].lastSeq = Number(msg.phaseSeq ?? msg.phase_seq ?? -1);
        clients[name].lastRoundId = msg.roundId ?? msg.round_id ?? null;
        console.log(`📩 ${name} ${msg.type}`, {
          phase: msg.phase,
          phaseSeq: clients[name].lastSeq,
          roundId: clients[name].lastRoundId
        });
        logState();
      }
    } catch (err) {
      console.error(`❌ Client ${name} parse error`, err);
    }
  };
  return ws;
};

const wsA = attachClient('A', token1);
let wsB = attachClient('B', token2);

// Reconnect test: drop B after 5s, reconnect after 2s
setTimeout(() => {
  console.log('🔌 Closing client B (reconnect test)');
  wsB.close();
  setTimeout(() => {
    console.log('🔁 Reconnecting client B');
    wsB = attachClient('B', token2);
  }, 2000);
}, 5000);

// Stop after 20s
setTimeout(() => {
  console.log('✅ Simulation complete');
  wsA.close();
  wsB.close();
  process.exit(0);
}, 20000);
