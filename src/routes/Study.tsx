import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { Starfield } from '@/components/Starfield';
import { BottomNav } from '@/components/BottomNav';

export default function Study() {
  const [searchParams] = useSearchParams();
  const subject = searchParams.get('subject') || 'physics';

  useEffect(() => {
    document.title = `${subject.charAt(0).toUpperCase() + subject.slice(1)} Study Mode | BattleNerds`;
  }, [subject]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Starfield />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 pb-32">
        <div className="text-center mb-12">
          <div className="inline-block mb-4">
            <BookOpen
              className="w-16 h-16 mx-auto"
              style={{ color: 'var(--blue)' }}
              strokeWidth={2}
            />
          </div>
          <h1
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            {subject.charAt(0).toUpperCase() + subject.slice(1)} Study Mode
          </h1>
          <div
            className="inline-block px-4 py-2 rounded-full text-sm font-bold uppercase"
            style={{
              background: 'rgba(88,196,255,0.2)',
              border: '1px solid rgba(88,196,255,0.4)',
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
            Chapter Progression
          </h2>
          <p className="text-lg mb-4" style={{ color: 'var(--text-dim)' }}>
            A1 & A2 • Rank-Based Unlocks
          </p>
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            Study mode content will be implemented here.
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
