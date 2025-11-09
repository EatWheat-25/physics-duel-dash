import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface GlowCardProps {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  variant?: 'blue' | 'violet';
  onClick?: () => void;
  children?: ReactNode;
}

export function GlowCard({
  title,
  subtitle,
  icon: Icon,
  variant = 'blue',
  onClick,
  children,
}: GlowCardProps) {
  const gradients = {
    blue: 'from-[var(--blue)] via-[var(--aqua)] to-[var(--indigo)]',
    violet: 'from-[var(--magenta)] via-[var(--violet)] to-[var(--purple)]',
  };

  const glows = {
    blue: '0 0 60px rgba(88,196,255,0.15)',
    violet: '0 0 60px rgba(154,91,255,0.15)',
  };

  return (
    <motion.button
      onClick={onClick}
      className="relative w-full text-left overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--violet)] focus:ring-offset-2 focus:ring-offset-[#060914]"
      style={{
        background: 'var(--neon-card)',
        backdropFilter: 'blur(40px)',
        border: '1px solid var(--neon-border)',
        boxShadow: glows[variant],
      }}
      whileHover={{
        boxShadow: variant === 'blue'
          ? '0 0 30px rgba(88,196,255,0.35)'
          : '0 0 30px rgba(154,91,255,0.35)',
      }}
      whileTap={{ scale: 0.98 }}
      aria-label={title}
    >
      <div
        className={`absolute inset-0 opacity-10 bg-gradient-to-br ${gradients[variant]}`}
      />

      <div className="relative z-10">
        {Icon && (
          <div className="mb-4">
            <Icon className="w-8 h-8" style={{ color: 'var(--text-primary)' }} />
          </div>
        )}

        <h3
          className="text-2xl font-bold mb-2 tracking-wide"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </h3>

        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
          {subtitle}
        </p>

        {children}
      </div>
    </motion.button>
  );
}
