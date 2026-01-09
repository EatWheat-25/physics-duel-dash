import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Starfield } from '@/components/Starfield';
import { BottomNav } from '@/components/BottomNav';
import { PlayerHubCard } from '@/components/hub/PlayerHubCard';
import { QuickActionsStrip } from '@/components/hub/QuickActionsStrip';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/BrandMark';

export default function Profile() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Profile | BattleNerds';
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

      <div className="absolute top-4 left-4 z-20 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <BrandMark />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="gap-2 font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[var(--violet)]"
          style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'white',
          }}
          aria-label="Go back to home"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Button>
      </div>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 px-4 py-16 pb-32">
        <PlayerHubCard />
        <QuickActionsStrip />
      </main>

      <BottomNav />
    </div>
  );
}
