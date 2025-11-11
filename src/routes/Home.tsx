import { useEffect } from 'react';
import { Starfield } from '@/components/Starfield';
import { PlayerHubCard } from '@/components/hub/PlayerHubCard';
import { QuickActionsStrip } from '@/components/hub/QuickActionsStrip';
import { HeaderUserMenu } from '@/components/hub/HeaderUserMenu';

export default function Home() {
  useEffect(() => {
    document.title = 'Player Hub | BattleNerds';
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col">
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

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 px-4 py-8">
        <PlayerHubCard />
        <QuickActionsStrip />
      </main>
    </div>
  );
}
