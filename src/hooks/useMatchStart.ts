import { supabase } from '@/integrations/supabase/client';
import { useRef, useCallback, useEffect } from 'react';

type StartArgs = { subject: string; chapter: string; mode?: string };
type Navigate = (matchId: string) => void;

export function useMatchStart(userId: string, onNavigate: Navigate) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);
  const subscribingRef = useRef(false);
  const gotMatchRef = useRef(false);
  const inProgressRef = useRef(false);

  const cleanup = useCallback(() => {
    const channels = supabase.getChannels?.() ?? [];
    channels.forEach((ch) => supabase.removeChannel(ch));
    channelRef.current = null;
    subscribedRef.current = false;
    subscribingRef.current = false;
    inProgressRef.current = false;
  }, []);

  const ensureSubscribed = useCallback(async () => {
    if (subscribedRef.current || subscribingRef.current) return;
    subscribingRef.current = true;

    // Kill any old channels to avoid stacked handlers
    const channels = supabase.getChannels?.() ?? [];
    channels.forEach((ch) => supabase.removeChannel(ch));

    const ch = supabase.channel(`mn_${userId}`);
    channelRef.current = ch;

    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'match_notifications', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (gotMatchRef.current) return;
        const matchId = payload.new.match_id as string;
        console.log('MN INSERT:', { matchId });

        const { data, error } = await supabase
          .from('matches_new')
          .select('*')
          .eq('id', matchId)
          .maybeSingle();

        if (error || !data) {
          console.warn('MN FETCH ERROR:', error);
          return;
        }
        
        gotMatchRef.current = true;
        cleanup();
        onNavigate(matchId);
      }
    );

    await ch.subscribe((status) => {
      console.log('MN SUBSCRIBE:', status);
      if (status === 'SUBSCRIBED') {
        subscribedRef.current = true;
        subscribingRef.current = false;
      }
    });
  }, [cleanup, onNavigate, userId]);

  const start = useCallback(async ({ subject, chapter }: StartArgs) => {
    if (inProgressRef.current) {
      console.log('QUEUE: already in progress, ignoring');
      return;
    }
    
    console.log('QUEUE: start', { subject, chapter });
    inProgressRef.current = true;
    gotMatchRef.current = false;

    await ensureSubscribed();
    
    console.log('MN TEST: subscribed, invoking enqueue…');
    const { data, error } = await supabase.functions.invoke('enqueue', {
      body: { subject, chapter },
    });
    
    if (error) {
      console.error('ENQUEUE ERROR:', error);
      inProgressRef.current = false;
      return;
    }
    
    console.log('ENQUEUE: response', data);
    
    if (data?.matched && data?.match?.id) {
      if (!gotMatchRef.current) {
        gotMatchRef.current = true;
        cleanup();
        onNavigate(data.match.id);
      }
      return;
    }
    
    // Otherwise we wait for the INSERT notification
    console.log('Waiting for notification…');
  }, [cleanup, ensureSubscribed, onNavigate]);

  // Clean up on unmount
  useEffect(() => () => cleanup(), [cleanup]);

  return { start, cleanup };
}
