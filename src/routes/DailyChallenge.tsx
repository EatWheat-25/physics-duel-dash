import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Atom } from 'lucide-react';
import { Starfield } from '@/components/Starfield';
import { BottomNav } from '@/components/BottomNav';

export default function DailyChallenge() {
  const [searchParams] = useSearchParams();
  const subject = searchParams.get('subject') || 'physics';

  useEffect(() => {
    document.title = 'Daily Challenge | BattleNerds';
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Starfield />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 pb-32">
        <div className="text-center mb-12">
          <div className="inline-block mb-4">
            <Atom
              className="w-16 h-16 mx-auto"
              style={{ color: 'var(--violet)' }}
              strokeWidth={2}
            />
          </div>
          <h1
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Daily Challenge
          </h1>
          <div
            className="inline-block px-4 py-2 rounded-full text-sm font-bold uppercase"
            style={{
              background: 'rgba(154,91,255,0.2)',
              border: '1px solid rgba(154,91,255,0.4)',
              color: 'var(--text-primary)',
            }}
          >
            {subject}
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
            className="text-3xl font-bold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            QUANTUM CONUNDRUM
          </h2>
          <p className="text-lg mb-8" style={{ color: 'var(--text-dim)' }}>
            Daily challenge content will be implemented here.
          </p>
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            Check back tomorrow for a new challenge!
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
