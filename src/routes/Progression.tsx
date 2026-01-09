import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { TrendingUp, ArrowLeft } from 'lucide-react';
import { Starfield } from '@/components/Starfield';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/BrandMark';

export default function Progression() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const subject = searchParams.get('subject') || 'physics';

  useEffect(() => {
    document.title = 'Progression | BattleNerds';
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Starfield />

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

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <div className="inline-block mb-4">
            <TrendingUp
              className="w-16 h-16 mx-auto"
              style={{ color: 'var(--aqua)' }}
              strokeWidth={2}
            />
          </div>
          <h1
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Your Progression
          </h1>
          <div
            className="inline-block px-4 py-2 rounded-full text-sm font-bold uppercase"
            style={{
              background: 'rgba(94,241,255,0.2)',
              border: '1px solid rgba(94,241,255,0.4)',
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
            className="text-2xl font-bold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Track Your Growth
          </h2>
          <p className="text-lg mb-4" style={{ color: 'var(--text-dim)' }}>
            Stats, rankings, and achievements
          </p>
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            Progression dashboard will be implemented here.
          </p>
        </div>
      </div>
    </div>
  );
}
