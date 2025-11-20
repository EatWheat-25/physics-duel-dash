import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Trophy, Zap, TrendingUp, ShoppingBag, Brain } from 'lucide-react';
import { useSubjectStore } from '@/store/useSubjectStore';

interface BottomNavProps {
  onBattleClick?: () => void;
}

export function BottomNav({ onBattleClick }: BottomNavProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { subject } = useSubjectStore();
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
    { icon: Brain, label: 'Practice', path: '/practice' },
    { icon: BookOpen, label: 'Modules', path: '/modules' },
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
                className="relative px-6 md:px-8 py-3 md:py-4 rounded-full font-bold text-xs md:text-sm uppercase tracking-wider transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--magenta)] focus:ring-offset-2 focus:ring-offset-[#060914]"
                style={{
                  background: 'linear-gradient(135deg, var(--magenta), var(--violet))',
                  color: 'white',
                  boxShadow: '0 0 30px rgba(242,55,212,0.4)',
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={
                  prefersReducedMotion
                    ? {}
                    : {
                        boxShadow: [
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
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-4 h-4 md:w-5 md:h-5 inline mr-2" />
                <span className="hidden sm:inline">{item.label}</span>
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
