import { useEffect } from 'react';
import { Starfield } from '@/components/Starfield';
import { HubCard } from '@/components/HubCard';
import { BottomNav } from '@/components/BottomNav';
import { TopLeftSelect } from '@/components/TopLeftSelect';

export default function Home() {
  useEffect(() => {
    document.title = 'Choose Your Path | BattleNerds';
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center">
      <Starfield />

      <div className="absolute top-4 left-4 z-20">
        <TopLeftSelect />
      </div>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(154,91,255,0.1) 0%, transparent 50%)',
        }}
      />

      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-8">
        <HubCard />
      </div>

      <BottomNav />
    </div>
  );
}
