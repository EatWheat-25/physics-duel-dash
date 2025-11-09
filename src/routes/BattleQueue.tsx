import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Swords, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Starfield } from '@/components/Starfield';
import { BottomNav } from '@/components/BottomNav';
import { GameMode } from '@/types/gameMode';
import { Button } from '@/components/ui/button';

export default function BattleQueue() {
  const [searchParams] = useSearchParams();
  const subject = searchParams.get('subject') || 'physics';
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    document.title = '1v1 Battle Arena | BattleNerds';
  }, []);

  const modes: { id: GameMode; title: string; emoji: string }[] = [
    { id: 'A1-Only', title: 'A1-Only Mode', emoji: '📐' },
    { id: 'A2-Only', title: 'A2-Only Mode', emoji: '🧮' },
    { id: 'All-Maths', title: 'All-Maths Mode', emoji: '🎯' },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <Starfield />

      <div className="relative z-10 min-h-screen px-4 sm:px-6 lg:px-8 py-8 pb-32">
        {/* Mode Selector - Top Left */}
        <div className="max-w-7xl mx-auto mb-8">
          <div className="relative inline-block">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 px-6 py-3 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all duration-300 bg-card/80 backdrop-blur-xl border border-border hover:border-primary/40 text-foreground"
            >
              <span className="text-xl">
                {selectedMode ? modes.find(m => m.id === selectedMode)?.emoji : '🎮'}
              </span>
              <span>
                {selectedMode ? modes.find(m => m.id === selectedMode)?.title : 'Select Mode'}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full mt-2 left-0 w-64 bg-card/95 backdrop-blur-xl border border-border rounded-2xl overflow-hidden shadow-xl z-50"
                >
                  {modes.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => {
                        setSelectedMode(mode.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-6 py-4 text-left transition-all duration-200 hover:bg-primary/10 ${
                        selectedMode === mode.id ? 'bg-primary/20 text-primary' : 'text-foreground'
                      }`}
                    >
                      <span className="text-2xl">{mode.emoji}</span>
                      <span className="font-bold text-sm">{mode.title}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-block mb-6"
            >
              <Swords
                className="w-20 h-20 mx-auto"
                style={{ color: selectedMode ? 'hsl(280 100% 65%)' : 'hsl(280 100% 65%)' }}
                strokeWidth={2.5}
              />
            </motion.div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              1v1 Battle Arena
            </h1>
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold uppercase bg-accent/20 border border-accent/40 text-accent">
              <span>{subject}</span>
            </div>
          </div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="rounded-3xl p-8 md:p-12 bg-card/80 backdrop-blur-xl border border-border"
          >
            <h2 className="text-2xl font-bold mb-4 text-foreground text-center">
              Quick Match • Ranked
            </h2>
            <p className="text-lg mb-6 text-muted-foreground text-center">
              A1 & A2 • Chapter Competitive
            </p>

            {/* Battle Button */}
            <div className="flex justify-center mt-8">
              <Button
                disabled={!selectedMode}
                className={`px-12 py-6 text-lg font-bold uppercase tracking-wider rounded-2xl transition-all duration-500 ${
                  selectedMode
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 hover:scale-105'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                <Swords className="w-5 h-5 mr-2 inline-block" />
                {selectedMode ? 'Start Battle' : 'Select a Mode'}
              </Button>
            </div>

            {!selectedMode && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-sm text-muted-foreground mt-4"
              >
                Please select a game mode from the dropdown above to start battling
              </motion.p>
            )}
          </motion.div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
