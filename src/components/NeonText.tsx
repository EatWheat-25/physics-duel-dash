import { ReactNode } from 'react';

interface NeonTextProps {
  children: ReactNode;
  className?: string;
  gradient?: boolean;
}

export function NeonText({ children, className = '', gradient = false }: NeonTextProps) {
  if (gradient) {
    return (
      <span
        className={`bg-gradient-to-r from-[var(--pink)] via-[var(--violet)] to-[var(--blue)] bg-clip-text text-transparent ${className}`}
        style={{ textShadow: '0 0 20px rgba(255,77,216,0.3)' }}
      >
        {children}
      </span>
    );
  }

  return (
    <span className={className} style={{ color: 'var(--text-primary)' }}>
      {children}
    </span>
  );
}
