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
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onCancel} />

      {/* Popup */}
      <motion.div
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        className="relative w-full max-w-sm"
      >
        <div className="relative backdrop-blur-xl bg-card/50 border border-border/50 rounded-2xl shadow-2xl overflow-hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="absolute top-3 right-3 h-8 w-8 p-0 hover:bg-background/60 z-10"
          >
            <X className="w-4 h-4" />
          </Button>

          <div className="relative p-8">
            <div className="flex flex-col items-center gap-5">
              <div className="relative">
                <Loader2 className="w-16 h-16 text-primary animate-spin" strokeWidth={2} />
                <div 
                  className="absolute inset-0 blur-2xl opacity-40"
                  style={{
                    background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)',
                  }}
                />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="text-xl font-bold text-foreground">
                  Finding Opponent
                </h3>
                <p className="text-sm text-muted-foreground">
                  Searching for a worthy challenger...
                </p>
              </div>

              <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-background/60 border border-border/40">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-mono text-muted-foreground tabular-nums">
                  {elapsedTime}s
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
