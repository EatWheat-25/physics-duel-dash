import { motion } from 'framer-motion';
import { BookOpen, Trophy, Zap, TrendingUp, ShoppingBag } from 'lucide-react';

interface DockProps {
  onModules?: () => void;
  onChallenges?: () => void;
  onBattle?: () => void;
  onProgression?: () => void;
  onShop?: () => void;
}

export function Dock({
  onModules = () => console.log('Modules'),
  onChallenges = () => console.log('Challenges'),
  onBattle = () => console.log('Battle!'),
  onProgression = () => console.log('Progression'),
  onShop = () => console.log('Shop'),
}: DockProps) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const navItems = [
    { icon: BookOpen, label: 'Modules', onClick: onModules },
    { icon: Trophy, label: 'Challenges', onClick: onChallenges },
    { icon: Zap, label: 'BATTLE!', onClick: onBattle, emphasized: true },
    { icon: TrendingUp, label: 'Progression', onClick: onProgression },
    { icon: ShoppingBag, label: 'Shop', onClick: onShop },
  ];

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <motion.nav
        className="flex items-center gap-2 p-3 rounded-3xl"
        style={{
          background: 'var(--neon-card)',
          backdropFilter: 'blur(40px)',
          border: '1px solid var(--neon-border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        {navItems.map((item, index) => {
          const Icon = item.icon;

          if (item.emphasized) {
            return (
              <motion.button
                key={item.label}
                onClick={item.onClick}
                className="relative px-8 py-4 rounded-full font-bold text-sm uppercase tracking-wider transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--magenta)] focus:ring-offset-2 focus:ring-offset-[#060914]"
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
                aria-label="Start Battle"
              >
                <Icon className="w-5 h-5 inline mr-2" />
                {item.label}
              </motion.button>
            );
          }

          return (
            <motion.button
              key={item.label}
              onClick={item.onClick}
              className="flex flex-col items-center gap-1 px-4 py-3 rounded-2xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--violet)] focus:ring-offset-2 focus:ring-offset-[#060914]"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text-dim)',
              }}
              whileHover={{
                background: 'rgba(255,255,255,0.1)',
                color: 'var(--text-primary)',
                boxShadow: '0 0 20px rgba(154,91,255,0.2)',
              }}
              whileTap={{ scale: 0.95 }}
              aria-label={item.label}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </motion.button>
          );
        })}
      </motion.nav>
    </div>
  );
}
