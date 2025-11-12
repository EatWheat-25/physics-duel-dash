import { motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { Button } from './ui/button';

interface FindingOpponentPopupProps {
  elapsedTime: number;
  onCancel: () => void;
}

export function FindingOpponentPopup({ elapsedTime, onCancel }: FindingOpponentPopupProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="fixed top-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
    >
      <div className="relative backdrop-blur-xl bg-card/95 border border-border/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* Animated gradient border effect */}
        <div 
          className="absolute inset-0 opacity-50 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.3), transparent)',
            animation: 'shimmer 2s infinite',
          }}
        />

        <div className="relative p-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="absolute top-2 right-2 h-8 w-8 p-0 hover:bg-destructive/20"
          >
            <X className="w-4 h-4" />
          </Button>

          <div className="flex flex-col items-center gap-4 pt-2">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-primary animate-spin" strokeWidth={2.5} />
              <div 
                className="absolute inset-0 blur-xl opacity-60"
                style={{
                  background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)',
                }}
              />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-foreground">
                Finding Opponent
              </h3>
              <p className="text-sm text-muted-foreground">
                Searching for a worthy challenger...
              </p>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/60 border border-border/40">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-mono text-muted-foreground">
                {elapsedTime}s
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }
      `}</style>
    </motion.div>
  );
}
