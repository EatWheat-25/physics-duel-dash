import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Settings, Trophy, Target } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRanking } from '@/hooks/useRanking';
import RankBadge from '@/components/RankBadge';
import { Button } from '@/components/ui/button';

export function PlayerHubCard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { userData } = useRanking();
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const username = profile?.username || userData.username || 'Player';
  const mmr = userData.currentPoints || 0;
  const wins = userData.wins || 0;
  const streak = userData.winStreak || 0;

  return (
    <motion.div
      className="w-full max-w-[72rem] mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div
        className="relative rounded-2xl overflow-hidden h-[360px] md:h-[420px]"
        style={{
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(40px)',
          border: '1px solid transparent',
          borderImage: 'linear-gradient(135deg, var(--magenta), var(--violet)) 1',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 80px rgba(242,55,212,0.15)',
        }}
      >
        <motion.div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 30% 30%, var(--magenta), transparent 60%), radial-gradient(circle at 70% 70%, var(--violet), transparent 60%)',
          }}
          animate={
            prefersReducedMotion
              ? {}
              : {
                  opacity: [0.15, 0.25, 0.15],
                }
          }
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />

        <div className="relative z-10 h-full flex flex-col md:grid md:grid-cols-[300px_1fr_280px] gap-4 p-6 md:p-8">
          <div className="flex flex-col justify-between md:h-full">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold"
                  style={{
                    background: 'linear-gradient(135deg, var(--magenta), var(--violet))',
                    boxShadow: '0 8px 24px rgba(242,55,212,0.4)',
                  }}
                >
                  {username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="mb-2">
                    <RankBadge rank={userData.currentRank} size="sm" />
                  </div>
                </div>
              </div>

              <div>
                <h2
                  className="text-2xl font-bold mb-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {username}
                </h2>
                <p
                  className="text-sm uppercase tracking-wider"
                  style={{ color: 'var(--text-dim)' }}
                >
                  Battle Nerd • Ready for Action
                </p>
              </div>
            </div>

            <div className="hidden md:block space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/loadout')}
                className="w-full justify-start gap-2 font-bold uppercase tracking-wider"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-primary)',
                }}
              >
                <Settings className="w-4 h-4" />
                Edit Loadout
              </Button>
            </div>
          </div>

          <div className="hidden md:flex items-center justify-center relative">
            <div
              className="absolute inset-0 rounded-xl"
              style={{
                background: 'rgba(0,0,0,0.2)',
                backgroundImage: 'var(--pattern-circuit)',
                backgroundSize: '100px 100px',
                opacity: 0.3,
              }}
            />
            <p
              className="relative text-sm font-medium uppercase tracking-wider"
              style={{ color: 'var(--text-dim)' }}
            >
              Player Card Canvas
            </p>
          </div>

          <div className="flex flex-col justify-between md:h-full">
            <div className="space-y-4">
              <div
                className="rounded-xl p-4"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-xs uppercase tracking-wider font-medium"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    MMR Rating
                  </span>
                  <Target className="w-4 h-4" style={{ color: 'var(--violet)' }} />
                </div>
                <div
                  className="text-2xl md:text-3xl font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {mmr}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-xl p-3"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="w-3 h-3" style={{ color: 'var(--blue)' }} />
                    <span
                      className="text-xs uppercase tracking-wider font-medium"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      Wins
                    </span>
                  </div>
                  <div
                    className="text-2xl font-bold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {wins}
                  </div>
                </div>

                <div
                  className="rounded-xl p-3"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs" style={{ color: 'var(--magenta)' }}>
                      🔥
                    </span>
                    <span
                      className="text-xs uppercase tracking-wider font-medium"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      Streak
                    </span>
                  </div>
                  <div
                    className="text-2xl font-bold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {streak}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/customize')}
                className="w-full justify-center gap-2 font-bold uppercase tracking-wider"
                style={{
                  background: 'linear-gradient(135deg, var(--magenta), var(--violet))',
                  color: 'white',
                  boxShadow: '0 0 20px rgba(242,55,212,0.4)',
                }}
              >
                Customize Card
              </Button>

              <div className="md:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/loadout')}
                  className="w-full justify-center gap-2 font-bold uppercase tracking-wider"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Settings className="w-4 h-4" />
                  Edit Loadout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
