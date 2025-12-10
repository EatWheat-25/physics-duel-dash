import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Check, X, Trophy, Clock, Zap } from 'lucide-react';
import { useGame } from '@/hooks/useGame';
import type { MatchRow } from '@/types/schema';
import { motion, AnimatePresence } from 'framer-motion';

export default function BattleConnected() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  // --- Data Fetching (Keep existing logic) ---
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

  // Polling fallback
  useEffect(() => {
    if (!match || !matchId || (status !== 'playing' && status !== 'results') || !question) return;
    if (status === 'results') return;
    const pollInterval = setInterval(async () => {
      try {
        const { data: matchData, error } = await supabase
          .from('matches')
          .select('player1_answer, player2_answer, results_computed_at, correct_answer, player1_correct, player2_correct, round_winner')
          .eq('id', matchId)
          .single();
        if (error) return;
        if (matchData?.results_computed_at && status !== 'results') {
          window.dispatchEvent(new CustomEvent('polling-results-detected', {
            detail: {
              player1_answer: matchData.player1_answer,
              player2_answer: matchData.player2_answer,
              correct_answer: matchData.correct_answer,
              player1_correct: matchData.player1_correct,
              player2_correct: matchData.player2_correct,
              round_winner: matchData.round_winner
            }
          }));
        }
      } catch (err) {}
    }, 2000);
    return () => clearInterval(pollInterval);
  }, [match, matchId, status, question]);

  // --- Rendering Helpers ---

  const isPlayer1 = match?.player1_id === currentUser;
  const opponentId = isPlayer1 ? match?.player2_id : match?.player1_id;

  if (!match || !currentUser) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-blue-500/20 rounded-full animate-pulse" />
            </div>
          </div>
          <p className="text-blue-500 font-mono tracking-widest text-sm">INITIALIZING BATTLEGROUND</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-red-950/10 border border-red-500/20 p-8 rounded-2xl text-center">
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
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30 overflow-hidden relative">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-[#050505] to-[#050505]" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
      
      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto p-4 md:p-6 flex justify-between items-center">
        <button 
          onClick={() => navigate('/matchmaking-new')}
          className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group"
        >
          <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium tracking-wide">EXIT</span>
        </button>

        <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
          <div className={`w-2 h-2 rounded-full ${status.includes('connected') || status === 'playing' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
          <span className="text-xs font-mono text-blue-200 uppercase tracking-wider">
            {status.replace('_', ' ')}
          </span>
        </div>
      </header>

      {/* Main Arena */}
      <main className="relative z-10 w-full max-w-5xl mx-auto px-4 md:px-6 flex flex-col h-[calc(100vh-100px)]">
        
        {/* Score/Status Bar */}
        <div className="grid grid-cols-3 gap-4 mb-8 items-end">
          {/* Player Stats */}
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <span className="font-bold text-lg">Y</span>
              </div>
              <div>
                <div className="text-xs text-blue-200/50 font-mono mb-0.5">OPERATOR</div>
                <div className="font-bold">YOU</div>
              </div>
            </div>
            {lastRoundWinner === currentUser && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-500/10 rounded-md border border-yellow-500/20">
                <Trophy className="w-3 h-3 text-yellow-500" />
                <span className="text-xs font-bold text-yellow-500">STREAK x{consecutiveWinsCount}</span>
              </div>
            )}
          </div>

          {/* Timer / Round Indicator */}
          <div className="flex flex-col items-center pb-2">
            <div className="text-xs text-white/30 font-mono mb-2 uppercase tracking-widest">
              ROUND {roundNumber || 0}
            </div>
            <div className={`text-5xl font-black font-mono tracking-tighter tabular-nums transition-colors duration-300 ${
              (timeRemaining ?? 60) <= 10 ? 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'text-white'
            }`}>
              {Math.floor((timeRemaining ?? 0) / 60)}:{String((timeRemaining ?? 0) % 60).padStart(2, '0')}
            </div>
          </div>

          {/* Opponent Stats */}
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-3 mb-2 flex-row-reverse text-right">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-colors ${
                status === 'playing' || status === 'results' 
                  ? 'bg-gradient-to-br from-red-600 to-red-800 shadow-red-500/20' 
                  : 'bg-white/5'
              }`}>
                <span className="font-bold text-lg">{status.includes('connect') ? '?' : 'O'}</span>
              </div>
              <div>
                <div className="text-xs text-red-200/50 font-mono mb-0.5">TARGET</div>
                <div className="font-bold">OPPONENT</div>
              </div>
            </div>
            {lastRoundWinner === opponentId && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 rounded-md border border-red-500/20">
                <Zap className="w-3 h-3 text-red-500" />
                <span className="text-xs font-bold text-red-500">STREAK x{consecutiveWinsCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* Game Content */}
        <div className="flex-1 relative flex items-center justify-center">
          <AnimatePresence mode="wait">
            {/* CONNECTING STATE */}
            {(status === 'connecting' || status === 'connected' || status === 'both_connected') && (
              <motion.div
                key="connecting"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
                className="text-center"
              >
                <div className="relative w-32 h-32 mx-auto mb-8">
                  <div className="absolute inset-0 border-2 border-blue-500/20 rounded-full" />
                  <div className="absolute inset-0 border-2 border-t-blue-500 rounded-full animate-spin" />
                  {status === 'both_connected' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="w-12 h-12 text-blue-500" />
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
            {status === 'playing' && question && (
              <motion.div
                key="playing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full max-w-3xl"
              >
                {/* Question Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 mb-8 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
                  
                  <h3 className="text-2xl md:text-3xl font-bold leading-relaxed text-center">
                    {question.stem || question.questionText}
                  </h3>
                </div>

                {/* Answers Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {question.steps?.[0]?.options?.filter(o => String(o).trim()).map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => !answerSubmitted && submitAnswer(idx)}
                      disabled={answerSubmitted}
                      className={`
                        relative group overflow-hidden p-6 rounded-2xl border transition-all duration-300 text-left
                        ${answerSubmitted 
                          ? 'border-white/5 bg-white/5 opacity-50 cursor-not-allowed' 
                          : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] active:scale-[0.98]'
                        }
                      `}
                    >
                      <div className="flex items-center gap-4 relative z-10">
                        <div className={`
                          w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm transition-colors
                          ${answerSubmitted ? 'bg-white/10 text-white/40' : 'bg-white/10 text-white/60 group-hover:bg-blue-500 group-hover:text-white'}
                        `}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <span className="text-lg font-medium">{option}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {answerSubmitted && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 text-center"
                  >
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-full text-sm font-medium border border-blue-500/20">
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
                exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                className="w-full max-w-2xl bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-12 text-center"
              >
                <div className="mb-8">
                  {results.round_winner === currentUser ? (
                    <div className="inline-block p-4 rounded-full bg-yellow-500/20 mb-4 ring-4 ring-yellow-500/10">
                      <Trophy className="w-12 h-12 text-yellow-500" />
                    </div>
                  ) : results.round_winner === null ? (
                    <div className="inline-block p-4 rounded-full bg-white/10 mb-4 ring-4 ring-white/5">
                      <Clock className="w-12 h-12 text-white/60" />
                    </div>
                  ) : (
                    <div className="inline-block p-4 rounded-full bg-red-500/20 mb-4 ring-4 ring-red-500/10">
                      <X className="w-12 h-12 text-red-500" />
                    </div>
                  )}
                  
                  <h2 className="text-4xl font-bold mb-2 tracking-tight">
                    {results.round_winner === currentUser ? 'ROUND SECURED' : results.round_winner === null ? 'STALEMATE' : 'ROUND LOST'}
                  </h2>
                  <p className="text-white/40 font-mono text-sm">
                    {results.round_winner === currentUser ? 'EXCELLENT WORK, OPERATOR.' : 'ADJUST STRATEGY.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className={`p-4 rounded-2xl border ${
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
                  </div>

                  <div className={`p-4 rounded-2xl border ${
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
                  </div>
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
                <h1 className="text-6xl font-black mb-6 tracking-tighter">
                  {matchWinner === currentUser ? 'VICTORY' : matchWinner === opponentId ? 'DEFEAT' : 'DRAW'}
                </h1>
                <button 
                  onClick={() => navigate('/matchmaking-new')}
                  className="px-8 py-4 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform"
                >
                  RETURN TO BASE
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}