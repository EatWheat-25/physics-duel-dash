import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, History } from 'lucide-react';
import { StudyPatternBackground } from '@/components/StudyPatternBackground';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/BrandMark';

export default function Career() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Career | BattleNerds';
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden text-white font-sans">
      <StudyPatternBackground />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(900px 650px at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 70%, rgba(0,0,0,0.75) 100%)',
        }}
      />

      <div className="absolute top-4 left-4 z-20 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <BrandMark />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="gap-2 font-semibold rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'white',
          }}
          aria-label="Back to home"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Button>
      </div>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <History className="w-12 h-12 mx-auto mb-4 text-cyan-300" />
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Career</h1>
          <p className="text-white/70">
            Your match history and performance timeline will appear here.
          </p>
        </div>

        <div
          className="rounded-3xl p-10 text-center"
          style={{
            background: 'rgba(15, 23, 42, 0.62)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            backdropFilter: 'blur(18px)',
            boxShadow: '0 14px 44px rgba(0,0,0,0.45)',
          }}
        >
          <div className="text-sm font-semibold text-white/80 mb-2">Coming Soon</div>
          <p className="text-white/65">
            We’ll add a list of previous games, results, ranks, and stats.
          </p>
        </div>
      </main>
    </div>
  );
}


