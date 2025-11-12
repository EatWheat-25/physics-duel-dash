import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Trophy, Zap, TrendingUp, ShoppingBag } from 'lucide-react';
import { useSubjectStore } from '@/store/useSubjectStore';
import { useBattleQueueStore } from '@/store/useBattleQueueStore';

interface BottomNavProps {
  onBattleClick?: () => void;
}

export function BottomNav({ onBattleClick }: BottomNavProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { subject } = useSubjectStore();
  const { pendingBattle } = useBattleQueueStore();
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handleNavigation = (path: string, excludeSubject = false) => {
    if (excludeSubject) {
      navigate(path);
    } else {
      navigate(`${path}?subject=${subject}`);
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    { icon: BookOpen, label: 'Modules', path: '/modules' },
    { icon: Trophy, label: 'Challenges', path: '/challenges' },
    { icon: Zap, label: 'BATTLE!', path: '/lobby', emphasized: true, excludeSubject: true },
    { icon: TrendingUp, label: 'Progression', path: '/progression' },
    { icon: ShoppingBag, label: 'Shop', path: '/shop', excludeSubject: true },
  ];

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-2xl">
      <motion.nav
        className="flex items-center justify-center gap-2 p-3 rounded-3xl"
        style={{
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        role="navigation"
        aria-label="Main navigation"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          if (item.emphasized) {
            const isReadyToStart = !!pendingBattle && !!onBattleClick;
            
            return (
              <motion.button
                key={item.label}
                onClick={() => {
                  if (onBattleClick) {
                    onBattleClick();
                  } else {
                    handleNavigation(item.path, item.excludeSubject);
                  }
                }}
                className="relative px-8 md:px-10 py-4 md:py-5 rounded-full font-bold text-sm md:text-base uppercase tracking-wider transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--magenta)] focus:ring-offset-2 focus:ring-offset-[#060914] scale-125 -translate-y-2"
                style={{
                  background: isReadyToStart 
                    ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                    : 'linear-gradient(135deg, var(--magenta), var(--violet))',
                  color: 'white',
                  boxShadow: isReadyToStart
                    ? '0 0 40px rgba(239,68,68,0.6), 0 4px 20px rgba(0,0,0,0.3)'
                    : '0 0 40px rgba(242,55,212,0.5), 0 4px 20px rgba(0,0,0,0.3)',
                }}
                whileHover={{ scale: 1.35, translateY: -10 }}
                whileTap={{ scale: 1.15, translateY: -8 }}
                animate={
                  prefersReducedMotion
                    ? {}
                    : {
                        boxShadow: isReadyToStart
                          ? [
                              '0 0 30px rgba(239,68,68,0.5)',
                              '0 0 40px rgba(239,68,68,0.7)',
                              '0 0 30px rgba(239,68,68,0.5)',
                            ]
                          : [
                              '0 0 30px rgba(242,55,212,0.4)',
                              '0 0 40px rgba(242,55,212,0.6)',
                              '0 0 30px rgba(242,55,212,0.4)',
                            ],
                      }
                }
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                aria-label={isReadyToStart ? 'Start Battle' : item.label}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-4 h-4 md:w-5 md:h-5 inline mr-2" />
                <span className="hidden sm:inline">
                  {isReadyToStart ? 'START' : item.label}
                </span>
                <span className="sm:hidden">
                  <Icon className="w-5 h-5" />
                </span>
              </motion.button>
            );
          }

          return (
            <motion.button
              key={item.label}
              onClick={() => handleNavigation(item.path, item.excludeSubject)}
              className="flex flex-col items-center gap-1 px-3 md:px-4 py-2 md:py-3 rounded-2xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--violet)] focus:ring-offset-2 focus:ring-offset-[#060914]"
              style={{
                background: active ? 'rgba(154,91,255,0.2)' : 'rgba(255,255,255,0.05)',
                color: active ? 'var(--text-primary)' : 'var(--text-dim)',
                border: active ? '1px solid rgba(154,91,255,0.4)' : 'none',
              }}
              whileHover={{
                background: 'rgba(255,255,255,0.1)',
                color: 'var(--text-primary)',
                boxShadow: '0 0 20px rgba(154,91,255,0.2)',
              }}
              whileTap={{ scale: 0.95 }}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-[10px] md:text-xs font-medium hidden sm:block">
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </motion.nav>
    </div>
  );
}
