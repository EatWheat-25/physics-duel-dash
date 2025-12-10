import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Check, X, Trophy, Clock, Zap, Settings } from 'lucide-react';
import { useGame } from '@/hooks/useGame';
import type { MatchRow } from '@/types/schema';
import { motion, AnimatePresence } from 'framer-motion';
import { Starfield } from '@/components/Starfield';
import { PlayerCard } from '@/components/PlayerCard';

export default function BattleConnected() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [showRoundIntro, setShowRoundIntro] = useState(false);

  // --- Data Fetching ---
  useEffect(() => {
    const stateMatch = location.state?.match as MatchRow | undefined;
    if (stateMatch && stateMatch.id === matchId) {
      setMatch(stateMatch);
      return;
    }
  }, [location.state, matchId]);

  useEffect(() => {
    if (match) return;
    if (!matchId) {
      toast.error('No match ID provided');
      navigate('/matchmaking-new');
      return;
    }
    const fetchMatch = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        navigate('/matchmaking-new');
        return;
      }
      setCurrentUser(user.id);
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();
      if (error || !data) {
        toast.error('Match not found');
        navigate('/matchmaking-new');
        return;
      }
      if (data.player1_id !== user.id && data.player2_id !== user.id) {
        toast.error('You are not part of this match');
        navigate('/matchmaking-new');
        return;
      }
      setMatch(data as MatchRow);
    };
    fetchMatch();
  }, [matchId, navigate, match]);

  useEffect(() => {
    if (!currentUser) {
      const getUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUser(user.id);
      };
      getUser();
    }
  }, [currentUser]);

  const { 
    status, playerRole, errorMessage, question, answerSubmitted, 
    results, roundNumber, lastRoundWinner, consecutiveWinsCount, 
    matchFinished, matchWinner, timeRemaining, submitAnswer 
  } = useGame(match);

  // Round Intro Effect
  useEffect(() => {
    if (roundNumber && roundNumber > 0 && status === 'playing') {
      setShowRoundIntro(true);
      const timer = setTimeout(() => setShowRoundIntro(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [roundNumber, status]);

  // Polling fallback - removed as it uses columns that don't exist in schema
  // Results are handled via WebSocket messages from useGame hook

  const isPlayer1 = match?.player1_id === currentUser;
  const opponentId = isPlayer1 ? match?.player2_id : match?.player1_id;

  if (!match || !currentUser) {
    return (
      <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center relative overflow-hidden">
        <Starfield />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-t-green-500 border-r-transparent border-b-green-500 border-l-transparent rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-green-500/20 rounded-full animate-pulse" />
            </div>
          </div>
          <p className="text-green-500 font-mono tracking-widest text-sm">INITIALIZING BATTLEGROUND</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center p-4 relative overflow-hidden">
        <Starfield />
        <div className="max-w-md w-full bg-red-950/10 border border-red-500/20 p-8 rounded-2xl text-center relative z-10 backdrop-blur-sm">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">CONNECTION LOST</h2>
          <p className="text-red-200/60 mb-8 text-sm">{errorMessage || 'The neural link was severed.'}</p>
          <button 
            onClick={() => navigate('/matchmaking-new')}
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors"
          >
            RETURN TO LOBBY
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-white font-sans overflow-hidden relative">
      <Starfield />
      
      {/* Top Navigation Bar */}
      <header className="relative z-30 w-full border-b border-white/10 bg-[#1e1e1e]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold tracking-wider">FRAGPUNK</div>
          
          <nav className="flex items-center gap-8">
            <a href="#" className="text-green-500 border-b-2 border-green-500 pb-1 text-sm font-medium uppercase tracking-wider">LOBBY</a>
            <a href="#" className="text-white/60 hover:text-white transition-colors text-sm font-medium uppercase tracking-wider">ARSENAL</a>
            <a href="#" className="text-white/60 hover:text-white transition-colors text-sm font-medium uppercase tracking-wider relative">
              STORE
              <span className="absolute -top-1 -right-2 w-2 h-2 bg-orange-500 rounded-full" />
            </a>
            <a href="#" className="text-white/60 hover:text-white transition-colors text-sm font-medium uppercase tracking-wider">SHARD CARD</a>
            <a href="#" className="text-white/60 hover:text-white transition-colors text-sm font-medium uppercase tracking-wider">LEADERBOARD</a>
          </nav>

          <div className="flex items-center gap-3">
            <button className="p-2 rounded hover:bg-white/5 transition-colors">
              <Settings className="w-5 h-5 text-white/60" />
            </button>
            <div className="px-4 py-2 bg-blue-600 rounded text-sm font-medium">M Maniac LV. 12</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          
          {/* Left Sidebar */}
          <aside className="col-span-3 space-y-3">
            <div className="bg-white/5 border-l-4 border-green-500 rounded-lg p-4 relative">
              <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full" />
              <div className="text-xs text-white/50 mb-1">Selected Mode</div>
              <div className="text-green-500 font-bold uppercase">UNRATED</div>
            </div>
            
            <div className="bg-white/5 border-l-4 border-blue-500 rounded-lg p-4">
              <div className="text-xs text-white/50 mb-1">Grade Selected</div>
              <div className="text-white font-medium">PLATINUM I</div>
            </div>
            
            <div className="bg-white/5 border-l-4 border-white/10 rounded-lg p-4">
              <div className="text-xs text-white/50 mb-1">Review Last Game</div>
              <div className="text-white font-medium">VICTORY</div>
            </div>
          </aside>

          {/* Center - Player Cards & Game Area */}
          <div className="col-span-6 flex flex-col items-center">
            {/* Player Cards Section */}
            {(status === 'connecting' || status === 'connected' || status === 'both_connected' || status === 'playing' || status === 'results') && (
              <div className="w-full mb-8">
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <motion.div
                    initial={{ x: -100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <PlayerCard playerId={currentUser} isCurrentUser={true} />
                  </motion.div>
                  
                  {opponentId && (
                    <motion.div
                      initial={{ x: 100, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                    >
                      <PlayerCard playerId={opponentId} />
                    </motion.div>
                  )}
                </div>

                {/* VS Indicator */}
                {status === 'both_connected' && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className="text-center text-4xl font-black text-white/20 mb-6"
                  >
                    VS
                  </motion.div>
                )}
              </div>
            )}

            {/* Game Content */}
            <div className="w-full flex-1">
              <AnimatePresence mode="wait">
                {/* CONNECTING STATE */}
                {(status === 'connecting' || status === 'connected' || status === 'both_connected') && (
                  <motion.div
                    key="connecting"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    className="text-center py-12"
                  >
                    <div className="relative w-32 h-32 mx-auto mb-8">
                      <div className="absolute inset-0 border-2 border-green-500/20 rounded-full" />
                      <div className="absolute inset-0 border-2 border-t-green-500 rounded-full animate-spin" />
                      {status === 'both_connected' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="w-12 h-12 text-green-500" />
                        </div>
                      )}
                    </div>
                    <h2 className="text-3xl font-bold mb-3 tracking-tight">
                      {status === 'both_connected' ? 'OPPONENT LOCKED' : 'SEARCHING FOR TARGET'}
                    </h2>
                    <p className="text-white/40 font-mono text-sm">
                      {status === 'both_connected' ? 'INITIATING COMBAT SEQUENCE...' : 'SCANNING FREQUENCIES...'}
                    </p>
                  </motion.div>
                )}

                {/* PLAYING STATE */}
                {status === 'playing' && question && !showRoundIntro && (
                  <motion.div
                    key="playing"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="w-full"
                  >
                    {/* Timer */}
                    <div className="text-center mb-6">
                      <div className={`text-6xl font-black font-mono tabular-nums transition-colors duration-300 ${
                        (timeRemaining ?? 60) <= 10 ? 'text-red-500' : 'text-white'
                      }`}>
                        {Math.floor((timeRemaining ?? 0) / 60)}:{String((timeRemaining ?? 0) % 60).padStart(2, '0')}
                      </div>
                      <div className="text-xs text-white/30 font-mono mt-2 uppercase tracking-widest">ROUND {roundNumber || 0}</div>
                    </div>

                    {/* Question Card */}
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 mb-6 shadow-2xl">
                      <h3 className="text-2xl md:text-3xl font-bold leading-relaxed text-center">
                        {question.stem || question.questionText}
                      </h3>
                    </div>

                    {/* Answers Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {question.steps?.[0]?.options?.filter(o => String(o).trim()).map((option, idx) => (
                        <motion.button
                          key={idx}
                          onClick={() => !answerSubmitted && submitAnswer(idx)}
                          disabled={answerSubmitted}
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          className={`
                            relative overflow-hidden p-6 rounded-xl border text-left transition-all duration-300
                            ${answerSubmitted 
                              ? 'border-white/5 bg-white/5 opacity-50 cursor-not-allowed' 
                              : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-green-500/50 hover:shadow-[0_0_20px_rgba(34,197,94,0.2)]'
                            }
                          `}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`
                              w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm transition-colors
                              ${answerSubmitted ? 'bg-white/10 text-white/40' : 'bg-white/10 text-white/60'}
                            `}>
                              {String.fromCharCode(65 + idx)}
                            </div>
                            <span className="text-lg font-medium">{option}</span>
                          </div>
                        </motion.button>
                      ))}
                    </div>

                    {answerSubmitted && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 text-center"
                      >
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 rounded-full text-sm font-medium border border-green-500/20">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          AWAITING RESULT CONFIRMATION
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* RESULTS STATE */}
                {status === 'results' && results && (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className="w-full bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 text-center"
                  >
                    <div className="mb-8">
                      {results.round_winner === currentUser ? (
                        <motion.div 
                          initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="inline-block p-4 rounded-full bg-yellow-500/20 mb-4"
                        >
                          <Trophy className="w-12 h-12 text-yellow-500" />
                        </motion.div>
                      ) : results.round_winner === null ? (
                        <div className="inline-block p-4 rounded-full bg-white/10 mb-4">
                          <Clock className="w-12 h-12 text-white/60" />
                        </div>
                      ) : (
                        <div className="inline-block p-4 rounded-full bg-red-500/20 mb-4">
                          <X className="w-12 h-12 text-red-500" />
                        </div>
                      )}
                      
                      <h2 className="text-4xl font-bold mb-2 tracking-tight">
                        {results.round_winner === currentUser ? 'ROUND SECURED' : results.round_winner === null ? 'STALEMATE' : 'ROUND LOST'}
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <motion.div 
                        initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                        className={`p-4 rounded-xl border ${
                        (playerRole === 'player1' && results.player1_correct) || (playerRole === 'player2' && results.player2_correct)
                          ? 'bg-green-500/10 border-green-500/20' 
                          : 'bg-red-500/10 border-red-500/20'
                      }`}>
                        <div className="text-xs font-mono opacity-50 mb-1">YOU CHOSE</div>
                        <div className="text-xl font-bold flex items-center justify-center gap-2">
                          {(playerRole === 'player1' ? results.player1_answer : results.player2_answer) === 0 ? 'TRUE' : 'FALSE'}
                          {((playerRole === 'player1' && results.player1_correct) || (playerRole === 'player2' && results.player2_correct))
                            ? <Check className="w-5 h-5 text-green-500" />
                            : <X className="w-5 h-5 text-red-500" />
                          }
                        </div>
                      </motion.div>

                      <motion.div 
                        initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                        className={`p-4 rounded-xl border ${
                        (playerRole === 'player1' && results.player2_correct) || (playerRole === 'player2' && results.player1_correct)
                          ? 'bg-green-500/10 border-green-500/20' 
                          : 'bg-red-500/10 border-red-500/20'
                      }`}>
                        <div className="text-xs font-mono opacity-50 mb-1">OPPONENT CHOSE</div>
                        <div className="text-xl font-bold flex items-center justify-center gap-2">
                          {(playerRole === 'player1' ? results.player2_answer : results.player1_answer) === 0 ? 'TRUE' : 'FALSE'}
                          {((playerRole === 'player1' && results.player2_correct) || (playerRole === 'player2' && results.player1_correct))
                            ? <Check className="w-5 h-5 text-green-500" />
                            : <X className="w-5 h-5 text-red-500" />
                          }
                        </div>
                      </motion.div>
                    </div>

                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-white/20"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 3, ease: "linear" }}
                      />
                    </div>
                    <div className="mt-2 text-xs font-mono text-white/30">NEXT ROUND STARTING...</div>
                  </motion.div>
                )}

                {/* MATCH FINISHED */}
                {status === 'match_finished' && (
                  <motion.div
                    key="finished"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                  >
                    <Trophy className={`w-32 h-32 mx-auto mb-6 ${matchWinner === currentUser ? 'text-yellow-400' : 'text-gray-500'}`} />
                    <h1 className="text-6xl md:text-8xl font-black mb-6 tracking-tighter">
                      {matchWinner === currentUser ? 'VICTORY' : matchWinner === opponentId ? 'DEFEAT' : 'DRAW'}
                    </h1>
                    <button 
                      onClick={() => navigate('/matchmaking-new')}
                      className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-full transition-colors"
                    >
                      RETURN TO BASE
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Sidebar - Match Info */}
          <aside className="col-span-3">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-xs text-white/50 mb-2 uppercase tracking-wider">MISSION DATA</div>
              <div className="space-y-2 text-xs font-mono text-white/60">
                <div className="flex justify-between">
                  <span>ID:</span>
                  <span className="text-white">{match.id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span>ROUND:</span>
                  <span className="text-green-500">{roundNumber || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>STREAK:</span>
                  <span className="text-yellow-500">{consecutiveWinsCount}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-[#1e1e1e]/80 backdrop-blur-md border-t border-white/10 z-20">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-6">
              <button className="text-white/60 hover:text-white transition-colors text-sm font-medium uppercase tracking-wider">PRACTICE</button>
              <button className="text-white/60 hover:text-white transition-colors text-sm font-medium uppercase tracking-wider">MODULES</button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-colors text-sm uppercase tracking-wider"
              >
                BATTLE!
              </motion.button>
              <button className="text-white/60 hover:text-white transition-colors text-sm font-medium uppercase tracking-wider">PROGRESSION</button>
              <button className="text-white/60 hover:text-white transition-colors text-sm font-medium uppercase tracking-wider">SHOP</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}