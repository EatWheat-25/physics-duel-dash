import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Palette } from 'lucide-react';
import { Starfield } from '@/components/Starfield';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';

export default function Customize() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Customize Card | BattleNerds';
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Starfield />

      <div className="absolute top-4 left-4 z-20">
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

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 pb-32">
        <div className="text-center mb-12">
          <div className="inline-block mb-4">
            <Palette
              className="w-16 h-16 mx-auto"
              style={{ color: 'var(--magenta)' }}
              strokeWidth={2}
            />
          </div>
          <h1
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Customize Player Card
          </h1>
          <div
            className="inline-block px-4 py-2 rounded-full text-sm font-bold uppercase"
            style={{
              background: 'rgba(242,55,212,0.2)',
              border: '1px solid rgba(242,55,212,0.4)',
              color: 'var(--text-primary)',
            }}
          >
            Coming Soon
          </div>
        </div>

        <div
          className="rounded-3xl p-12 text-center"
          style={{
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.18)',
          }}
        >
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Card Customization
          </h2>
          <p className="text-lg mb-4" style={{ color: 'var(--text-dim)' }}>
            Personalize your player card with custom backgrounds, badges, and effects.
          </p>
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            This feature is under development.
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
