import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Check, X, Trophy, Clock, Zap } from 'lucide-react';
import { useGame } from '@/hooks/useGame';
import type { MatchRow } from '@/types/schema';
import { motion, AnimatePresence } from 'framer-motion';
import { Starfield } from '@/components/Starfield';
import { MathText } from '@/components/math/MathText';
import { BattleSplitShell } from '@/components/battle/BattleSplitShell';
import { AnswerOptionButton } from '@/components/battle/AnswerOptionButton';

export default function BattleConnected() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [showRoundIntro, setShowRoundIntro] = useState(false);
  const [shouldAnimateMyWins, setShouldAnimateMyWins] = useState<boolean>(false);
  const [shouldAnimateOppWins, setShouldAnimateOppWins] = useState<boolean>(false);
  const prevMyWinsRef = useRef<number>(0);
  const prevOppWinsRef = useRef<number>(0);
  const handledStartFailureRef = useRef<boolean>(false);

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
    matchFinished, matchWinner, timeRemaining, submitAnswer,
    phase, currentStepIndex, totalSteps, mainQuestionEndsAt, stepEndsAt,
    mainQuestionTimeLeft, stepTimeLeft, subStepTimeLeft, currentStep, currentSegment, currentSubStepIndex,
    submitEarlyAnswer, submitStepAnswer,
    currentRoundNumber, targetRoundsToWin, playerRoundWins, matchOver, matchWinnerId,
    isWebSocketConnected, waitingForOpponent, resultsAcknowledged, waitingForOpponentToAcknowledge,
    allStepsComplete, waitingForOpponentToCompleteSteps, readyForNextRound
  } = useGame(match);

  // If the server couldn't start the round (often a cross-instance race), don't show the scary
  // "CONNECTION LOST" modal — just return to lobby with a toast.
  useEffect(() => {
    if (status !== 'error') return;
    if (errorMessage !== 'Failed to select question') return;
    if (handledStartFailureRef.current) return;
    handledStartFailureRef.current = true;
    toast.error('Match failed to start — please try again');
    navigate('/matchmaking-new', { replace: true });
  }, [status, errorMessage, navigate]);

  // Track round wins for animation
  useEffect(() => {
    const isPlayer1 = match?.player1_id === currentUser;
    const opponentId = isPlayer1 ? match?.player2_id : match?.player1_id;
    const myWins = playerRoundWins?.[currentUser || ''] || 0;
    const oppWins = playerRoundWins?.[opponentId || ''] || 0;
    
    // Check if my wins increased
    if (myWins > prevMyWinsRef.current) {
      setShouldAnimateMyWins(true);
      setTimeout(() => setShouldAnimateMyWins(false), 600);
    }
    prevMyWinsRef.current = myWins;
    
    // Check if opponent wins increased
    if (oppWins > prevOppWinsRef.current) {
      setShouldAnimateOppWins(true);
      setTimeout(() => setShouldAnimateOppWins(false), 600);
    }
    prevOppWinsRef.current = oppWins;
  }, [playerRoundWins, currentUser, match]);

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

  // --- Rendering Helpers ---

  const isPlayer1 = match?.player1_id === currentUser;
  const opponentId = isPlayer1 ? match?.player2_id : match?.player1_id;

  if (!match || !currentUser) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center relative overflow-hidden">
        <Starfield />
        <div className="flex flex-col items-center gap-4 relative z-10">
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
    if (errorMessage === 'Failed to select question') {
      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center relative overflow-hidden">
          <Starfield />
          <div className="flex flex-col items-center gap-4 relative z-10">
            <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
            <p className="text-blue-200/60 font-mono tracking-widest text-xs">
              RETURNING TO LOBBY…
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
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

  const myWins = playerRoundWins?.[currentUser] || 0;
  const oppWins = playerRoundWins?.[opponentId || ''] || 0;
  const subjectLabel = String(match.subject || '').toUpperCase();

  const stepMeta =
    phase === 'steps' && totalSteps > 0
      ? ` • STEP ${currentStepIndex + 1}/${totalSteps}${
          currentSegment === 'sub' ? ` • SUB ${currentSubStepIndex + 1}` : ''
        }`
      : '';

  const roundMeta = `ROUND ${currentRoundNumber || roundNumber || 0}${stepMeta}`;

  const timerIsLow =
    (phase === 'main_question' && (mainQuestionTimeLeft ?? 60) <= 10) ||
    (phase === 'steps' && (stepTimeLeft ?? 15) <= (currentSegment === 'sub' ? 2 : 5)) ||
    (phase === 'question' && (timeRemaining ?? 60) <= 10);

  const timerText =
    phase === 'main_question' && mainQuestionTimeLeft !== null
      ? `${Math.floor(mainQuestionTimeLeft / 60)}:${String(mainQuestionTimeLeft % 60).padStart(2, '0')}`
      : phase === 'steps' && stepTimeLeft !== null
        ? `${stepTimeLeft}s`
        : `${Math.floor((timeRemaining ?? 0) / 60)}:${String((timeRemaining ?? 0) % 60).padStart(2, '0')}`;

  return (
    <BattleSplitShell
      className="font-sans selection:bg-blue-500/30"
      top={
        <>
          {/* Round Intro Overlay */}
          <AnimatePresence>
            {showRoundIntro && (
              <motion.div
                initial={{ opacity: 0, scale: 1.2 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, filter: 'blur(20px)' }}
                transition={{ duration: 0.5 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none"
              >
                <div className="text-center">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-blue-500 font-mono tracking-[0.5em] text-sm mb-4 uppercase"
                  >
                    Subject: {match.subject}
                  </motion.div>
                  <h1 className="text-7xl md:text-9xl font-black text-white tracking-tighter italic">
                    ROUND {roundNumber}
                  </h1>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="h-2 w-32 bg-blue-500 mx-auto mt-6 rounded-full"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="h-full flex flex-col gap-5">
            {/* Top Bar */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => navigate('/matchmaking-new')}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors backdrop-blur-md border border-white/10"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-xs font-bold tracking-widest">EXIT</span>
              </button>

              <div className="flex items-center gap-2">
                <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full backdrop-blur-md">
                  <span className="text-[10px] font-mono text-white/70 uppercase tracking-widest">
                    {subjectLabel}
                  </span>
                </div>

                <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full backdrop-blur-md">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      status.includes('connected') || status === 'playing'
                        ? 'bg-green-500 animate-pulse'
                        : 'bg-yellow-500'
                    }`}
                  />
                  <span className="text-xs font-mono text-blue-200 uppercase tracking-wider">
                    {status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Score + Timer (more “MCQ app” style, still duel-aware) */}
            <div className="grid grid-cols-3 gap-4 items-end">
              <div className="flex flex-col items-start">
                <motion.div
                  key={`my-wins-${myWins}`}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{
                    scale: shouldAnimateMyWins ? [1, 1.25, 1] : 1,
                    opacity: 1,
                  }}
                  transition={{
                    duration: 0.6,
                    ease: 'easeOut',
                    scale: shouldAnimateMyWins ? { times: [0, 0.3, 1], duration: 0.6 } : { duration: 0.3 },
                  }}
                  className="text-5xl md:text-6xl font-black text-blue-300 drop-shadow-[0_0_18px_rgba(96,165,250,0.45)]"
                >
                  {myWins}
                </motion.div>
                <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.3em] text-blue-200/60">
                  YOU
                </div>
              </div>

              <div className="flex flex-col items-center pb-1">
                <div className="text-[10px] text-white/35 font-mono uppercase tracking-[0.28em] text-center">
                  {roundMeta}
                </div>
                <div
                  className={`mt-1 text-4xl md:text-5xl font-black font-mono tracking-tighter tabular-nums transition-colors duration-300 ${
                    timerIsLow
                      ? 'text-red-400 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                      : 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.18)]'
                  }`}
                >
                  {timerText}
                </div>
              </div>

              <div className="flex flex-col items-end">
                <motion.div
                  key={`opp-wins-${oppWins}`}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{
                    scale: shouldAnimateOppWins ? [1, 1.25, 1] : 1,
                    opacity: 1,
                  }}
                  transition={{
                    duration: 0.6,
                    ease: 'easeOut',
                    scale: shouldAnimateOppWins ? { times: [0, 0.3, 1], duration: 0.6 } : { duration: 0.3 },
                  }}
                  className="text-5xl md:text-6xl font-black text-red-300 drop-shadow-[0_0_18px_rgba(248,113,113,0.45)]"
                >
                  {oppWins}
                </motion.div>
                <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.3em] text-red-200/60">
                  OPP
                </div>
              </div>
            </div>

            {/* TOP CONTENT: question / prompt / results */}
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {/* CONNECTING STATE */}
                {(status === 'connecting' || status === 'connected' || status === 'both_connected') && (
                  <motion.div
                    key="connecting-top"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
                    className="text-center w-full"
                  >
                    <div className="relative w-28 h-28 mx-auto mb-6">
                      <div className="absolute inset-0 border-2 border-blue-500/20 rounded-full" />
                      <div className="absolute inset-0 border-2 border-t-blue-500 rounded-full animate-spin" />
                      {status === 'both_connected' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="w-10 h-10 text-blue-500" />
                        </div>
                      )}
                    </div>
                    <h2 className="text-3xl font-bold mb-2 tracking-tight">
                      {status === 'both_connected' ? 'OPPONENT LOCKED' : 'SEARCHING FOR TARGET'}
                    </h2>
                    <p className="text-white/40 font-mono text-sm">
                      {status === 'both_connected' ? 'INITIATING COMBAT SEQUENCE...' : 'SCANNING FREQUENCIES...'}
                    </p>
                  </motion.div>
                )}

                {/* MAIN QUESTION PHASE (Multi-step) */}
                {status === 'playing' && question && phase === 'main_question' && !showRoundIntro && (
                  <motion.div
                    key="main-question-top"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    className="w-full max-w-3xl"
                  >
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
                      <div className="text-center">
                        <div className="text-xs text-blue-300/70 font-mono mb-3 uppercase tracking-[0.28em]">
                          Main Question
                        </div>
                        <h3 className="text-2xl md:text-3xl font-bold leading-relaxed relative z-10">
                          <MathText text={question.stem || question.questionText || question.title} />
                        </h3>
                        <div className="mt-5 text-sm text-white/40">
                          {totalSteps} step{totalSteps !== 1 ? 's' : ''} will follow
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEPS PHASE (Multi-step) - prompt only */}
                {status === 'playing' &&
                  question &&
                  phase === 'steps' &&
                  currentStep &&
                  !showRoundIntro &&
                  !(allStepsComplete && waitingForOpponentToCompleteSteps) && (
                    <motion.div
                      key="steps-top"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -16 }}
                      className="w-full max-w-3xl"
                    >
                      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50" />

                        <div className="text-center">
                          <div className="text-xs text-amber-300/70 font-mono mb-3 uppercase tracking-[0.28em]">
                            {currentSegment === 'sub'
                              ? `Step ${currentStepIndex + 1} of ${totalSteps} • Sub-step ${currentSubStepIndex + 1}`
                              : `Step ${currentStepIndex + 1} of ${totalSteps}`}
                          </div>
                          <h3 className="text-xl md:text-2xl font-bold leading-relaxed relative z-10">
                            <MathText text={currentStep.prompt || currentStep.question} />
                          </h3>
                          {currentSegment === 'sub' && (
                            <p className="text-xs text-white/50 mt-3 font-mono">
                              QUICK CHECK — must be correct to earn this step&apos;s marks
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                {/* WAITING FOR OPPONENT TO COMPLETE ALL STEPS */}
                {status === 'playing' && phase === 'steps' && allStepsComplete && waitingForOpponentToCompleteSteps && (
                  <motion.div
                    key="waiting-steps-top"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className="w-full max-w-2xl bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-12 text-center shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                  >
                    <div className="mb-2">
                      <Loader2 className="w-14 h-14 animate-spin text-blue-400 mx-auto mb-4" />
                      <h2 className="text-3xl font-bold mb-2 tracking-tight">ALL PARTS COMPLETE</h2>
                      <p className="text-white/60 font-mono text-sm mb-4">
                        You have finished all {totalSteps} part{totalSteps !== 1 ? 's' : ''}
                      </p>
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-full text-sm font-medium border border-blue-500/20 backdrop-blur-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        WAITING FOR OPPONENT TO FINISH ALL PARTS...
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* PLAYING STATE (Single-step) - question only */}
                {status === 'playing' && question && phase === 'question' && !showRoundIntro && (
                  <motion.div
                    key="question-top"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    className="w-full max-w-3xl"
                  >
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
                      <h3 className="text-2xl md:text-3xl font-bold leading-relaxed text-center relative z-10">
                        <MathText text={question.stem || question.questionText} />
                      </h3>
                    </div>
                  </motion.div>
                )}

                {/* RESULTS STATE (content only; actions moved to bottom) */}
                {status === 'results' && results && (
                  <motion.div
                    key="results-top"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
                    className="w-full max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 text-center shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                  >
                    <div className="mb-8">
                      {results.round_winner === currentUser ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring' }}
                          className="inline-block p-4 rounded-full bg-yellow-500/20 mb-4 ring-4 ring-yellow-500/10"
                        >
                          <Trophy className="w-12 h-12 text-yellow-500" />
                        </motion.div>
                      ) : results.round_winner === null ? (
                        <div className="inline-block p-4 rounded-full bg-white/10 mb-4 ring-4 ring-white/5">
                          <Clock className="w-12 h-12 text-white/60" />
                        </div>
                      ) : (
                        <div className="inline-block p-4 rounded-full bg-red-500/20 mb-4 ring-4 ring-red-500/10">
                          <X className="w-12 h-12 text-red-500" />
                        </div>
                      )}

                      {matchOver && matchWinnerId ? (
                        <>
                          <h2 className="text-4xl font-bold mb-2 tracking-tight">
                            {matchWinnerId === currentUser ? 'MATCH WON' : 'MATCH LOST'}
                          </h2>
                          <div className="text-lg font-bold mb-2">
                            Final Score: {isPlayer1 ? myWins : oppWins} - {isPlayer1 ? oppWins : myWins}
                          </div>
                          <p className="text-white/40 font-mono text-sm">
                            {matchWinnerId === currentUser ? 'VICTORY ACHIEVED!' : 'BETTER LUCK NEXT TIME.'}
                          </p>
                        </>
                      ) : (
                        <>
                          <h2 className="text-4xl font-bold mb-2 tracking-tight">
                            {results.round_winner === currentUser
                              ? 'ROUND SECURED'
                              : results.round_winner === null
                                ? 'STALEMATE'
                                : 'ROUND LOST'}
                          </h2>
                          <div className="text-sm text-white/60 font-mono mb-2">
                            Round {currentRoundNumber || 1} of {targetRoundsToWin || 4} needed
                          </div>
                          {results.p1Score !== undefined && results.p2Score !== undefined && (
                            <div className="text-lg font-bold mb-2">
                              Round Score: {isPlayer1 ? results.p1Score : results.p2Score} -{' '}
                              {isPlayer1 ? results.p2Score : results.p1Score}
                            </div>
                          )}
                          <div className="text-sm font-bold mb-2">
                            Match Score: {isPlayer1 ? myWins : oppWins} - {isPlayer1 ? oppWins : myWins}
                          </div>
                          <p className="text-white/40 font-mono text-sm">
                            {results.round_winner === currentUser ? 'EXCELLENT WORK, OPERATOR.' : 'ADJUST STRATEGY.'}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Step-by-step results with "X out of 4" format */}
                    {results.stepResults && results.stepResults.length > 0 && (
                      <div className="mb-2">
                        {/* Calculate parts correct for each player */}
                        {(() => {
                          const myPartsCorrect = results.stepResults.filter((stepResult) => {
                            const myAnswer = isPlayer1 ? stepResult.p1AnswerIndex : stepResult.p2AnswerIndex;
                            return myAnswer === stepResult.correctAnswer;
                          }).length;

                          const oppPartsCorrect = results.stepResults.filter((stepResult) => {
                            const oppAnswer = isPlayer1 ? stepResult.p2AnswerIndex : stepResult.p1AnswerIndex;
                            return oppAnswer === stepResult.correctAnswer;
                          }).length;

                          const total = results.stepResults.length;
                          const iWon = myPartsCorrect > oppPartsCorrect;
                          const isTie = myPartsCorrect === oppPartsCorrect;

                          return (
                            <>
                              <div className="grid grid-cols-2 gap-6 mb-6">
                                <motion.div
                                  initial={{ x: -20, opacity: 0 }}
                                  animate={{ x: 0, opacity: 1 }}
                                  transition={{ delay: 0.1 }}
                                  className={`p-6 rounded-2xl border-2 ${
                                    iWon
                                      ? 'bg-green-500/20 border-green-500/40'
                                      : isTie
                                        ? 'bg-blue-500/20 border-blue-500/40'
                                        : 'bg-red-500/20 border-red-500/40'
                                  }`}
                                >
                                  <div className="text-xs font-mono text-white/60 mb-2 uppercase tracking-wider">YOU</div>
                                  <div
                                    className={`text-5xl md:text-6xl font-black mb-2 ${
                                      iWon ? 'text-green-400' : isTie ? 'text-blue-400' : 'text-red-400'
                                    }`}
                                  >
                                    {myPartsCorrect} out of {total}
                                  </div>
                                  <div className="text-sm text-white/60 font-mono">
                                    {myPartsCorrect === total ? 'Perfect!' : `${total - myPartsCorrect} incorrect`}
                                  </div>
                                </motion.div>

                                <motion.div
                                  initial={{ x: 20, opacity: 0 }}
                                  animate={{ x: 0, opacity: 1 }}
                                  transition={{ delay: 0.2 }}
                                  className={`p-6 rounded-2xl border-2 ${
                                    !iWon && !isTie
                                      ? 'bg-green-500/20 border-green-500/40'
                                      : isTie
                                        ? 'bg-blue-500/20 border-blue-500/40'
                                        : 'bg-red-500/20 border-red-500/40'
                                  }`}
                                >
                                  <div className="text-xs font-mono text-white/60 mb-2 uppercase tracking-wider">OPPONENT</div>
                                  <div
                                    className={`text-5xl md:text-6xl font-black mb-2 ${
                                      !iWon && !isTie ? 'text-green-400' : isTie ? 'text-blue-400' : 'text-red-400'
                                    }`}
                                  >
                                    {oppPartsCorrect} out of {total}
                                  </div>
                                  <div className="text-sm text-white/60 font-mono">
                                    {oppPartsCorrect === total ? 'Perfect!' : `${total - oppPartsCorrect} incorrect`}
                                  </div>
                                </motion.div>
                              </div>

                              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent mb-6" />

                              <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-center mb-6"
                              >
                                {isTie ? (
                                  <div className="text-2xl font-bold text-blue-400">STALEMATE</div>
                                ) : iWon ? (
                                  <div className="text-2xl font-bold text-green-400">YOU WON THIS ROUND</div>
                                ) : (
                                  <div className="text-2xl font-bold text-red-400">OPPONENT WON THIS ROUND</div>
                                )}
                              </motion.div>

                              <details className="mt-4">
                                <summary className="text-sm font-mono text-white/60 mb-3 uppercase tracking-wider cursor-pointer hover:text-white/80 transition-colors">
                                  Step Breakdown
                                </summary>
                                <div className="space-y-2 mt-3">
                                  {results.stepResults.map((stepResult, idx) => {
                                    const myAnswer = isPlayer1
                                      ? stepResult.p1AnswerIndex
                                      : stepResult.p2AnswerIndex;
                                    const myMarks = isPlayer1 ? stepResult.p1Marks : stepResult.p2Marks;
                                    const myCorrect = myAnswer === stepResult.correctAnswer;
                                    return (
                                      <div
                                        key={idx}
                                        className={`p-2 rounded-lg border text-left text-xs ${
                                          myCorrect
                                            ? 'bg-green-500/10 border-green-500/20'
                                            : 'bg-red-500/10 border-red-500/20'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold">Step {stepResult.stepIndex + 1}</span>
                                          <span className="font-mono">
                                            {myCorrect ? '✓' : '✗'} {myMarks} pts
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </details>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* Single-step results */}
                    {(!results.stepResults || results.stepResults.length === 0) &&
                      results.player1_answer !== undefined &&
                      results.player2_answer !== undefined && (
                        <div className="grid grid-cols-2 gap-4 mb-2">
                          <motion.div
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className={`p-4 rounded-2xl border ${
                              (playerRole === 'player1' && results.player1_correct) ||
                              (playerRole === 'player2' && results.player2_correct)
                                ? 'bg-green-500/10 border-green-500/20'
                                : 'bg-red-500/10 border-red-500/20'
                            }`}
                          >
                            <div className="text-xs font-mono opacity-50 mb-1">YOU CHOSE</div>
                            <div className="text-xl font-bold flex items-center justify-center gap-2">
                              {(() => {
                                const myAnswer = playerRole === 'player1' ? results.player1_answer : results.player2_answer;
                                const myCorrect =
                                  (playerRole === 'player1' && results.player1_correct) ||
                                  (playerRole === 'player2' && results.player2_correct);
                                const answerDisplay =
                                  myAnswer !== null && myAnswer !== undefined
                                    ? myAnswer === 0
                                      ? 'A'
                                      : myAnswer === 1
                                        ? 'B'
                                        : myAnswer === 2
                                          ? 'C'
                                          : myAnswer === 3
                                            ? 'D'
                                            : String(myAnswer)
                                    : 'N/A';
                                return (
                                  <>
                                    {answerDisplay}
                                    {myCorrect ? (
                                      <Check className="w-5 h-5 text-green-500" />
                                    ) : (
                                      <X className="w-5 h-5 text-red-500" />
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </motion.div>

                          <motion.div
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className={`p-4 rounded-2xl border ${
                              (playerRole === 'player1' && results.player2_correct) ||
                              (playerRole === 'player2' && results.player1_correct)
                                ? 'bg-green-500/10 border-green-500/20'
                                : 'bg-red-500/10 border-red-500/20'
                            }`}
                          >
                            <div className="text-xs font-mono opacity-50 mb-1">OPPONENT CHOSE</div>
                            <div className="text-xl font-bold flex items-center justify-center gap-2">
                              {(() => {
                                const oppAnswer = playerRole === 'player1' ? results.player2_answer : results.player1_answer;
                                const oppCorrect =
                                  (playerRole === 'player1' && results.player2_correct) ||
                                  (playerRole === 'player2' && results.player1_correct);
                                const answerDisplay =
                                  oppAnswer !== null && oppAnswer !== undefined
                                    ? oppAnswer === 0
                                      ? 'A'
                                      : oppAnswer === 1
                                        ? 'B'
                                        : oppAnswer === 2
                                          ? 'C'
                                          : oppAnswer === 3
                                            ? 'D'
                                            : String(oppAnswer)
                                    : 'N/A';
                                return (
                                  <>
                                    {answerDisplay}
                                    {oppCorrect ? (
                                      <Check className="w-5 h-5 text-green-500" />
                                    ) : (
                                      <X className="w-5 h-5 text-red-500" />
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </motion.div>
                        </div>
                      )}

                    {/* Fallback: Show basic results if structure is different */}
                    {(!results.stepResults || results.stepResults.length === 0) &&
                      (results.player1_answer === undefined || results.player2_answer === undefined) && (
                        <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                          <div className="text-sm font-mono text-yellow-400 mb-2">⚠️ Results data structure mismatch</div>
                          <div className="text-xs text-white/60 font-mono">
                            player1_answer: {results.player1_answer ?? 'null'} | player2_answer:{' '}
                            {results.player2_answer ?? 'null'} | round_winner: {results.round_winner ?? 'null'}
                          </div>
                        </div>
                      )}
                  </motion.div>
                )}

                {/* MATCH FINISHED (content only; action moved to bottom) */}
                {status === 'match_finished' && (
                  <motion.div
                    key="finished-top"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center w-full"
                  >
                    <div className="mb-6">
                      <Trophy
                        className={`w-24 h-24 mx-auto mb-6 ${
                          matchWinner === currentUser
                            ? 'text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]'
                            : 'text-gray-500'
                        }`}
                      />
                      <h1 className="text-5xl md:text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                        {matchWinner === currentUser ? 'VICTORY' : matchWinner === opponentId ? 'DEFEAT' : 'DRAW'}
                      </h1>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </>
      }
      bottom={
        <div className="h-full flex flex-col">
          <AnimatePresence mode="wait">
            {/* MAIN QUESTION: action in bottom */}
            {status === 'playing' && question && phase === 'main_question' && !showRoundIntro && (
              <motion.div
                key="main-question-bottom"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="w-full max-w-3xl mx-auto"
              >
                <button
                  onClick={() => {
                    if (!isWebSocketConnected) {
                      toast.error('Connection lost. Please wait for reconnection...');
                      return;
                    }
                    submitEarlyAnswer();
                  }}
                  disabled={!isWebSocketConnected}
                  className={`w-full py-5 px-6 rounded-2xl font-bold text-lg md:text-xl transition-all shadow-lg inline-flex items-center justify-center gap-3 border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] ${
                    isWebSocketConnected
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 active:scale-[0.99] shadow-[0_0_40px_rgba(59,130,246,0.18)] cursor-pointer'
                      : 'bg-gray-600/50 cursor-not-allowed opacity-50'
                  }`}
                >
                  <Zap className="w-5 h-5" />
                  {isWebSocketConnected ? 'Submit Answer Early' : 'Connecting...'}
                </button>
                <p className="mt-3 text-xs text-white/45 font-mono text-center uppercase tracking-wider">
                  Optional — skip ahead if you already know the full solution
                </p>
              </motion.div>
            )}

            {/* STEPS PHASE: options in bottom */}
            {status === 'playing' &&
              question &&
              phase === 'steps' &&
              currentStep &&
              !showRoundIntro &&
              !(allStepsComplete && waitingForOpponentToCompleteSteps) && (
                <motion.div
                  key="steps-bottom"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="w-full max-w-3xl mx-auto"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-[10px] text-white/40 font-mono uppercase tracking-[0.28em]">
                      Choose an answer
                    </div>

                    {answerSubmitted && (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-300 rounded-full text-xs font-bold border border-amber-500/20 backdrop-blur-sm">
                        <Check className="w-4 h-4" />
                        ANSWER SUBMITTED
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentStep.options
                      ?.filter((o: string) => String(o).trim())
                      .map((option: string, idx: number) => (
                        <AnswerOptionButton
                          key={idx}
                          index={idx}
                          text={option}
                          accent="amber"
                          onClick={() => submitStepAnswer(currentStepIndex, idx)}
                          disabled={answerSubmitted || (stepTimeLeft !== null && stepTimeLeft <= 0)}
                        />
                      ))}
                  </div>
                </motion.div>
              )}

            {/* PLAYING STATE (Single-step): options in bottom */}
            {status === 'playing' && question && phase === 'question' && !showRoundIntro && (
              <motion.div
                key="question-bottom"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="w-full max-w-3xl mx-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[10px] text-white/40 font-mono uppercase tracking-[0.28em]">
                    Choose an answer
                  </div>

                  {answerSubmitted && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-300 rounded-full text-xs font-bold border border-blue-500/20 backdrop-blur-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      LOCKED IN
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {question.steps?.[0]?.options
                    ?.filter((o) => String(o).trim())
                    .map((option, idx) => (
                      <AnswerOptionButton
                        key={idx}
                        index={idx}
                        text={option}
                        accent="blue"
                        onClick={() => submitAnswer(idx)}
                        disabled={answerSubmitted}
                      />
                    ))}
                </div>

                {answerSubmitted && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 text-center"
                  >
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-full text-sm font-medium border border-blue-500/20 backdrop-blur-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      AWAITING RESULT CONFIRMATION
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* RESULTS: actions in bottom */}
            {status === 'results' && results && (
              <motion.div
                key="results-bottom"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="w-full max-w-2xl mx-auto"
              >
                {!matchOver && (
                  <div>
                    {!resultsAcknowledged ? (
                      <button
                        onClick={readyForNextRound}
                        disabled={!isWebSocketConnected}
                        className={`w-full py-4 px-8 rounded-2xl font-bold text-lg transition-all shadow-lg border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] ${
                          isWebSocketConnected
                            ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 active:scale-[0.99] shadow-[0_0_40px_rgba(59,130,246,0.18)] cursor-pointer'
                            : 'bg-gray-600/50 cursor-not-allowed opacity-50'
                        }`}
                      >
                        {isWebSocketConnected ? 'NEXT ROUND' : 'CONNECTING...'}
                      </button>
                    ) : waitingForOpponentToAcknowledge ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                        <div className="text-sm font-mono text-white/60">
                          WAITING FOR OPPONENT TO FINISH VIEWING RESULTS...
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm font-mono text-white/60 text-center">
                        BOTH PLAYERS READY - STARTING NEXT ROUND...
                      </div>
                    )}
                  </div>
                )}

                {matchOver && (
                  <div>
                    <button
                      onClick={() => navigate('/matchmaking-new')}
                      className="w-full py-4 px-8 rounded-2xl font-bold text-lg bg-white text-black hover:scale-[1.01] transition-transform hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
                    >
                      RETURN TO LOBBY
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* MATCH FINISHED: action in bottom */}
            {status === 'match_finished' && (
              <motion.div
                key="finished-bottom"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl mx-auto"
              >
                <button
                  onClick={() => navigate('/matchmaking-new')}
                  className="w-full py-4 px-8 rounded-2xl font-bold text-lg bg-white text-black hover:scale-[1.01] transition-transform hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
                >
                  RETURN TO BASE
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
    />
  );
}