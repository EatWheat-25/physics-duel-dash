import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Users, ArrowLeft, CheckCircle2, Zap, Trophy, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGame } from '@/hooks/useGame';
import type { MatchRow } from '@/types/schema';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Minimal Battle Connection UI
 * 
 * Shows:
 * - Match ID
 * - Connection status for both players
 * - "Both players connected!" when ready
 */
export default function BattleConnected() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  // Try to use match from navigation state first
  useEffect(() => {
    const stateMatch = location.state?.match as MatchRow | undefined;
    if (stateMatch && stateMatch.id === matchId) {
      console.log('[BattleConnected] ✅ Using match from navigation state:', stateMatch.id);
      setMatch(stateMatch);
      return;
    }
  }, [location.state, matchId]);

  // Fetch match from database if not in state
  useEffect(() => {
    if (match) return; // Already have match from state

    if (!matchId) {
      toast.error('No match ID provided');
      navigate('/matchmaking-new');
      return;
    }

    const fetchMatch = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('[BattleConnected] User not authenticated:', userError);
        toast.error('Please log in to view match');
        navigate('/matchmaking-new');
        return;
      }

      setCurrentUser(user.id);
      console.log('[BattleConnected] Fetching match from DB:', matchId);

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

      // Verify user is part of match
      if (data.player1_id !== user.id && data.player2_id !== user.id) {
        toast.error('You are not part of this match');
        navigate('/matchmaking-new');
        return;
      }

      console.log('[BattleConnected] ✅ Match loaded:', data.id);
      setMatch(data as MatchRow);
    };

    fetchMatch();
  }, [matchId, navigate, match]);

  // Get current user if not set
  useEffect(() => {
    if (!currentUser) {
      const getUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user.id);
        }
      };
      getUser();
    }
  }, [currentUser]);

  // Use game hook for connection - MUST be declared before useEffect that uses its values
  const { 
    status, 
    playerRole, 
    errorMessage, 
    question, 
    answerSubmitted, 
    waitingForOpponent, 
    results,
    // Stage 3: Tug-of-war state
    roundNumber,
    lastRoundWinner,
    consecutiveWinsCount,
    matchFinished,
    matchWinner,
    totalRounds,
    // Timer state
    timeRemaining,
    submitAnswer 
  } = useGame(match);

  // Polling fallback: Check match state every 2 seconds to catch missed WS messages
  useEffect(() => {
    if (!match || !matchId || (status !== 'playing' && status !== 'results') || !question) {
      return;
    }

    // If already showing results, stop polling
    if (status === 'results') {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const { data: matchData, error } = await supabase
          .from('matches')
          .select('player1_answer, player2_answer, results_computed_at, correct_answer, player1_correct, player2_correct, round_winner')
          .eq('id', matchId)
          .single();

        // If columns don't exist (migration not applied), skip polling
        if (error) {
          if (error.code === 'PGRST116' || error.message?.includes('column') || error.message?.includes('does not exist')) {
            console.warn('[BattleConnected] Stage 2 columns not found - migrations may not be applied. Skipping polling.');
            return;
          }
          // Other errors - log but don't spam
          return;
        }

        // If results are computed but we haven't received the WS message, manually trigger display
        if (matchData?.results_computed_at && status !== 'results') {
          console.log('[BattleConnected] Polling detected results - manually triggering display');
          
          // Manually send a RESULTS_RECEIVED-like event to the WebSocket handler
          // We'll dispatch it via a custom event that useGame can listen to
          // Or we can directly update via a ref/callback
          // Actually, simpler: just check if we need to manually update state
          // But we don't have direct access to setState from useGame here...
          
          // Better approach: trigger a custom event that useGame listens for
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
      } catch (err) {
        // Silently handle errors in polling
        console.warn('[BattleConnected] Polling error (non-critical):', err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [match, matchId, status, question]);

  // Render loading state
  if (!match || !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] relative overflow-hidden">
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-purple-900/20 animate-pulse" />
        {/* Starfield effect */}
        <div className="absolute inset-0 opacity-30">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-4"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="w-12 h-12 text-purple-400 mx-auto drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
            </motion.div>
            <h2 className="text-2xl font-bold text-white">Loading match...</h2>
          </motion.div>
        </div>
      </div>
    );
  }

  // Render error state
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 via-purple-900/20 to-red-900/20 animate-pulse" />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4 max-w-md"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-red-500 text-xl"
            >
              ⚠️ Error
            </motion.div>
            <p className="text-white">{errorMessage || 'Unknown error'}</p>
            <Button
              onClick={() => navigate('/matchmaking-new')}
              className="mt-4"
            >
              Go Back
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  const isPlayer1 = match.player1_id === currentUser;
  const opponentId = isPlayer1 ? match.player2_id : match.player1_id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a0a1f] to-[#0a0a0f] text-white p-8 relative overflow-hidden">
      {/* Animated gradient overlay */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-blue-900/20 to-purple-900/30"
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%'],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          repeatType: 'reverse',
        }}
        style={{
          backgroundSize: '200% 200%',
        }}
      />
      {/* Subtle starfield */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>
      <div className="relative z-10 max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <motion.div whileHover={{ x: -5 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              onClick={() => navigate('/matchmaking-new')}
              className="text-white mb-4 hover:bg-purple-500/20"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-2 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Battle Connection
          </h1>
          <p className="text-gray-400">Match ID: {match.id}</p>
        </motion.div>

        {/* Connection Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-[rgba(15,15,25,0.8)] backdrop-blur-xl rounded-xl p-8 border border-purple-500/30 shadow-[0_0_30px_rgba(139,92,246,0.2)] relative overflow-hidden"
        >
          {/* Animated border gradient */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-purple-500/20 opacity-50 animate-pulse" />
          <div className="relative z-10">
          <div className="space-y-6">
            {/* Stage 3: Tug-of-War Bar */}
            <AnimatePresence>
              {(status === 'playing' || status === 'results') && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-[rgba(30,30,40,0.6)] backdrop-blur-sm rounded-lg p-4 space-y-2 border border-purple-500/20 shadow-[0_0_15px_rgba(139,92,246,0.1)]"
                >
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-300">Round {roundNumber || 0}</span>
                  {consecutiveWinsCount > 0 && (
                    <span className="text-purple-300 font-semibold">
                      {lastRoundWinner === currentUser ? 'You' : 'Opponent'}: {consecutiveWinsCount} win streak
                    </span>
                  )}
                </div>
                {/* Tug-of-war visual bar */}
                <div className="relative h-4 bg-slate-600 rounded-full overflow-hidden">
                  <div 
                    className={`absolute h-full transition-all duration-500 ${
                      lastRoundWinner === currentUser 
                        ? 'bg-blue-500' 
                        : lastRoundWinner === opponentId
                        ? 'bg-red-500'
                        : 'bg-gray-500'
                    }`}
                    style={{
                      width: lastRoundWinner === currentUser 
                        ? `${Math.min(50 + (consecutiveWinsCount * 25), 100)}%`
                        : lastRoundWinner === opponentId
                        ? `${Math.min(50 + (consecutiveWinsCount * 25), 100)}%`
                        : '50%',
                      left: lastRoundWinner === currentUser ? '0%' : lastRoundWinner === opponentId ? 'auto' : '25%',
                      right: lastRoundWinner === opponentId ? '0%' : 'auto'
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-1 h-full bg-white/30" />
                  </div>
                </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Match Finished State */}
            <AnimatePresence>
              {status === 'match_finished' && matchFinished && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.5 }}
                  className="text-center space-y-4"
                >
                  <motion.h2
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-3xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"
                  >
                    Match Finished!
                  </motion.h2>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="p-6 bg-[rgba(30,30,40,0.6)] backdrop-blur-sm rounded-lg space-y-3 border border-purple-500/30 shadow-[0_0_25px_rgba(139,92,246,0.2)]"
                  >
                  {matchWinner === currentUser ? (
                    <div className="text-4xl mb-4">🎉</div>
                  ) : matchWinner === opponentId ? (
                    <div className="text-4xl mb-4">😔</div>
                  ) : (
                    <div className="text-4xl mb-4">🤝</div>
                  )}
                  <p className="text-2xl font-semibold">
                    {matchWinner === currentUser 
                      ? 'You Won!' 
                      : matchWinner === opponentId
                      ? 'Opponent Won'
                      : 'Draw'}
                  </p>
                  <p className="text-slate-300">Total Rounds: {totalRounds || 0}</p>
                  <Button
                    onClick={() => navigate('/matchmaking-new')}
                    className="mt-4"
                  >
                    Return to Lobby
                  </Button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Status Header */}
            <div className="text-center">
              <AnimatePresence mode="wait">
                {status === 'connecting' && (
                  <motion.div
                    key="connecting"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="mx-auto mb-4 w-16 h-16"
                    >
                      <Loader2 className="w-16 h-16 text-blue-400 drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]" />
                    </motion.div>
                    <motion.h2
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-2xl font-bold text-white mb-2"
                    >
                      Connecting...
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-slate-300"
                    >
                      Establishing connection to game server
                    </motion.p>
                  </motion.div>
                )}
                {status === 'connected' && (
                  <motion.div
                    key="connected"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      className="mx-auto mb-4 w-16 h-16"
                    >
                      <CheckCircle2 className="w-16 h-16 text-green-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.6)]" />
                    </motion.div>
                    <motion.h2
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-2xl font-bold text-white mb-2"
                    >
                      You're Connected!
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-slate-300"
                    >
                      Waiting for opponent to connect...
                    </motion.p>
                  </motion.div>
                )}
                {status === 'both_connected' && (
                  <motion.div
                    key="both_connected"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      className="mx-auto mb-4 w-16 h-16"
                    >
                      <Users className="w-16 h-16 text-green-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.6)]" />
                    </motion.div>
                    <motion.h2
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-2xl font-bold text-white mb-2 bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent"
                    >
                      Both Players Connected!
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-slate-300"
                    >
                      Starting game...
                    </motion.p>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence mode="wait">
                {status === 'playing' && question && (() => {
                  const firstStep = question.steps?.[0];
                  const nonEmptyOptions = (firstStep?.options ?? []).filter((o: string) => String(o).trim() !== '');
                  
                  // Format timer as MM:SS
                  const formatTime = (seconds: number | null) => {
                    if (seconds === null || seconds < 0) return '00:00'
                    const mins = Math.floor(seconds / 60)
                    const secs = seconds % 60
                    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
                  }
                  
                  return (
                    <motion.div
                      key="playing"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                    >
                      <motion.h2
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-2xl font-bold text-white mb-2"
                      >
                        Question Ready!
                      </motion.h2>
                    {/* Animated Timer Display */}
                    <AnimatePresence mode="wait">
                      {timeRemaining !== null && !answerSubmitted && (
                        <motion.div
                          key={timeRemaining}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className={`mt-2 mb-4 text-center relative ${
                            timeRemaining <= 10 
                              ? 'text-red-400' 
                              : timeRemaining <= 30 
                              ? 'text-yellow-400' 
                              : 'text-green-400'
                          }`}
                        >
                          <motion.div
                            animate={
                              timeRemaining <= 10
                                ? {
                                    scale: [1, 1.1, 1],
                                  }
                                : timeRemaining <= 30
                                ? {
                                    scale: [1, 1.05, 1],
                                  }
                                : {}
                            }
                            transition={{
                              duration: 1,
                              repeat: timeRemaining <= 10 ? Infinity : 0,
                              ease: 'easeInOut',
                            }}
                            className="text-5xl font-mono font-bold drop-shadow-[0_0_15px_currentColor] relative z-10"
                          >
                            {formatTime(timeRemaining)}
                          </motion.div>
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-sm text-slate-400 mt-1 relative z-10"
                          >
                            Time remaining
                          </motion.p>
                          {/* Progress ring */}
                          {timeRemaining <= 30 && (
                            <motion.div
                              className="absolute inset-0 rounded-full border-4 border-current opacity-20 -z-0"
                              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '120%', height: '120%' }}
                              animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.2, 0.4, 0.2],
                              }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: 'easeInOut',
                              }}
                            />
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <AnimatePresence>
                      {answerSubmitted && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="mt-2 mb-4 text-center"
                        >
                          <motion.div
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg"
                          >
                            <Check className="w-4 h-4 text-green-400" />
                            <p className="text-sm text-green-300 font-medium">Answer submitted</p>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="mt-4 p-6 bg-[rgba(30,30,40,0.6)] backdrop-blur-sm rounded-lg text-left border border-purple-500/20 shadow-[0_0_20px_rgba(139,92,246,0.1)]"
                    >
                      <h3 className="text-xl font-semibold mb-2">{question.title}</h3>
                      <p className="text-slate-300 mb-4">{question.stem || question.questionText}</p>

                      {/* UI Guard: Check for valid True/False structure */}
                      {!question.steps || question.steps.length === 0 || !firstStep ? (
                        <div className="text-red-500 p-4 border border-red-500 rounded">
                          <p>No True/False questions found. Add one in admin panel.</p>
                          <p className="text-sm">Question has no steps or step[0] is missing.</p>
                        </div>
                      ) : nonEmptyOptions.length !== 2 ? (
                        <div className="text-red-500 p-4 border border-red-500 rounded">
                          <p>No True/False questions found. Add one in admin panel.</p>
                          <p className="text-sm">Step[0] has {nonEmptyOptions.length} options (need exactly 2).</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {nonEmptyOptions.map((option: string, index: number) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              whileHover={!answerSubmitted ? { scale: 1.02, x: 5 } : {}}
                              whileTap={!answerSubmitted ? { scale: 0.98 } : {}}
                            >
                              <Button
                                className={`w-full justify-start relative overflow-hidden transition-all duration-300 ${
                                  answerSubmitted
                                    ? 'opacity-60 cursor-not-allowed'
                                    : 'hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:border-purple-400/50'
                                }`}
                                variant="outline"
                                disabled={answerSubmitted}
                                onClick={() => submitAnswer(index)}
                              >
                                <motion.span
                                  className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/20 to-purple-500/0"
                                  initial={{ x: '-100%' }}
                                  whileHover={!answerSubmitted ? { x: '100%' } : {}}
                                  transition={{ duration: 0.6 }}
                                />
                                <span className="relative z-10 font-semibold">
                                  {String.fromCharCode(65 + index)}. {option}
                                </span>
                              </Button>
                            </motion.div>
                          ))}
                          <AnimatePresence>
                            {answerSubmitted && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="mt-4 p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg text-center backdrop-blur-sm shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                              >
                                <motion.p
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="text-blue-300 font-medium"
                                >
                                  {waitingForOpponent 
                                    ? 'Waiting for opponent to answer...' 
                                    : 'Answer submitted! Waiting for opponent...'}
                                </motion.p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </motion.div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
              <AnimatePresence>
                {status === 'results' && results && !matchFinished && (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -50, scale: 0.9 }}
                    transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
                  >
                    <motion.h2
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                      className="text-2xl font-bold text-white mb-4"
                    >
                      Round Results
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-slate-400 mb-4"
                    >
                      Next round starting soon...
                    </motion.p>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-4 p-6 bg-[rgba(30,30,40,0.6)] backdrop-blur-sm rounded-lg space-y-4 border border-purple-500/20 shadow-[0_0_20px_rgba(139,92,246,0.1)]"
                    >
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg"
                      >
                        <span className="text-slate-300">Correct Answer:</span>
                        <span className="text-white font-semibold flex items-center gap-2">
                          {results.correct_answer === 0 ? 'A. True' : 'B. False'}
                          <Check className="w-4 h-4 text-green-400" />
                        </span>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                        className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg"
                      >
                        <span className="text-slate-300">Your Answer:</span>
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
                          className={`font-semibold flex items-center gap-2 ${
                            (playerRole === 'player1' && results.player1_correct) ||
                            (playerRole === 'player2' && results.player2_correct)
                              ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {(playerRole === 'player1' ? results.player1_answer : results.player2_answer) === 0 ? 'A. True' : 'B. False'}
                          {(playerRole === 'player1' && results.player1_correct) ||
                           (playerRole === 'player2' && results.player2_correct) ? (
                            <motion.div
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ delay: 0.7, type: "spring", stiffness: 200 }}
                            >
                              <Check className="w-5 h-5" />
                            </motion.div>
                          ) : (
                            <motion.div
                              initial={{ scale: 0, rotate: 180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ delay: 0.7, type: "spring", stiffness: 200 }}
                            >
                              <X className="w-5 h-5" />
                            </motion.div>
                          )}
                        </motion.span>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 }}
                        className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg"
                      >
                        <span className="text-slate-300">Opponent's Answer:</span>
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.7, type: "spring", stiffness: 200 }}
                          className={`font-semibold flex items-center gap-2 ${
                            (playerRole === 'player1' && results.player2_correct) ||
                            (playerRole === 'player2' && results.player1_correct)
                              ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {(playerRole === 'player1' ? results.player2_answer : results.player1_answer) === 0 ? 'A. True' : 'B. False'}
                          {(playerRole === 'player1' && results.player2_correct) ||
                           (playerRole === 'player2' && results.player1_correct) ? (
                            <motion.div
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
                            >
                              <Check className="w-5 h-5" />
                            </motion.div>
                          ) : (
                            <motion.div
                              initial={{ scale: 0, rotate: 180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
                            >
                              <X className="w-5 h-5" />
                            </motion.div>
                          )}
                        </motion.span>
                      </motion.div>
                      <AnimatePresence>
                        {results.round_winner && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ delay: 0.8, type: "spring", stiffness: 150 }}
                            className="mt-4 p-4 bg-purple-500/20 border border-purple-500/50 rounded-lg text-center backdrop-blur-sm shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                          >
                            <motion.p
                              animate={{ scale: [1, 1.05, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="text-purple-300 font-semibold text-lg flex items-center justify-center gap-2"
                            >
                              {results.round_winner === currentUser ? (
                                <>
                                  <Trophy className="w-5 h-5 text-yellow-400" />
                                  🎉 You won this round!
                                </>
                              ) : (
                                <>
                                  <Trophy className="w-5 h-5" />
                                  Opponent won this round
                                </>
                              )}
                            </motion.p>
                          </motion.div>
                        )}
                        {!results.round_winner && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ delay: 0.8 }}
                            className="mt-4 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-center backdrop-blur-sm shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                          >
                            <p className="text-yellow-300 font-semibold">Draw - Both players answered correctly</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Player Status */}
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center justify-between p-4 bg-[rgba(30,30,40,0.6)] backdrop-blur-sm rounded-lg border border-purple-500/20 shadow-[0_0_15px_rgba(139,92,246,0.1)]"
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={
                      status !== 'connecting'
                        ? {
                            scale: [1, 1.2, 1],
                            boxShadow: [
                              '0 0 0px rgba(16,185,129,0)',
                              '0 0 10px rgba(16,185,129,0.5)',
                              '0 0 0px rgba(16,185,129,0)',
                            ],
                          }
                        : {
                            scale: [1, 1.1, 1],
                            boxShadow: [
                              '0 0 0px rgba(234,179,8,0)',
                              '0 0 10px rgba(234,179,8,0.5)',
                              '0 0 0px rgba(234,179,8,0)',
                            ],
                          }
                    }
                    transition={{ duration: 2, repeat: Infinity }}
                    className={`w-3 h-3 rounded-full ${
                      status !== 'connecting' ? 'bg-green-400' : 'bg-yellow-400'
                    }`}
                  />
                  <span className="font-semibold">You ({playerRole || 'connecting...'})</span>
                </div>
                {status !== 'connecting' && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    <CheckCircle2 className="w-5 h-5 text-green-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  </motion.div>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center justify-between p-4 bg-[rgba(30,30,40,0.6)] backdrop-blur-sm rounded-lg border border-purple-500/20 shadow-[0_0_15px_rgba(139,92,246,0.1)]"
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={
                      status === 'both_connected' || status === 'playing' || status === 'results'
                        ? {
                            scale: [1, 1.2, 1],
                            boxShadow: [
                              '0 0 0px rgba(16,185,129,0)',
                              '0 0 10px rgba(16,185,129,0.5)',
                              '0 0 0px rgba(16,185,129,0)',
                            ],
                          }
                        : {}
                    }
                    transition={{ duration: 2, repeat: Infinity }}
                    className={`w-3 h-3 rounded-full ${
                      status === 'both_connected' || status === 'playing' || status === 'results' ? 'bg-green-400' : 'bg-gray-400'
                    }`}
                  />
                  <span className="font-semibold">Opponent</span>
                </div>
                {status === 'both_connected' || status === 'playing' || status === 'results' || status === 'match_finished' ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    <CheckCircle2 className="w-5 h-5 text-green-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  </motion.div>
                ) : (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="w-5 h-5 text-gray-400" />
                  </motion.div>
                )}
              </motion.div>
            </div>

            {/* Match Info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="pt-4 border-t border-purple-500/20"
            >
              <div className="text-sm text-slate-400 space-y-1">
                <p>Match ID: <span className="text-white font-mono">{match.id}</span></p>
                <p>Your Role: <span className="text-white">{playerRole || 'connecting...'}</span></p>
                <p>Status: <span className="text-white capitalize">{status.replace('_', ' ')}</span></p>
              </div>
            </motion.div>
          </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

