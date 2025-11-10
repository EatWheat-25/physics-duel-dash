import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Starfield } from '@/components/Starfield';
import { BottomNav } from '@/components/BottomNav';
import { TopLeftSelect } from '@/components/TopLeftSelect';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Lobby() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const subject = searchParams.get('subject') || 'physics';
  const mode = searchParams.get('mode') || 'quick';
  const chapter = searchParams.get('chapter') || 'mechanics';

  const [isQueued, setIsQueued] = useState(false);
  const [queueTime, setQueueTime] = useState(0);

  useEffect(() => {
    document.title = 'Lobby | BattleNerds';
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isQueued) {
      interval = setInterval(() => {
        setQueueTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isQueued]);

  useEffect(() => {
    if (!isQueued) return;

    const checkQueue = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel(`queue:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'matches_new',
            filter: `p1=eq.${user.id},p2=eq.${user.id}`,
          },
          async (payload) => {
            console.log('Match found!', payload);
            const matchId = payload.new.id;

            const { data: opponentData } = await supabase
              .from('players')
              .select('display_name')
              .eq('id', payload.new.p1 === user.id ? payload.new.p2 : payload.new.p1)
              .maybeSingle();

            navigate(`/online-battle/${matchId}`, {
              state: {
                yourUsername: 'You',
                opponentName: opponentData?.display_name || 'Opponent',
              },
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    checkQueue();
  }, [isQueued, navigate]);

  const handleStartQueue = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No active session');
        return;
      }

      setIsQueued(true);
      setQueueTime(0);

      const { data, error } = await supabase.functions.invoke('enqueue', {
        body: {
          subject,
          chapter,
          region: null,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Queue error:', error);
        setIsQueued(false);
        return;
      }

      console.log('Queue response:', data);

      if (data.matched) {
        navigate(`/online-battle/${data.match_id}`, {
          state: {
            yourUsername: 'You',
            opponentName: data.opponent_name || 'Opponent',
          },
        });
      }
    } catch (error) {
      console.error('Failed to queue:', error);
      setIsQueued(false);
    }
  };

  const handleLeaveQueue = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke('leave_queue', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      setIsQueued(false);
      setQueueTime(0);
    } catch (error) {
      console.error('Failed to leave queue:', error);
    }
  };

  const handleBack = async () => {
    if (isQueued) {
      await handleLeaveQueue();
    }
    navigate('/');
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Starfield />

      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-2 font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[var(--violet)]"
          style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-primary)',
          }}
          aria-label="Go back to home"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Button>
        <TopLeftSelect />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 pb-32">
        <motion.div
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div
            className="rounded-3xl p-12 text-center"
            style={{
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(40px)',
              border: '1px solid rgba(255,255,255,0.18)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
          >
            <h1
              className="text-4xl md:text-5xl font-bold mb-8"
              style={{ color: 'var(--text-primary)' }}
            >
              {isQueued ? 'Finding Opponent...' : 'Battle Lobby'}
            </h1>

            <div className="flex flex-wrap gap-3 justify-center mb-8">
              <div
                className="px-4 py-2 rounded-full text-sm font-bold uppercase"
                style={{
                  background: 'rgba(88,196,255,0.2)',
                  border: '1px solid rgba(88,196,255,0.4)',
                  color: 'var(--text-primary)',
                }}
              >
                {subject}
              </div>

              <div
                className="px-4 py-2 rounded-full text-sm font-bold uppercase"
                style={{
                  background: 'rgba(154,91,255,0.2)',
                  border: '1px solid rgba(154,91,255,0.4)',
                  color: 'var(--text-primary)',
                }}
              >
                {mode}
              </div>

              {chapter && (
                <div
                  className="px-4 py-2 rounded-full text-sm font-bold uppercase"
                  style={{
                    background: 'rgba(242,55,212,0.2)',
                    border: '1px solid rgba(242,55,212,0.4)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {chapter}
                </div>
              )}
            </div>

            <AnimatePresence mode="wait">
              {!isQueued ? (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <p className="text-lg mb-8" style={{ color: 'var(--text-dim)' }}>
                    Tap <strong style={{ color: 'var(--text-primary)' }}>Battle!</strong> in the
                    bottom dock to start matchmaking
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="queued"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <Loader2 className="w-16 h-16 mx-auto animate-spin" style={{ color: 'var(--violet)' }} />
                  <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    Queue Time: {Math.floor(queueTime / 60)}:{(queueTime % 60).toString().padStart(2, '0')}
                  </p>
                  <motion.button
                    onClick={handleLeaveQueue}
                    className="px-8 py-3 rounded-full font-bold uppercase tracking-wider transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--magenta)]"
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: 'var(--text-primary)',
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Leave Queue
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      <BottomNav onBattleClick={isQueued ? undefined : handleStartQueue} />
    </div>
  );
}
