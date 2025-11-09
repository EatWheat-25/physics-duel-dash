import { useEffect } from 'react';
import { ShoppingBag } from 'lucide-react';
import { Starfield } from '@/components/Starfield';
import { BottomNav } from '@/components/BottomNav';

export default function Shop() {
  useEffect(() => {
    document.title = 'Shop | BattleNerds';
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Starfield />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 pb-32">
        <div className="text-center mb-12">
          <div className="inline-block mb-4">
            <ShoppingBag
              className="w-16 h-16 mx-auto"
              style={{ color: 'var(--magenta)' }}
              strokeWidth={2}
            />
          </div>
          <h1
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Shop
          </h1>
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
            Customize Your Experience
          </h2>
          <p className="text-lg mb-4" style={{ color: 'var(--text-dim)' }}>
            Characters, themes, and power-ups
          </p>
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            Shop interface will be implemented here.
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
