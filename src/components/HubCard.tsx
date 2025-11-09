import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Atom, BookOpen, Swords } from 'lucide-react';
import { SegmentedSubject } from './SegmentedSubject';
import { Tile } from './Tile';
import { useSubjectStore } from '@/store/useSubjectStore';

export function HubCard() {
  const navigate = useNavigate();
  const { subject } = useSubjectStore();
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handleNavigation = (path: string) => {
    navigate(`${path}?subject=${subject}`);
  };

  return (
    <motion.div
      className="w-full max-w-[880px] mx-auto"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 80px rgba(154,91,255,0.15)',
          transformStyle: 'preserve-3d',
          perspective: '1000px',
        }}
        whileHover={
          prefersReducedMotion
            ? {}
            : {
                rotateX: 2,
                rotateY: -2,
                boxShadow: '0 25px 70px rgba(0,0,0,0.5), 0 0 100px rgba(154,91,255,0.25)',
              }
        }
        transition={{ duration: 0.3 }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background:
              'radial-gradient(circle at 30% 30%, var(--violet), transparent 60%), radial-gradient(circle at 70% 70%, var(--blue), transparent 60%)',
          }}
        />

        <div className="relative z-10 p-8 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h1
              className="text-2xl md:text-3xl font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              Choose Your Path
            </h1>
            <SegmentedSubject />
          </div>

          <div className="space-y-4">
            <motion.div
              animate={
                prefersReducedMotion
                  ? {}
                  : {
                      boxShadow: [
                        '0 0 40px rgba(242,55,212,0.3)',
                        '0 0 60px rgba(242,55,212,0.5)',
                        '0 0 40px rgba(242,55,212,0.3)',
                      ],
                    }
              }
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="rounded-2xl"
            >
              <Tile
                variant="gradient"
                title="DAILY CHALLENGE: QUANTUM CONUNDRUM!"
                onClick={() => handleNavigation('/daily-challenge')}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl md:text-2xl font-black text-white tracking-wide">
                    DAILY CHALLENGE: QUANTUM CONUNDRUM!
                  </h3>
                  <Atom className="w-10 h-10 text-white flex-shrink-0" strokeWidth={2.5} />
                </div>
              </Tile>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Tile
                icon={BookOpen}
                title={`${subject === 'physics' ? 'PHYSICS' : 'MATHS'} STUDY MODE`}
                subtitle="A1 & A2 • Chapter Progression • Rank-Based Unlocks"
                onClick={() => handleNavigation('/study')}
              />

              <Tile
                icon={Swords}
                title="1V1 BATTLE ARENA"
                subtitle="A1 & A2 • Chapter Competitive • Quick Match • Ranked"
                onClick={() => handleNavigation('/battle/queue')}
              />
            </div>
          </div>

          <div className="text-center pt-2">
            <p
              className="text-xs uppercase tracking-[0.2em] font-medium"
              style={{ color: 'var(--text-dim)' }}
            >
              WISDOM YIELDS POWER
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
