import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Trophy, Swords, TrendingUp, ShoppingBag } from 'lucide-react';
import { useSubjectStore } from '@/store/useSubjectStore';

export function QuickActionsStrip() {
  const navigate = useNavigate();
  const location = useLocation();
  const { subject } = useSubjectStore();

  const handleNavigation = (path: string, excludeSubject = false) => {
    if (excludeSubject) {
      navigate(path);
    } else {
      navigate(`${path}?subject=${subject}`);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const items = [
    { icon: BookOpen, label: 'Modules', path: '/modules', emphasized: false },
    { icon: Trophy, label: 'Challenges', path: '/challenges', emphasized: false },
    { icon: Swords, label: 'BATTLE', path: '/battle-queue', emphasized: true, excludeSubject: true },
    { icon: TrendingUp, label: 'Progression', path: '/progression', emphasized: false },
    { icon: ShoppingBag, label: 'Shop', path: '/shop', emphasized: false },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="w-full max-w-[56rem] mx-auto"
    >
      <div
        className="relative rounded-xl overflow-hidden backdrop-blur-xl p-4"
        style={{
          background: 'rgba(0, 20, 40, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          height: '96px',
        }}
      >
        <div className="flex items-center justify-center gap-3 h-full">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            if (item.emphasized) {
              return (
                <motion.button
                  key={item.path}
                  onClick={() => handleNavigation(item.path, item.excludeSubject)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative px-8 py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-300"
                  style={{
                    background: 'linear-gradient(135deg, hsl(280, 100%, 65%), hsl(320, 100%, 60%))',
                    boxShadow: active
                      ? '0 0 40px rgba(194, 108, 255, 0.6), 0 0 60px rgba(255, 103, 161, 0.4)'
                      : '0 0 30px rgba(194, 108, 255, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </div>
                </motion.button>
              );
            }

            return (
              <motion.button
                key={item.path}
                onClick={() => handleNavigation(item.path, item.excludeSubject)}
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                whileTap={{ scale: 0.98 }}
                className="flex flex-col items-center gap-2 px-6 py-3 rounded-lg transition-all duration-200"
                style={{
                  background: active ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                  border: active ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                }}
              >
                <Icon className="w-6 h-6 text-foreground" />
                <span className="text-xs font-medium text-foreground uppercase tracking-wide">
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 30px rgba(194, 108, 255, 0.4);
          }
          50% {
            box-shadow: 0 0 40px rgba(194, 108, 255, 0.6), 0 0 60px rgba(255, 103, 161, 0.4);
          }
        }
      `}</style>
    </motion.div>
  );
}
