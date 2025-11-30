import { useEffect } from 'react';
import { Starfield } from '@/components/Starfield';
import { BottomNav } from '@/components/BottomNav';
import { HeaderUserMenu } from '@/components/hub/HeaderUserMenu';
import { PlayerCard } from '@/components/hub/PlayerCard';


export default function Home() {
  useEffect(() => {
    document.title = 'Player Hub | BattleNerds';
  }, []);

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

      <header className="relative z-20 w-full max-w-[1200px] mx-auto px-6 pt-6 flex justify-end">
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
    </div>
  );
}
