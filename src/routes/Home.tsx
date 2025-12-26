import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BottomNav } from '@/components/BottomNav';
import { HeaderUserMenu } from '@/components/hub/HeaderUserMenu';
import { PlayerCard } from '@/components/hub/PlayerCard';
import { RankMenu } from '@/components/RankMenu';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function Home() {
  const { user } = useAuth();
  const [rankMenuOpen, setRankMenuOpen] = useState(false);
  const [currentMMR, setCurrentMMR] = useState<number>(0);

  useEffect(() => {
    document.title = 'Player Hub | BattleNerds';
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchMMR = async () => {
      try {
        const { data } = await supabase
          .from('players')
          .select('mmr')
          .eq('id', user.id)
          .single();

        if (data?.mmr) {
          setCurrentMMR(data.mmr);
        }
      } catch (error) {
        console.error('Error fetching MMR:', error);
      }
    };

    fetchMMR();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('player-mmr-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new.mmr) {
            setCurrentMMR(payload.new.mmr);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <div 
      className="relative min-h-screen overflow-hidden flex flex-col justify-between"
      style={{
        background: 'linear-gradient(135deg, hsl(222, 30%, 8%) 0%, hsl(240, 25%, 6%) 50%, hsl(222, 30%, 8%) 100%)',
      }}
    >
      {/* Subtle diagonal gradient overlay - red to blue */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.08) 0%, transparent 50%, rgba(59, 130, 246, 0.08) 100%)',
        }}
      />

      <header className="relative z-20 w-full px-6 pt-6 flex justify-between items-center">
        <Button
          onClick={() => setRankMenuOpen(true)}
          variant="ghost"
          className="gap-2 font-bold uppercase tracking-wider text-white hover:bg-white/10"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: 'white',
          }}
          aria-label="View ranking system"
        >
          <Trophy className="w-4 h-4" />
          <span className="hidden sm:inline">Ranks</span>
        </Button>
        <HeaderUserMenu />
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center gap-8 px-4 py-8">
        <PlayerCard />

        {/* Prominent Ranks Button */}
        <div className="w-full max-w-[48rem] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              onClick={() => setRankMenuOpen(true)}
              className="w-full px-8 py-10 text-2xl font-bold uppercase tracking-wider text-white rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #5b21b6, #7c3aed)',
                backgroundSize: '200% 200%',
                border: '3px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 8px 32px rgba(124, 58, 237, 0.6), 0 0 60px rgba(124, 58, 237, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                animation: 'gradient-shift 3s ease infinite',
              }}
            >
              <Trophy className="w-8 h-8 mr-4" style={{ filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.5))' }} />
              <span style={{ textShadow: '0 0 20px rgba(255, 255, 255, 0.5)' }}>RANKS</span>
            </Button>
          </motion.div>
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-[48rem] mx-auto flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => window.location.href = '/matchmaking-new'}
            className="px-8 py-6 text-lg font-bold uppercase tracking-wider text-white"
            style={{
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 4px 20px rgba(220, 38, 38, 0.4)',
            }}
          >
            START
          </Button>
          <Button
            onClick={() => window.location.href = '/dev/db-test'}
            variant="ghost"
            className="px-8 py-6 text-lg font-bold uppercase tracking-wider text-white"
            style={{
              background: 'rgba(55, 65, 81, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            WINNER DEMO
          </Button>
        </div>
      </main>

      <footer className="relative z-20 pb-8">
        <BottomNav />
      </footer>

      <RankMenu
        open={rankMenuOpen}
        onOpenChange={setRankMenuOpen}
        currentMMR={currentMMR}
      />
    </div>
  );
}
