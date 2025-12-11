import { useEffect, useState } from 'react';
import { Starfield } from '@/components/Starfield';
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
    <div className="relative min-h-screen overflow-hidden flex flex-col justify-between">
      <Starfield />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(154,91,255,0.1) 0%, transparent 50%)',
        }}
      />

      <header className="relative z-20 w-full max-w-[1200px] mx-auto px-6 pt-6 flex justify-between items-start">
        <Button
          onClick={() => setRankMenuOpen(true)}
          variant="ghost"
          className="gap-2 font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[var(--violet)]"
          style={{
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(20px)',
            border: '2px solid rgba(94, 241, 255, 0.5)',
            color: 'white',
            boxShadow: '0 0 20px rgba(94, 241, 255, 0.3)',
          }}
          aria-label="View ranking system"
        >
          <Trophy className="w-4 h-4" style={{ color: 'rgb(94, 241, 255)' }} />
          <span className="hidden sm:inline">Ranks</span>
        </Button>
        <HeaderUserMenu />
      </header>

      <main className="relative z-10 flex flex-col items-center justify-center gap-6 px-4 py-8">
        <PlayerCard />

        {/* Temporary Dev Button */}
        <div className="w-full max-w-[48rem] mx-auto flex justify-center">
          <button
            onClick={() => window.location.href = '/dev/db-test'}
            className="px-6 py-3 bg-red-500/20 border border-red-500/50 text-red-200 rounded-xl font-bold hover:bg-red-500/30 transition-colors flex items-center gap-2"
          >
            🐞 DEV: Go to Test Match
          </button>
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
