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
    { icon: Zap, label: 'BATTLE!', path: '/matchmaking-new', emphasized: true, excludeSubject: true },
    { icon: TrendingUp, label: 'Progression', path: '/progression' },
    { icon: ShoppingBag, label: 'Shop', path: '/shop', excludeSubject: true },
  ];

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-2xl">
      <motion.nav
        className="flex items-center justify-center gap-3 px-4 py-3 rounded-2xl"
        style={{
          background: 'rgba(30, 41, 59, 0.78)',
          backdropFilter: 'blur(26px)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 18px 55px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
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
                className="relative px-6 md:px-7 py-3 md:py-3.5 rounded-xl font-black text-[11px] md:text-xs uppercase tracking-wider transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:ring-offset-2 focus:ring-offset-[#060914]"
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #f97316)',
                  color: 'white',
                  border: '1px solid rgba(0,0,0,0.35)',
                  boxShadow: '0 18px 45px rgba(0,0,0,0.35), 0 0 28px rgba(249,115,22,0.35)',
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={
                  prefersReducedMotion
                    ? {}
                    : {
                        boxShadow: [
                          '0 18px 45px rgba(0,0,0,0.35), 0 0 26px rgba(249,115,22,0.30)',
                          '0 18px 45px rgba(0,0,0,0.35), 0 0 34px rgba(249,115,22,0.45)',
                          '0 18px 45px rgba(0,0,0,0.35), 0 0 26px rgba(249,115,22,0.30)',
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
                <Icon className="w-4 h-4 inline mr-2" />
                <span>{item.label}</span>
              </motion.button>
            );
          }

          return (
            <motion.button
              key={item.label}
              onClick={() => handleNavigation(item.path, item.excludeSubject)}
              className="flex flex-col items-center gap-1 px-3 md:px-4 py-2 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#a3e635] focus:ring-offset-2 focus:ring-offset-[#060914]"
              style={{
                background: active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)',
                color: active ? 'white' : 'rgba(255,255,255,0.78)',
                border: active ? '1px solid rgba(163,230,53,0.20)' : '1px solid rgba(255,255,255,0.10)',
              }}
              whileHover={{
                background: 'rgba(255,255,255,0.15)',
                color: 'white',
                boxShadow: '0 0 20px rgba(255,255,255,0.2)',
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
