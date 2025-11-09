import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface TileProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  variant?: 'default' | 'gradient';
  className?: string;
  children?: ReactNode;
}

export function Tile({
  icon: Icon,
  title,
  subtitle,
  onClick,
  variant = 'default',
  className = '',
  children,
}: TileProps) {
  const isGradient = variant === 'gradient';

  return (
    <motion.button
      onClick={onClick}
      className={`relative w-full text-left overflow-hidden rounded-2xl p-6 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--violet)] focus:ring-offset-2 focus:ring-offset-[#060914] ${className}`}
      style={
        isGradient
          ? {
              background: 'linear-gradient(135deg, var(--magenta), var(--violet), var(--indigo))',
              boxShadow: '0 0 40px rgba(242,55,212,0.3)',
            }
          : {
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }
      }
      whileHover={{
        scale: 1.02,
        boxShadow: isGradient
          ? '0 0 50px rgba(242,55,212,0.5)'
          : '0 8px 30px rgba(154,91,255,0.2)',
      }}
      whileTap={{ scale: 0.98 }}
      tabIndex={0}
      aria-label={title}
    >
      {children || (
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {Icon && (
              <Icon
                className={`w-6 h-6 mb-3 ${isGradient ? 'text-white' : 'text-[var(--text-primary)]'}`}
              />
            )}
            <h3
              className={`text-xl font-bold mb-1 ${isGradient ? 'text-white' : 'text-[var(--text-primary)]'}`}
            >
              {title}
            </h3>
            {subtitle && (
              <p className={`text-xs ${isGradient ? 'text-white/80' : 'text-[var(--text-dim)]'}`}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
      )}
    </motion.button>
  );
}
