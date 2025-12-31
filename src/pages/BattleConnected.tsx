import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Check, X, Trophy, Clock, Zap } from 'lucide-react';
import { useGame } from '@/hooks/useGame';
import type { MatchRow } from '@/types/schema';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { MathText } from '@/components/math/MathText';
import { AnswerOptionButton } from '@/components/battle/AnswerOptionButton';
import { BattleTimerBar } from '@/components/battle/BattleTimerBar';
import { BattleHudShell } from '@/components/battle/BattleHudShell';
import { battleTransition, panelEnterVariants, stampPopVariants } from '@/components/battle/battleMotion';

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
      <BattleHudShell className="font-sans selection:bg-[#FFD400]/35 selection:text-black">
        <div className="flex-1 flex items-center justify-center">
          <div className="relative overflow-hidden rounded-[26px] bg-[#F7F2E7] text-[#141318] ring-2 ring-black/80 shadow-[12px_12px_0_rgba(0,0,0,0.55)] px-8 py-7 text-center">
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.14]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.14) 1px, rgba(0,0,0,0) 1.2px)',
                backgroundSize: '18px 18px',
              }}
            />
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/80 via-transparent to-transparent opacity-80" />

          <div className="relative">
              <div className="text-[10px] font-mono uppercase tracking-[0.35em] text-black/60">
                Initializing battleground
            </div>
              <div className="mt-2 text-3xl md:text-4xl font-black tracking-tight">
                LOADING
          </div>
              <div className="mt-5 flex items-center justify-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-black/80 animate-bounce [animation-delay:-0.2s]" />
                <span className="h-2.5 w-2.5 rounded-full bg-black/80 animate-bounce [animation-delay:-0.1s]" />
                <span className="h-2.5 w-2.5 rounded-full bg-black/80 animate-bounce" />
        </div>
      </div>
          </div>
        </div>
      </BattleHudShell>
    );
  }

  if (status === 'error') {
    if (errorMessage === 'Failed to select question') {
      return (
        <BattleHudShell className="font-sans selection:bg-[#FFD400]/35 selection:text-black">
          <div className="flex-1 flex items-center justify-center">
            <div className="relative overflow-hidden rounded-[26px] bg-[#F7F2E7] text-[#141318] ring-2 ring-black/80 shadow-[12px_12px_0_rgba(0,0,0,0.55)] px-8 py-7 text-center">
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.14]"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.14) 1px, rgba(0,0,0,0) 1.2px)',
                  backgroundSize: '18px 18px',
                }}
              />
              <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/80 via-transparent to-transparent opacity-80" />

              <div className="relative flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-black/70" />
                <p className="text-black/60 font-mono tracking-widest text-xs">
              RETURNING TO LOBBY…
            </p>
          </div>
        </div>
          </div>
        </BattleHudShell>
      );
    }
    return (
      <BattleHudShell className="font-sans selection:bg-[#FFD400]/35 selection:text-black">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="relative overflow-hidden rounded-[26px] bg-[#F7F2E7] text-[#141318] ring-2 ring-black/80 shadow-[12px_12px_0_rgba(0,0,0,0.55)] p-8 text-center w-full max-w-md">
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.14]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.14) 1px, rgba(0,0,0,0) 1.2px)',
                backgroundSize: '18px 18px',
              }}
            />
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/80 via-transparent to-transparent opacity-80" />

            <div className="relative">
              <div className="mx-auto inline-flex items-center justify-center rounded-full bg-[#FF3EA5]/20 text-[#141318] ring-4 ring-black/90 shadow-[10px_10px_0_rgba(0,0,0,0.55)] px-5 py-3 mb-6 rotate-[-6deg]">
                <X className="w-7 h-7" />
                <span className="ml-2 font-black tracking-tight">DISCONNECTED</span>
          </div>
              <h2 className="text-2xl font-black tracking-tight mb-2">CONNECTION LOST</h2>
              <p className="text-black/60 mb-8 text-sm">{errorMessage || 'Connection dropped.'}</p>
          <button 
            onClick={() => navigate('/matchmaking-new')}
                className="w-full py-3 bg-[#141318] hover:bg-black text-[#F7F2E7] rounded-2xl font-black tracking-widest ring-2 ring-black/90 shadow-[6px_6px_0_rgba(0,0,0,0.55)] transition-colors"
          >
            RETURN TO LOBBY
          </button>
        </div>
      </div>
        </div>
      </BattleHudShell>
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

  const timerBarSecondsLeft =
    phase === 'main_question'
      ? mainQuestionTimeLeft
      : phase === 'steps'
        ? (currentSegment === 'sub' ? (subStepTimeLeft ?? stepTimeLeft) : stepTimeLeft)
        : phase === 'question'
          ? timeRemaining
          : null;

  const timerBarTotalSeconds =
    phase === 'steps' ? 15 : phase === 'main_question' ? 60 : phase === 'question' ? 60 : 0;

  const reduceMotion = useReducedMotion();
  const panelV = panelEnterVariants(reduceMotion);
  const panelT = battleTransition(reduceMotion, { duration: 0.22 });

  return (
    <BattleHudShell className="font-sans selection:bg-[#FFD400]/35 selection:text-black">
          {/* Round Intro Overlay */}
          <AnimatePresence>
            {showRoundIntro && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={battleTransition(reduceMotion, { duration: 0.18 })}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm pointer-events-none"
              >
                <motion.div
                  variants={stampPopVariants(reduceMotion)}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={battleTransition(reduceMotion, { duration: 0.22 })}
                  className="relative overflow-hidden rounded-[28px] bg-[#F7F2E7] text-[#141318] ring-4 ring-black/90 shadow-[14px_14px_0_rgba(0,0,0,0.65)] px-10 py-8 text-center rotate-[-2deg]"
                >
                  <div
                    aria-hidden
                    className="absolute inset-0 opacity-[0.14]"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.14) 1px, rgba(0,0,0,0) 1.2px)',
                      backgroundSize: '18px 18px',
                    }}
                  />
                  <div aria-hidden className="absolute top-0 left-0 h-2 w-full bg-[#FFD400]" />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/80 via-transparent to-transparent opacity-80"
                  />

                  <div className="relative">
                    <div className="text-[10px] font-mono uppercase tracking-[0.5em] text-black/60">
                      Subject: {match.subject}
                    </div>
                    <h1 className="mt-3 text-6xl md:text-8xl font-comic tracking-[0.08em]">
                      ROUND {roundNumber}
                    </h1>
                    <div className="mt-5 mx-auto h-2 w-32 bg-[#00D4FF] rounded-full ring-2 ring-black/80 shadow-[4px_4px_0_rgba(0,0,0,0.45)]" />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

      <header className="flex flex-col gap-5">
            {/* Top Bar */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => navigate('/matchmaking-new')}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#F7F2E7] text-[#141318] ring-2 ring-black/80 shadow-[6px_6px_0_rgba(0,0,0,0.55)] hover:bg-[#FBF7EE] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-xs font-bold tracking-widest">EXIT</span>
              </button>

              <div className="flex items-center gap-2">
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F7F2E7] text-[#141318] ring-2 ring-black/80 shadow-[6px_6px_0_rgba(0,0,0,0.55)]">
              <span className="text-[10px] font-mono text-black/70 uppercase tracking-widest">
                    {subjectLabel}
                  </span>
                </div>

            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F7F2E7] text-[#141318] ring-2 ring-black/80 shadow-[6px_6px_0_rgba(0,0,0,0.55)]">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      status.includes('connected') || status === 'playing'
                        ? 'bg-green-500 animate-pulse'
                        : 'bg-yellow-500'
                    }`}
                  />
              <span className="text-xs font-mono text-black/70 uppercase tracking-wider">
                    {status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

        {/* Score + Timer */}
            <div className="grid grid-cols-3 gap-4 items-end">
              <div className="flex flex-col items-start">
            <div className="relative overflow-hidden rounded-[22px] bg-[#F7F2E7] text-[#141318] ring-2 ring-black/80 shadow-[10px_10px_0_rgba(0,0,0,0.55)] px-5 py-4 min-w-[92px]">
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.14]"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.14) 1px, rgba(0,0,0,0) 1.2px)',
                  backgroundSize: '18px 18px',
                }}
              />
              <div aria-hidden className="absolute top-0 left-0 h-2 w-full bg-[#00D4FF]" />
              <div className="relative">
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
                    scale: shouldAnimateMyWins
                      ? { times: [0, 0.3, 1], duration: 0.6 }
                      : { duration: 0.3 },
                  }}
                  className="text-5xl md:text-6xl font-black leading-none drop-shadow-[2px_2px_0_rgba(0,0,0,0.18)]"
                >
                  {myWins}
                </motion.div>
                <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.35em] text-black/60">
                  YOU
                </div>
              </div>
                </div>
              </div>

              <div className="flex flex-col items-center pb-1">
            <div
              className={`relative w-full max-w-[340px] overflow-hidden rounded-[22px] bg-[#F7F2E7] text-[#141318] ring-2 ring-black/80 shadow-[10px_10px_0_rgba(0,0,0,0.55)] px-5 py-4 ${
                timerIsLow ? 'ring-red-500/90' : ''
              }`}
            >
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.14]"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.14) 1px, rgba(0,0,0,0) 1.2px)',
                  backgroundSize: '18px 18px',
                }}
              />
              <div aria-hidden className="absolute top-0 left-0 h-2 w-full bg-[#FFD400]" />
              <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/80 via-transparent to-transparent opacity-80" />

              <div className="relative text-center">
                <div className="text-[10px] text-black/60 font-mono uppercase tracking-[0.28em]">
                  {roundMeta}
                </div>
                <div
                  className={`mt-1 text-4xl md:text-5xl font-black font-mono tracking-tighter tabular-nums transition-colors duration-300 ${
                    timerIsLow ? 'text-[#E11D48]' : 'text-[#141318]'
                  }`}
                >
                  {timerText}
                </div>
                <div className="mt-3 w-full max-w-[260px] mx-auto">
                  <BattleTimerBar
                    secondsLeft={timerBarSecondsLeft}
                    totalSeconds={timerBarTotalSeconds}
                    accent={phase === 'steps' ? 'amber' : 'blue'}
                    isLow={timerIsLow}
                  />
                </div>
              </div>
                </div>
              </div>

              <div className="flex flex-col items-end">
            <div className="relative overflow-hidden rounded-[22px] bg-[#F7F2E7] text-[#141318] ring-2 ring-black/80 shadow-[10px_10px_0_rgba(0,0,0,0.55)] px-5 py-4 min-w-[92px] text-right">
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.14]"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.14) 1px, rgba(0,0,0,0) 1.2px)',
                  backgroundSize: '18px 18px',
                }}
              />
              <div aria-hidden className="absolute top-0 left-0 h-2 w-full bg-[#FF3EA5]" />
              <div className="relative">
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
                    scale: shouldAnimateOppWins
                      ? { times: [0, 0.3, 1], duration: 0.6 }
                      : { duration: 0.3 },
                  }}
                  className="text-5xl md:text-6xl font-black leading-none drop-shadow-[2px_2px_0_rgba(0,0,0,0.18)]"
                >
                  {oppWins}
                </motion.div>
                <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.35em] text-black/60">
                  OPP
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mt-6 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6 lg:gap-10">
        {/* PROMPT / RESULTS */}
        <section className="min-h-0 flex items-center justify-center">
          <div className="w-full">
              <AnimatePresence mode="wait">
                {/* CONNECTING STATE */}
                {(status === 'connecting' || status === 'connected' || status === 'both_connected') && (
                  <motion.div
                    key="connecting-top"
                    variants={panelV}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={panelT}
                    className="w-full"
                  >
                    <div className="relative overflow-hidden rounded-[28px] bg-[#F7F2E7] text-[#141318] ring-2 ring-black/80 shadow-[12px_12px_0_rgba(0,0,0,0.55)] p-8 md:p-10 text-center">
                      <div
                        aria-hidden
                        className="absolute inset-0 opacity-[0.14]"
                        style={{
                          backgroundImage:
                            'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.14) 1px, rgba(0,0,0,0) 1.2px)',
                          backgroundSize: '18px 18px',
                        }}
                      />
                      <div aria-hidden className="absolute top-0 left-0 h-2 w-full bg-[#00D4FF]" />
                      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/80 via-transparent to-transparent opacity-80" />

                      <div className="relative">
                        <div className="mx-auto inline-flex items-center justify-center rounded-full bg-[#141318] text-[#F7F2E7] ring-4 ring-black/90 shadow-[8px_8px_0_rgba(0,0,0,0.55)] px-5 py-3 mb-6 rotate-[-3deg]">
                          {status === 'both_connected' ? (
                            <>
                              <Check className="w-5 h-5" />
                              <span className="ml-2 font-black tracking-tight">LOCKED</span>
                            </>
                          ) : (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span className="ml-2 font-black tracking-tight">LINKING</span>
                            </>
                      )}
                    </div>

                        <div className="text-[10px] font-mono uppercase tracking-[0.35em] text-black/60">
                          Battle Link
                        </div>
                        <h2 className="mt-2 text-4xl md:text-5xl font-black tracking-tight">
                          {status === 'both_connected' ? 'OPPONENT LOCKED' : 'FINDING OPPONENT'}
                    </h2>
                        <p className="mt-2 text-black/60 font-mono text-sm">
                          {status === 'both_connected' ? 'Get ready…' : 'Scanning frequencies…'}
                    </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* MAIN QUESTION PHASE (Multi-step) */}
                {status === 'playing' && question && phase === 'main_question' && !showRoundIntro && (
                  <motion.div
                    key="main-question-top"
                    variants={panelV}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={panelT}
                    className="w-full"
                  >
                    <div className="relative overflow-hidden rounded-[28px] bg-[#F7F2E7] text-[#141318] ring-2 ring-black/80 shadow-[12px_12px_0_rgba(0,0,0,0.55)] p-6 md:p-10">
                      <div
                        aria-hidden
                        className="absolute inset-0 opacity-[0.14]"
                        style={{
                          backgroundImage:
                            'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.14) 1px, rgba(0,0,0,0) 1.2px)',
                          backgroundSize: '18px 18px',
                        }}
                      />
                      <div aria-hidden className="absolute top-0 left-0 h-2 w-full bg-[#00D4FF]" />
                      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/80 via-transparent to-transparent opacity-80" />

                      <div className="relative text-center">
                        <div className="text-[11px] text-black/60 font-mono mb-3 uppercase tracking-[0.28em]">
                          Main Question
                        </div>
                        <h3 className="text-2xl md:text-4xl font-black leading-tight tracking-tight">
                          <MathText text={question.stem || question.questionText || question.title} />
                        </h3>
                        <div className="mt-5 text-sm text-black/60 font-mono">
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
                      variants={panelV}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={panelT}
                      className="w-full"
                    >
                      <div className="relative overflow-hidden rounded-[28px] bg-[#F7F2E7] text-[#141318] ring-2 ring-black/80 shadow-[12px_12px_0_rgba(0,0,0,0.55)] p-6 md:p-10">
                        <div
                          aria-hidden
                          className="absolute inset-0 opacity-[0.14]"
                          style={{
                            backgroundImage:
                              'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.14) 1px, rgba(0,0,0,0) 1.2px)',
                            backgroundSize: '18px 18px',
                          }}
                        />
                        <div aria-hidden className="absolute top-0 left-0 h-2 w-full bg-[#FFD400]" />
                        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/80 via-transparent to-transparent opacity-80" />

                        <div className="relative text-center">
                          <div className="text-[11px] text-black/60 font-mono mb-3 uppercase tracking-[0.28em]">
                            {currentSegment === 'sub'
                              ? `Step ${currentStepIndex + 1} of ${totalSteps} • Sub-step ${currentSubStepIndex + 1}`
                              : `Step ${currentStepIndex + 1} of ${totalSteps}`}
                          </div>
                          <h3 className="text-xl md:text-3xl font-black leading-tight tracking-tight">
                            <MathText text={currentStep.prompt || currentStep.question} />
                          </h3>
                          {currentSegment === 'sub' && (
                            <p className="text-xs text-black/60 mt-3 font-mono">
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
                    variants={panelV}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={panelT}
                    className="w-full max-w-2xl"
                  >
                    <div className="relative overflow-hidden rounded-[28px] bg-[#F7F2E7] text-[#141318] ring-2 ring-black/80 shadow-[12px_12px_0_rgba(0,0,0,0.55)] p-8 md:p-12 text-center">
                      <div
                        aria-hidden
                        className="absolute inset-0 opacity-[0.14]"
                        style={{
                          backgroundImage:
                            'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.14) 1px, rgba(0,0,0,0) 1.2px)',
                          backgroundSize: '18px 18px',
                        }}
                      />
                      <div aria-hidden className="absolute top-0 left-0 h-2 w-full bg-[#FFD400]" />
                      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/80 via-transparent to-transparent opacity-80" />

                      <div className="relative">
                        <div className="mx-auto inline-flex items-center justify-center rounded-full bg-[#141318] text-[#F7F2E7] ring-4 ring-black/90 shadow-[8px_8px_0_rgba(0,0,0,0.55)] px-5 py-3 mb-6 rotate-[2deg]">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="ml-2 font-black tracking-tight">HOLD</span>
                        </div>

                        <h2 className="text-3xl md:text-4xl font-black mb-2 tracking-tight">
                          ALL PARTS COMPLETE
                        </h2>
                        <p className="text-black/60 font-mono text-sm mb-5">
                          You finished all {totalSteps} part{totalSteps !== 1 ? 's' : ''}.
                        </p>

                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F7F2E7] ring-2 ring-black/80 shadow-[6px_6px_0_rgba(0,0,0,0.55)] text-sm font-black tracking-tight">
                        <Loader2 className="w-4 h-4 animate-spin" />
                          WAITING FOR OPPONENT…
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* PLAYING STATE (Single-step) - question only */}
                {status === 'playing' && question && phase === 'question' && !showRoundIntro && (
                  <motion.div
                    key="question-top"
                    variants={panelV}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={panelT}
                    className="w-full"
                  >
                    <div className="relative overflow-hidden rounded-[28px] bg-[#F7F2E7] text-[#141318] ring-2 ring-black/80 shadow-[12px_12px_0_rgba(0,0,0,0.55)] p-6 md:p-10">
                      <div
                        aria-hidden
                        className="absolute inset-0 opacity-[0.14]"
                        style={{
                          backgroundImage:
                            'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.14) 1px, rgba(0,0,0,0) 1.2px)',
                          backgroundSize: '18px 18px',
                        }}
                      />
                      <div aria-hidden className="absolute top-0 left-0 h-2 w-full bg-[#00D4FF]" />
                      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/80 via-transparent to-transparent opacity-80" />

                      <div className="relative text-center">
                        <h3 className="text-2xl md:text-4xl font-black leading-tight tracking-tight">
                        <MathText text={question.stem || question.questionText} />
                      </h3>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* RESULTS STATE (content only; actions moved to bottom) */}
                {status === 'results' && results && (
                  <motion.div
                    key="results-top"
                    variants={panelV}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={panelT}
                    className="w-full"
                  >
                    <div className="relative overflow-hidden rounded-[28px] bg-[#F7F2E7] text-[#141318] ring-2 ring-black/80 shadow-[12px_12px_0_rgba(0,0,0,0.55)] p-8 md:p-12 text-center">
                      <div
                        aria-hidden
                        className="absolute inset-0 opacity-[0.14]"
                        style={{
                          backgroundImage:
                            'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.14) 1px, rgba(0,0,0,0) 1.2px)',
                          backgroundSize: '18px 18px',
                        }}
                      />
                      <div
                        aria-hidden
                        className={`absolute top-0 left-0 h-2 w-full ${
                          results.round_winner === currentUser
                            ? 'bg-[#FFD400]'
                            : results.round_winner === null
                              ? 'bg-[#141318]'
                              : 'bg-[#FF3EA5]'
                        }`}
                      />
                      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/80 via-transparent to-transparent opacity-80" />

                      <div className="relative mb-8">
                      {results.round_winner === currentUser ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 180, damping: 16 }}
                            className="mx-auto inline-flex items-center justify-center rounded-full bg-[#FFD400] text-[#141318] ring-4 ring-black/90 shadow-[10px_10px_0_rgba(0,0,0,0.55)] px-6 py-3 mb-5 rotate-[-4deg]"
                        >
                            <Trophy className="w-7 h-7" />
                            <span className="ml-2 font-black tracking-tight">WIN</span>
                        </motion.div>
                      ) : results.round_winner === null ? (
                          <div className="mx-auto inline-flex items-center justify-center rounded-full bg-[#141318] text-[#F7F2E7] ring-4 ring-black/90 shadow-[10px_10px_0_rgba(0,0,0,0.55)] px-6 py-3 mb-5 rotate-[2deg]">
                            <Clock className="w-7 h-7" />
                            <span className="ml-2 font-black tracking-tight">TIE</span>
                        </div>
                      ) : (
                          <div className="mx-auto inline-flex items-center justify-center rounded-full bg-[#FF3EA5] text-[#141318] ring-4 ring-black/90 shadow-[10px_10px_0_rgba(0,0,0,0.55)] px-6 py-3 mb-5 rotate-[4deg]">
                            <X className="w-7 h-7" />
                            <span className="ml-2 font-black tracking-tight">OUCH</span>
                        </div>
                      )}

                      {matchOver && matchWinnerId ? (
                        <>
                            <h2 className="text-4xl md:text-5xl font-comic mb-2 tracking-[0.08em]">
                            {matchWinnerId === currentUser ? 'MATCH WON' : 'MATCH LOST'}
                          </h2>
                            <div className="text-lg font-black mb-2">
                            Final Score: {isPlayer1 ? myWins : oppWins} - {isPlayer1 ? oppWins : myWins}
                          </div>
                            <p className="text-black/60 font-mono text-sm">
                              {matchWinnerId === currentUser ? 'Victory secured.' : 'Run it back.'}
                          </p>
                        </>
                      ) : (
                        <>
                            <h2 className="text-4xl md:text-5xl font-comic mb-2 tracking-[0.08em]">
                            {results.round_winner === currentUser
                                ? 'ROUND WON'
                              : results.round_winner === null
                                ? 'STALEMATE'
                                : 'ROUND LOST'}
                          </h2>
                            <div className="text-sm text-black/60 font-mono mb-2">
                              Round {currentRoundNumber || 1} • First to {targetRoundsToWin || 4}
                          </div>
                          {results.p1Score !== undefined && results.p2Score !== undefined && (
                              <div className="text-lg font-black mb-2">
                              Round Score: {isPlayer1 ? results.p1Score : results.p2Score} -{' '}
                              {isPlayer1 ? results.p2Score : results.p1Score}
                            </div>
                          )}
                            <div className="text-sm font-black mb-2">
                            Match Score: {isPlayer1 ? myWins : oppWins} - {isPlayer1 ? oppWins : myWins}
                          </div>
                            <p className="text-black/60 font-mono text-sm">
                              {results.round_winner === currentUser ? 'Nice.' : 'Adjust and strike.'}
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
                                  className="relative overflow-hidden p-6 rounded-[22px] bg-[#FBF7EE] text-[#141318] ring-2 ring-black/80 shadow-[8px_8px_0_rgba(0,0,0,0.55)]"
                                >
                                  <div
                                    aria-hidden
                                    className="absolute inset-0 opacity-[0.12]"
                                    style={{
                                      backgroundImage:
                                        'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.12) 1px, rgba(0,0,0,0) 1.2px)',
                                      backgroundSize: '18px 18px',
                                    }}
                                  />
                                  <div aria-hidden className="absolute top-0 left-0 h-2 w-full bg-[#00D4FF]" />
                                  <div className="relative">
                                    <div className="text-xs font-mono text-black/60 mb-2 uppercase tracking-wider">
                                      YOU
                                    </div>
                                    <div className="text-5xl md:text-6xl font-black mb-2">
                                    {myPartsCorrect} out of {total}
                                  </div>
                                    <div className="text-sm text-black/60 font-mono">
                                    {myPartsCorrect === total ? 'Perfect!' : `${total - myPartsCorrect} incorrect`}
                                  </div>
                                  </div>
                                </motion.div>

                                <motion.div
                                  initial={{ x: 20, opacity: 0 }}
                                  animate={{ x: 0, opacity: 1 }}
                                  transition={{ delay: 0.2 }}
                                  className="relative overflow-hidden p-6 rounded-[22px] bg-[#FBF7EE] text-[#141318] ring-2 ring-black/80 shadow-[8px_8px_0_rgba(0,0,0,0.55)]"
                                >
                                  <div
                                    aria-hidden
                                    className="absolute inset-0 opacity-[0.12]"
                                    style={{
                                      backgroundImage:
                                        'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.12) 1px, rgba(0,0,0,0) 1.2px)',
                                      backgroundSize: '18px 18px',
                                    }}
                                  />
                                  <div aria-hidden className="absolute top-0 left-0 h-2 w-full bg-[#FF3EA5]" />
                                  <div className="relative">
                                    <div className="text-xs font-mono text-black/60 mb-2 uppercase tracking-wider">
                                      OPPONENT
                                    </div>
                                    <div className="text-5xl md:text-6xl font-black mb-2">
                                    {oppPartsCorrect} out of {total}
                                  </div>
                                    <div className="text-sm text-black/60 font-mono">
                                    {oppPartsCorrect === total ? 'Perfect!' : `${total - oppPartsCorrect} incorrect`}
                                  </div>
                                  </div>
                                </motion.div>
                              </div>

                              <div className="h-px w-full bg-gradient-to-r from-transparent via-black/20 to-transparent mb-6" />

                              <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-center mb-6"
                              >
                                {isTie ? (
                                  <div className="mx-auto inline-flex items-center justify-center rounded-full bg-[#141318] text-[#F7F2E7] ring-4 ring-black/90 shadow-[10px_10px_0_rgba(0,0,0,0.55)] px-6 py-3 rotate-[2deg]">
                                    <span className="font-black tracking-tight">STALEMATE</span>
                                  </div>
                                ) : iWon ? (
                                  <div className="mx-auto inline-flex items-center justify-center rounded-full bg-[#FFD400] text-[#141318] ring-4 ring-black/90 shadow-[10px_10px_0_rgba(0,0,0,0.55)] px-6 py-3 rotate-[-2deg]">
                                    <span className="font-black tracking-tight">YOU WON THIS ROUND</span>
                                  </div>
                                ) : (
                                  <div className="mx-auto inline-flex items-center justify-center rounded-full bg-[#FF3EA5] text-[#141318] ring-4 ring-black/90 shadow-[10px_10px_0_rgba(0,0,0,0.55)] px-6 py-3 rotate-[2deg]">
                                    <span className="font-black tracking-tight">OPPONENT WON THIS ROUND</span>
                                  </div>
                                )}
                              </motion.div>

                              <details className="mt-4">
                                <summary className="text-sm font-mono text-black/70 mb-3 uppercase tracking-wider cursor-pointer hover:text-black transition-colors">
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
                                        className={`p-3 rounded-xl ring-1 ring-black/20 text-left text-xs ${
                                          myCorrect ? 'bg-[#00D4FF]/10' : 'bg-[#FF3EA5]/10'
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
                            className="relative overflow-hidden p-5 rounded-[22px] bg-[#FBF7EE] text-[#141318] ring-2 ring-black/80 shadow-[8px_8px_0_rgba(0,0,0,0.55)]"
                          >
                            <div
                              aria-hidden
                              className="absolute inset-0 opacity-[0.12]"
                              style={{
                                backgroundImage:
                                  'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.12) 1px, rgba(0,0,0,0) 1.2px)',
                                backgroundSize: '18px 18px',
                              }}
                            />
                            <div aria-hidden className="absolute top-0 left-0 h-2 w-full bg-[#00D4FF]" />

                            <div className="relative">
                              <div className="text-xs font-mono text-black/60 mb-1">YOU CHOSE</div>
                              <div className="text-xl font-black flex items-center justify-center gap-2">
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
                            </div>
                          </motion.div>

                          <motion.div
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="relative overflow-hidden p-5 rounded-[22px] bg-[#FBF7EE] text-[#141318] ring-2 ring-black/80 shadow-[8px_8px_0_rgba(0,0,0,0.55)]"
                          >
                            <div
                              aria-hidden
                              className="absolute inset-0 opacity-[0.12]"
                              style={{
                                backgroundImage:
                                  'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.12) 1px, rgba(0,0,0,0) 1.2px)',
                                backgroundSize: '18px 18px',
                              }}
                            />
                            <div aria-hidden className="absolute top-0 left-0 h-2 w-full bg-[#FF3EA5]" />

                            <div className="relative">
                              <div className="text-xs font-mono text-black/60 mb-1">OPPONENT CHOSE</div>
                              <div className="text-xl font-black flex items-center justify-center gap-2">
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
                            </div>
                          </motion.div>
                        </div>
                      )}

                    {/* Fallback: Show basic results if structure is different */}
                    {(!results.stepResults || results.stepResults.length === 0) &&
                      (results.player1_answer === undefined || results.player2_answer === undefined) && (
                        <div className="mt-4 p-5 rounded-[22px] bg-[#FBF7EE] text-[#141318] ring-2 ring-black/80 shadow-[8px_8px_0_rgba(0,0,0,0.55)]">
                          <div className="text-sm font-mono text-black/70 mb-2">
                            ⚠️ Results data structure mismatch
                          </div>
                          <div className="text-xs text-black/60 font-mono">
                            player1_answer: {results.player1_answer ?? 'null'} | player2_answer:{' '}
                            {results.player2_answer ?? 'null'} | round_winner: {results.round_winner ?? 'null'}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* MATCH FINISHED (content only; action moved to bottom) */}
                {status === 'match_finished' && (
                  <motion.div
                    key="finished-top"
                    variants={panelV}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={panelT}
                    className="text-center w-full"
                  >
                    <div className="relative overflow-hidden rounded-[28px] bg-[#F7F2E7] text-[#141318] ring-2 ring-black/80 shadow-[12px_12px_0_rgba(0,0,0,0.55)] p-10 md:p-12">
                      <div
                        aria-hidden
                        className="absolute inset-0 opacity-[0.14]"
                        style={{
                          backgroundImage:
                            'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.14) 1px, rgba(0,0,0,0) 1.2px)',
                          backgroundSize: '18px 18px',
                        }}
                      />
                      <div
                        aria-hidden
                        className={`absolute top-0 left-0 h-2 w-full ${
                          matchWinner === currentUser
                            ? 'bg-[#FFD400]'
                            : matchWinner === opponentId
                              ? 'bg-[#FF3EA5]'
                              : 'bg-[#141318]'
                        }`}
                      />
                      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/80 via-transparent to-transparent opacity-80" />

                      <div className="relative">
                        <div
                          className={`mx-auto inline-flex items-center justify-center rounded-full ring-4 ring-black/90 shadow-[10px_10px_0_rgba(0,0,0,0.55)] px-6 py-3 mb-6 rotate-[-3deg] ${
                            matchWinner === currentUser
                              ? 'bg-[#FFD400] text-[#141318]'
                              : matchWinner === opponentId
                                ? 'bg-[#FF3EA5] text-[#141318]'
                                : 'bg-[#141318] text-[#F7F2E7]'
                          }`}
                        >
                          <Trophy className="w-7 h-7" />
                          <span className="ml-2 font-black tracking-tight">
                            {matchWinner === currentUser ? 'VICTORY' : matchWinner === opponentId ? 'DEFEAT' : 'DRAW'}
                          </span>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-comic tracking-[0.08em]">
                          {matchWinner === currentUser ? 'YOU WIN' : matchWinner === opponentId ? 'YOU LOSE' : 'DRAW'}
                        </h1>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
        </section>

        {/* ANSWERS / ACTIONS */}
        <section className="min-h-0 flex items-center justify-center">
          <div className="w-full">
          <AnimatePresence mode="wait">
            {/* MAIN QUESTION: action in bottom */}
            {status === 'playing' && question && phase === 'main_question' && !showRoundIntro && (
              <motion.div
                key="main-question-bottom"
                variants={panelV}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={panelT}
                className="w-full"
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
                  className={`w-full py-5 px-6 rounded-2xl font-black text-lg md:text-xl tracking-widest inline-flex items-center justify-center gap-3 ring-2 ring-black/90 shadow-[10px_10px_0_rgba(0,0,0,0.55)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070a] transition-colors ${
                    isWebSocketConnected
                      ? 'bg-[#141318] text-[#F7F2E7] hover:bg-black'
                      : 'bg-black/40 text-white/60 cursor-not-allowed opacity-70'
                  }`}
                >
                  <Zap className="w-5 h-5 text-[#FFD400]" />
                  {isWebSocketConnected ? 'Submit Answer Early' : 'Connecting...'}
                </button>
                <p className="mt-3 text-xs text-white/70 font-mono text-center uppercase tracking-wider">
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
                  variants={panelV}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={panelT}
                  className="w-full"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-[10px] text-white/70 font-mono uppercase tracking-[0.28em]">
                      Choose an answer
                    </div>

                    {answerSubmitted && (
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFD400] text-[#141318] rounded-full text-xs font-black tracking-widest ring-2 ring-black/90 shadow-[6px_6px_0_rgba(0,0,0,0.55)]">
                        <Check className="w-4 h-4" />
                        ANSWER SUBMITTED
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4">
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
                variants={panelV}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={panelT}
                className="w-full"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[10px] text-white/70 font-mono uppercase tracking-[0.28em]">
                    Choose an answer
                  </div>

                  {answerSubmitted && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D4FF] text-[#141318] rounded-full text-xs font-black tracking-widest ring-2 ring-black/90 shadow-[6px_6px_0_rgba(0,0,0,0.55)]">
                      <Loader2 className="w-4 h-4 animate-spin text-black/80" />
                      LOCKED IN
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4">
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
                    transition={battleTransition(reduceMotion, { duration: 0.18 })}
                    className="mt-6 text-center"
                  >
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#F7F2E7] text-[#141318] rounded-full text-sm font-black tracking-widest ring-2 ring-black/90 shadow-[6px_6px_0_rgba(0,0,0,0.55)]">
                      <Loader2 className="w-4 h-4 animate-spin text-black/70" />
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
                variants={panelV}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={panelT}
                className="w-full"
              >
                {!matchOver && (
                  <div>
                    {!resultsAcknowledged ? (
                      <button
                        onClick={readyForNextRound}
                        disabled={!isWebSocketConnected}
                        className={`w-full py-4 px-8 rounded-2xl font-black text-lg tracking-widest ring-2 ring-black/90 shadow-[10px_10px_0_rgba(0,0,0,0.55)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070a] transition-colors ${
                          isWebSocketConnected
                            ? 'bg-[#141318] text-[#F7F2E7] hover:bg-black'
                            : 'bg-black/40 text-white/60 cursor-not-allowed opacity-70'
                        }`}
                      >
                        {isWebSocketConnected ? 'NEXT ROUND' : 'CONNECTING...'}
                      </button>
                    ) : waitingForOpponentToAcknowledge ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F7F2E7] text-[#141318] ring-2 ring-black/90 shadow-[6px_6px_0_rgba(0,0,0,0.55)] text-xs font-black tracking-widest">
                          <Loader2 className="w-4 h-4 animate-spin text-black/70" />
                          WAITING FOR OPPONENT…
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F7F2E7] text-[#141318] ring-2 ring-black/90 shadow-[6px_6px_0_rgba(0,0,0,0.55)] text-xs font-black tracking-widest">
                          BOTH READY — STARTING…
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {matchOver && (
                  <div>
                    <button
                      onClick={() => navigate('/matchmaking-new')}
                      className="w-full py-4 px-8 rounded-2xl font-black text-lg tracking-widest bg-[#F7F2E7] text-[#141318] ring-2 ring-black/90 shadow-[10px_10px_0_rgba(0,0,0,0.55)] hover:bg-[#FBF7EE] transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070a]"
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
                variants={panelV}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={panelT}
                className="w-full"
              >
                <button
                  onClick={() => navigate('/matchmaking-new')}
                  className="w-full py-4 px-8 rounded-2xl font-black text-lg tracking-widest bg-[#F7F2E7] text-[#141318] ring-2 ring-black/90 shadow-[10px_10px_0_rgba(0,0,0,0.55)] hover:bg-[#FBF7EE] transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070a]"
                >
                  RETURN TO BASE
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </section>
      </div>
    </BattleHudShell>
  );
}