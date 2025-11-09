import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { GameMode } from '@/types/gameMode';

interface ModeDropdownProps {
  selectedMode: GameMode | null;
  onSelectMode: (mode: GameMode) => void;
}

const modes: Array<{
  id: GameMode;
  label: string;
  emoji: string;
  color: string;
}> = [
  {
    id: 'A1-Only',
    label: 'A1-Only Mode',
    emoji: '📐',
    color: 'hsl(210 100% 60%)',
  },
  {
    id: 'A2-Only',
    label: 'A2-Only Mode',
    emoji: '🧮',
    color: 'hsl(280 100% 65%)',
  },
  {
    id: 'All-Maths',
    label: 'All-Maths Mode',
    emoji: '🎯',
    color: 'hsl(45 100% 55%)',
  },
  {
    id: 'A2-Integration',
    label: 'A2-Integration',
    emoji: '∫',
    color: 'hsl(160 100% 50%)',
  },
];

export function ModeDropdown({ selectedMode, onSelectMode }: ModeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedModeData = modes.find((m) => m.id === selectedMode);

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--violet)] focus:ring-offset-2 focus:ring-offset-[#060914]"
        style={{
          background: selectedMode
            ? 'rgba(154,91,255,0.15)'
            : 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: 'var(--text-primary)',
          backdropFilter: 'blur(20px)',
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        aria-label="Select game mode"
        aria-expanded={isOpen}
      >
        {selectedModeData ? (
          <>
            <span className="text-base">{selectedModeData.emoji}</span>
            <span>{selectedModeData.label}</span>
          </>
        ) : (
          <span>Select Mode</span>
        )}
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            <motion.div
              className="absolute top-full left-0 mt-2 min-w-[240px] rounded-xl overflow-hidden z-20"
              style={{
                background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(40px)',
                border: '1px solid rgba(255,255,255,0.2)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              role="menu"
            >
              {modes.map((mode) => (
                <motion.button
                  key={mode.id}
                  onClick={() => {
                    onSelectMode(mode.id);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-all duration-200 focus:outline-none"
                  style={{
                    background:
                      selectedMode === mode.id
                        ? 'rgba(154,91,255,0.2)'
                        : 'transparent',
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                  }}
                  whileHover={{
                    background: 'rgba(154,91,255,0.15)',
                  }}
                  role="menuitem"
                  aria-current={selectedMode === mode.id ? 'true' : undefined}
                >
                  <span className="text-xl">{mode.emoji}</span>
                  <div className="flex-1">
                    <div className="font-bold">{mode.label}</div>
                  </div>
                  {selectedMode === mode.id && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-2 h-2 rounded-full"
                      style={{ background: 'var(--violet)' }}
                    />
                  )}
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
