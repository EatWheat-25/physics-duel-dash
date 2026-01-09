import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Swords, ChevronDown, ArrowLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Starfield } from '@/components/Starfield';
import { GameMode } from '@/types/gameMode';
import { Button } from '@/components/ui/button';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { loadMatchmakingPrefs, saveMatchmakingPrefs } from '@/utils/matchmakingPrefs';
import { BrandMark } from '@/components/BrandMark';

const AVAILABLE_MODES: { id: GameMode; title: string; emoji: string }[] = [
  { id: 'A1-Only', title: 'A1-Only Mode', emoji: '📐' },
  { id: 'A2-Only', title: 'A2-Only Mode', emoji: '🧮' },
  { id: 'All-Maths', title: 'All-Maths Mode', emoji: '🎯' },
];

function isGameMode(value: string | null): value is GameMode {
  return AVAILABLE_MODES.some((m) => m.id === value);
}

function normalizeSubject(subject: string): string {
  // Backend normalizes maths → math, so do it here too for consistency.
  return subject === 'maths' ? 'math' : subject;
}

function normalizeLevel(level: string | null): 'A1' | 'A2' | null {
  if (!level) return null;
  const upper = level.toUpperCase();
  if (upper === 'A1') return 'A1';
  if (upper === 'A2') return 'A2';
  return null;
}

function levelFromMode(mode: GameMode | null): 'A1' | 'A2' | null {
  if (!mode) return null;
  return mode === 'A1-Only' ? 'A1' : 'A2';
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function BattleQueue() {
  const [searchParams] = useSearchParams();
  const [prefs] = useState(() => loadMatchmakingPrefs());
  const navigate = useNavigate();
  const subject = normalizeSubject(searchParams.get('subject') || prefs?.subject || 'physics');
  const levelParam = normalizeLevel(searchParams.get('level') ?? prefs?.level ?? null);
  const modeParam = searchParams.get('mode');
  const initialModeFromParams: GameMode | null = (() => {
    if (levelParam === 'A1') return 'A1-Only';
    if (levelParam === 'A2') return 'A2-Only';
    if (isGameMode(modeParam)) return modeParam;
    return null;
  })();

  const [selectedMode, setSelectedMode] = useState<GameMode | null>(initialModeFromParams);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { status, startMatchmaking, leaveQueue, queueStartTime, error } = useMatchmaking();
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    document.title = '1v1 Battle Arena | BattleNerds';
  }, []);

  useEffect(() => {
    if (status === 'searching' && queueStartTime) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - queueStartTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }

    // Reset when not searching
    setElapsedTime(0);
  }, [status, queueStartTime]);

  const handleStartBattle = async () => {
    if (status === 'searching' || status === 'matched') return;

    const level = levelParam ?? levelFromMode(selectedMode);
    if (!level) return;

    saveMatchmakingPrefs({ subject, level });
    await startMatchmaking(subject, level);
  };

  const handleLeaveQueue = async () => {
    await leaveQueue();
    setElapsedTime(0);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <Starfield />

      <div className="relative z-10 min-h-screen px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button & Mode Selector - Top Left */}
        <div className="max-w-7xl mx-auto mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <BrandMark />
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="gap-2 font-bold uppercase tracking-wider bg-card/80 backdrop-blur-xl border border-border hover:border-primary/40"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Button>
              
              <div className="relative inline-block">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                disabled={status === 'searching' || status === 'matched'}
                className="flex items-center gap-3 px-6 py-3 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all duration-300 bg-card/80 backdrop-blur-xl border border-border hover:border-primary/40 text-foreground"
              >
                <span className="text-xl">
                  {selectedMode ? AVAILABLE_MODES.find(m => m.id === selectedMode)?.emoji : '🎮'}
                </span>
                <span>
                  {selectedMode ? AVAILABLE_MODES.find(m => m.id === selectedMode)?.title : 'Select Mode'}
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
                    {AVAILABLE_MODES.map((mode) => (
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
            </div>
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

            {/* Battle Button or Queue Status */}
            <div className="flex flex-col items-center gap-4 mt-8">
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleStartBattle}
                  disabled={status === 'searching' || status === 'matched' || (!selectedMode && !levelParam)}
                  className={`px-12 py-6 text-lg font-bold uppercase tracking-wider rounded-2xl transition-all duration-500 ${
                    status === 'searching' || status === 'matched'
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : selectedMode || levelParam
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 hover:scale-105'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  <Swords className="w-5 h-5 mr-2 inline-block" />
                  {status === 'searching' ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Searching {formatElapsed(elapsedTime)}
                    </span>
                  ) : selectedMode || levelParam ? (
                    'Start Battle'
                  ) : (
                    'Select a Mode'
                  )}
                </Button>

                {status === 'searching' && (
                  <Button
                    onClick={handleLeaveQueue}
                    variant="outline"
                    size="lg"
                    className="py-6 rounded-2xl"
                  >
                    Cancel
                  </Button>
                )}
              </div>

              {status === 'matched' ? (
                <div className="flex items-center gap-3 text-lg text-green-500 font-bold">
                  <Swords className="w-6 h-6" />
                  Match found! Connecting...
                </div>
              ) : null}

              {error && status === 'idle' && (
                <div className="text-sm text-red-400">{error}</div>
              )}
            </div>

            {!selectedMode && !levelParam && (
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
    </div>
  );
}
