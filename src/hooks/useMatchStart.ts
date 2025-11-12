import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type StartArgs = { subject: string; mode: string };
type Navigate = (matchId: string) => void;

export function useMatchStart(userId: string, onNavigate: Navigate) {
  let gotMatch = false;
  let channel: RealtimeChannel | null = null;

  async function subscribe() {
    if (channel) return;
    channel = supabase.channel(`mn_${userId}`);
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'match_notifications', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (gotMatch) return;
        const matchId = payload.new.match_id as string;
        console.log('MN INSERT:', { matchId });
        const { data, error } = await supabase
          .from('matches_new')
          .select('*')
          .eq('id', matchId)
          .maybeSingle();
        if (error) { console.warn('MN FETCH ERROR:', error); return; }
        gotMatch = true;
        cleanup();
        onNavigate(matchId);
      }
    );
    await channel.subscribe((status) => console.log('MN SUBSCRIBE:', status));
  }

  function cleanup() {
    if (channel) { supabase.removeChannel(channel); channel = null; }
  }

  async function start({ subject, mode }: StartArgs) {
    console.log('QUEUE: start', { subject, mode });
    await subscribe();
    const { data, error } = await supabase.functions.invoke('enqueue', {
      body: { subject, mode },
    });
    if (error) { console.error('ENQUEUE ERROR:', error); return; }
    console.log('ENQUEUE: response', data);
    if (data?.matched && data?.match?.id) {
      gotMatch = true;
      cleanup();
      onNavigate(data.match.id);
      return;
    }
    console.log('Waiting for notification…');
  }

  return { start, cleanup };
}
