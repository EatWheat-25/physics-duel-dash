import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Trophy, Swords, TrendingUp, ShoppingBag } from 'lucide-react';
import { useSubjectStore } from '@/store/useSubjectStore';

export function QuickActionsStrip() {
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
    { icon: BookOpen, label: 'Modules', path: '/modules' },
    { icon: Trophy, label: 'Challenges', path: '/challenges' },
    { icon: Swords, label: 'Battle', path: '/lobby', emphasized: true },
    { icon: TrendingUp, label: 'Progression', path: '/progression' },
    { icon: ShoppingBag, label: 'Shop', path: '/shop', excludeSubject: true },
  ];

  return (
    <motion.div
      className="w-full max-w-[68rem] mx-auto px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <div
        className="rounded-xl overflow-x-auto"
        style={{
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        <div className="flex items-center justify-center gap-2 p-4 min-w-max mx-auto">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            if (item.emphasized) {
              return (
                <motion.button
                  key={item.label}
                  onClick={() => handleNavigation(item.path, item.excludeSubject)}
                  className="relative px-8 py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--magenta)]"
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
                  <Icon className="w-5 h-5 inline mr-2" />
                  <span>{item.label}</span>
                </motion.button>
              );
            }

            return (
              <motion.button
                key={item.label}
                onClick={() => handleNavigation(item.path, item.excludeSubject)}
                className="flex items-center gap-2 px-6 py-4 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--violet)]"
                style={{
                  background: active ? 'rgba(154,91,255,0.2)' : 'rgba(255,255,255,0.05)',
                  color: active ? 'var(--text-primary)' : 'var(--text-dim)',
                  border: active ? '1px solid rgba(154,91,255,0.4)' : 'none',
                }}
                whileHover={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'var(--text-primary)',
                }}
                whileTap={{ scale: 0.95 }}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium text-sm uppercase tracking-wide">
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
