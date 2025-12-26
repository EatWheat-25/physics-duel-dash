import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Check, X, Trophy, Clock, Zap } from 'lucide-react';
import { useGame } from '@/hooks/useGame';
import type { MatchRow } from '@/types/schema';
import { motion, AnimatePresence } from 'framer-motion';
import { Starfield } from '@/components/Starfield';
import { MainQuestionCard } from '@/components/battle/MainQuestionCard';
import { StepCard } from '@/components/battle/StepCard';
import { SingleStepCard } from '@/components/battle/SingleStepCard';
import { BattleDoorOverlay } from '@/components/battle/BattleDoorOverlay';
import { useDomRenderSettled } from '@/hooks/useDomRenderSettled';

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
  const lastTimeoutToastAtRef = useRef<number>(0);
  const [isDoorOpen, setIsDoorOpen] = useState<boolean>(false);
  const isExitingRef = useRef<boolean>(false);
  const exitTimeoutRef = useRef<number | null>(null);
  const openDoorTimeoutRef = useRef<number | null>(null);
  const autoReturnTimeoutRef = useRef<number | null>(null);
  const contentRootRef = useRef<HTMLDivElement | null>(null);
  const DOOR_DURATION_MS = 420;
  const OPEN_DELAY_MS = 1000;
  const AUTO_RETURN_AFTER_MS = 2500;
  const AUTO_RETURN_HOLD_MS = 600;

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
    lastStepAdvanceReason, lastStepAdvanceAt,
    submitEarlyAnswer, submitStepAnswer,
    readyForNextRound,
    currentRoundId, currentRoundNumber, targetRoundsToWin, playerRoundWins, matchOver, matchWinnerId,
    nextRoundCountdown,
    isWebSocketConnected, waitingForOpponent,
    allStepsComplete, waitingForOpponentToCompleteSteps
  } = useGame(match);

  // Close door overlay before leaving battle (then navigate).
  const closeDoorAndExitToLobby = (opts?: { holdMs?: number }) => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    setIsDoorOpen(false);
    if (openDoorTimeoutRef.current) {
      window.clearTimeout(openDoorTimeoutRef.current);
      openDoorTimeoutRef.current = null;
    }
    if (autoReturnTimeoutRef.current) {
      window.clearTimeout(autoReturnTimeoutRef.current);
      autoReturnTimeoutRef.current = null;
    }
    if (exitTimeoutRef.current) {
      window.clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }
    const holdMs = Math.max(0, opts?.holdMs ?? 0);
    exitTimeoutRef.current = window.setTimeout(() => {
      navigate('/matchmaking-new');
    }, DOOR_DURATION_MS + holdMs);
  };

  useEffect(() => {
    return () => {
      if (exitTimeoutRef.current) {
        window.clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = null;
      }
      if (openDoorTimeoutRef.current) {
        window.clearTimeout(openDoorTimeoutRef.current);
        openDoorTimeoutRef.current = null;
      }
      if (autoReturnTimeoutRef.current) {
        window.clearTimeout(autoReturnTimeoutRef.current);
        autoReturnTimeoutRef.current = null;
      }
    };
  }, []);

  // When steps auto-advance due to timer expiry, surface it so it doesn't feel like a random desync.
  useEffect(() => {
    if (lastStepAdvanceReason !== 'timeout') return
    if (!lastStepAdvanceAt) return
    if (lastStepAdvanceAt <= lastTimeoutToastAtRef.current) return
    lastTimeoutToastAtRef.current = lastStepAdvanceAt
    toast('Time expired — advancing to the next part')
  }, [lastStepAdvanceReason, lastStepAdvanceAt])

  // Door gating key: close the door whenever the rendered content changes meaningfully.
  const doorKey = (() => {
    if (isExitingRef.current) return 'exiting';
    const q: any = question as any;
    const qid =
      q?.id ??
      q?.question_id ??
      q?.questionId ??
      q?.question?.id ??
      q?.question?.question_id ??
      q?.question?.questionId ??
      null;
    const roundKey = currentRoundId ?? currentRoundNumber ?? roundNumber ?? '0';
    if (!qid) return `${status}|${phase}|round:${roundKey}|no-qid`;
    if (status !== 'playing') return `${status}|${qid}|round:${roundKey}`;
    if (phase === 'steps') {
      const sub = currentSegment === 'sub' ? currentSubStepIndex : 0;
      return `steps|${qid}|round:${roundKey}|${currentStepIndex}|${currentSegment}|${sub}|${allStepsComplete ? 'done' : 'live'}`;
    }
    return `${phase}|${qid}|round:${roundKey}`;
  })();

  const domSettled = useDomRenderSettled(contentRootRef.current, doorKey, {
    quietWindowMs: 180,
    waitForFonts: true,
  });

  // When the content changes, re-close the door to hide render jank.
  useEffect(() => {
    if (isExitingRef.current) return;
    // Only re-close doors while we're rendering question/step content.
    // Keep doors open for RESULTS and MATCH_FINISHED screens so players can see them.
    if (status !== 'playing') return;

    setIsDoorOpen(false);
    if (openDoorTimeoutRef.current) {
      window.clearTimeout(openDoorTimeoutRef.current);
      openDoorTimeoutRef.current = null;
    }
  }, [doorKey, status]);

  // Safety: ensure error/results screens are visible (doors should be open there unless exiting).
  useEffect(() => {
    if (isExitingRef.current) return;
    if (status === 'error' || status === 'results' || status === 'match_finished') {
      setIsDoorOpen(true);
    }
  }, [status]);

  // Only open once (a) we're actually in a battle phase we render, and (b) the DOM has settled.
  const shouldOpenDoor =
    !isExitingRef.current &&
    status === 'playing' &&
    !!question &&
    !showRoundIntro &&
    (phase === 'main_question' || phase === 'question' || phase === 'steps') &&
    (phase !== 'steps' || (allStepsComplete && waitingForOpponentToCompleteSteps) || !!currentStep);

  useEffect(() => {
    if (openDoorTimeoutRef.current) {
      window.clearTimeout(openDoorTimeoutRef.current);
      openDoorTimeoutRef.current = null;
    }
    if (!shouldOpenDoor) return;
    if (!domSettled) return;

    openDoorTimeoutRef.current = window.setTimeout(() => {
      if (isExitingRef.current) return;
      setIsDoorOpen(true);
      openDoorTimeoutRef.current = null;
    }, OPEN_DELAY_MS);

    return () => {
      if (openDoorTimeoutRef.current) {
        window.clearTimeout(openDoorTimeoutRef.current);
        openDoorTimeoutRef.current = null;
      }
    };
  }, [shouldOpenDoor, domSettled, doorKey]);

  // Match finished → auto-return to lobby (keep button as an instant skip).
  useEffect(() => {
    if (isExitingRef.current) return;

    const shouldAutoReturn = !!matchOver || status === 'match_finished';
    if (!shouldAutoReturn) {
      if (autoReturnTimeoutRef.current) {
        window.clearTimeout(autoReturnTimeoutRef.current);
        autoReturnTimeoutRef.current = null;
      }
      return;
    }

    // Schedule once per match-finished state.
    if (autoReturnTimeoutRef.current) return;
    autoReturnTimeoutRef.current = window.setTimeout(() => {
      autoReturnTimeoutRef.current = null;
      closeDoorAndExitToLobby({ holdMs: AUTO_RETURN_HOLD_MS });
    }, AUTO_RETURN_AFTER_MS);

    return () => {
      if (autoReturnTimeoutRef.current) {
        window.clearTimeout(autoReturnTimeoutRef.current);
        autoReturnTimeoutRef.current = null;
      }
    };
  }, [matchOver, status]);

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

  // Door overlay status content (shown while doors are closed).
  const doorOverlayContent = (() => {
    if (isExitingRef.current) {
      return { title: 'RETURNING TO LOBBY', subtitle: 'PLEASE WAIT', showSpinner: true };
    }
    if (status === 'connecting') {
      return { title: 'ESTABLISHING LINK', subtitle: 'CONNECTING...', showSpinner: true };
    }
    if (status === 'connected') {
      return { title: 'AWAITING TARGET', subtitle: 'WAITING FOR OPPONENT...', showSpinner: true };
    }
    if (status === 'both_connected') {
      return { title: 'LOCKING TARGET', subtitle: 'INITIALIZING MATCH...', showSpinner: true };
    }
    if (status === 'playing') {
      if (!question) {
        return { title: 'LOADING QUESTION', subtitle: 'FETCHING DATA...', showSpinner: true };
      }
      if (!domSettled) {
        return { title: 'RENDERING QUESTION', subtitle: 'PREPARING DISPLAY...', showSpinner: true };
      }
      // During the intentional reveal delay window.
      if (!isDoorOpen && shouldOpenDoor) {
        return { title: 'TARGET LOCKED', subtitle: 'OPENING DOORS...', showSpinner: false };
      }
    }
    return { title: undefined, subtitle: undefined, showSpinner: false };
  })();

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
            onClick={closeDoorAndExitToLobby}
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors"
          >
            RETURN TO LOBBY
          </button>
        </div>
        <BattleDoorOverlay
          isOpen={isDoorOpen}
          durationMs={DOOR_DURATION_MS}
          zIndex={70}
          title={doorOverlayContent.title}
          subtitle={doorOverlayContent.subtitle}
          showSpinner={doorOverlayContent.showSpinner}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30 overflow-hidden relative">
      <Starfield />
      
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-[#050505] to-[#050505] pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent pointer-events-none" />
      
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

      {/* Header */}
      <header className="relative z-20 w-full max-w-7xl mx-auto p-4 md:p-6 flex justify-between items-center">
        <button 
          onClick={closeDoorAndExitToLobby}
          className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group"
        >
          <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium tracking-wide">EXIT</span>
        </button>

        <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full backdrop-blur-md">
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
            {/* Round Win Counter - Large and Prominent */}
            <div className="mb-3">
              <motion.div
                key={`my-wins-${playerRoundWins?.[currentUser || ''] || 0}`}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ 
                  scale: shouldAnimateMyWins ? [1, 1.4, 1] : 1,
                  opacity: 1,
                }}
                transition={{ 
                  duration: 0.6,
                  ease: "easeOut",
                  scale: shouldAnimateMyWins ? {
                    times: [0, 0.3, 1],
                    duration: 0.6
                  } : { duration: 0.3 }
                }}
                className="text-6xl md:text-7xl font-black text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.6)]"
              >
                {playerRoundWins?.[currentUser || ''] || 0}
              </motion.div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/30">
                <span className="font-bold text-lg">Y</span>
              </div>
              <div>
                <div className="text-xs text-blue-200/50 font-mono mb-0.5">OPERATOR</div>
                <div className="font-bold text-shadow-glow text-lg">YOU</div>
              </div>
            </div>
          </div>

          {/* Timer / Round Indicator */}
          <div className="flex flex-col items-center pb-2">
            <div className="text-xs text-white/30 font-mono mb-2 uppercase tracking-widest">
              ROUND {currentRoundNumber || roundNumber || 0}
              {phase === 'steps' && totalSteps > 0 && ` • STEP ${currentStepIndex + 1}/${totalSteps}${currentSegment === 'sub' ? ` • SUB ${currentSubStepIndex + 1}` : ''}`}
            </div>
            <div className={`text-5xl font-black font-mono tracking-tighter tabular-nums transition-colors duration-300 ${
              ((phase === 'main_question' && (mainQuestionTimeLeft ?? 60) <= 10) ||
               (phase === 'steps' && (stepTimeLeft ?? 15) <= (currentSegment === 'sub' ? 2 : 5)) ||
               (phase === 'question' && (timeRemaining ?? 60) <= 10))
                ? 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
                : 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]'
            }`}>
              {phase === 'main_question' && mainQuestionTimeLeft !== null
                ? `${Math.floor(mainQuestionTimeLeft / 60)}:${String(mainQuestionTimeLeft % 60).padStart(2, '0')}`
                : phase === 'steps' && stepTimeLeft !== null
                ? `${stepTimeLeft}s`
                : `${Math.floor((timeRemaining ?? 0) / 60)}:${String((timeRemaining ?? 0) % 60).padStart(2, '0')}`
              }
            </div>
          </div>

          {/* Opponent Stats */}
          <div className="flex flex-col items-end">
            {/* Round Win Counter - Large and Prominent */}
            <div className="mb-3">
              <motion.div
                key={`opp-wins-${playerRoundWins?.[opponentId || ''] || 0}`}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ 
                  scale: shouldAnimateOppWins ? [1, 1.4, 1] : 1,
                  opacity: 1,
                }}
                transition={{ 
                  duration: 0.6,
                  ease: "easeOut",
                  scale: shouldAnimateOppWins ? {
                    times: [0, 0.3, 1],
                    duration: 0.6
                  } : { duration: 0.3 }
                }}
                className="text-6xl md:text-7xl font-black text-red-400 drop-shadow-[0_0_20px_rgba(248,113,113,0.6)]"
              >
                {playerRoundWins?.[opponentId || ''] || 0}
              </motion.div>
            </div>
            <div className="flex items-center gap-3 flex-row-reverse text-right">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-colors ring-1 ${
                status === 'playing' || status === 'results' 
                  ? 'bg-gradient-to-br from-red-600 to-red-800 shadow-red-500/20 ring-red-400/30' 
                  : 'bg-white/5 ring-white/10'
              }`}>
                <span className="font-bold text-lg">{status.includes('connect') ? '?' : 'O'}</span>
              </div>
              <div>
                <div className="text-xs text-red-200/50 font-mono mb-0.5">TARGET</div>
                <div className="font-bold text-shadow-glow text-lg">OPPONENT</div>
              </div>
            </div>
          </div>
        </div>

        {/* Game Content */}
        <div className="flex-1 relative flex items-center justify-center">
          <div ref={contentRootRef} className="w-full h-full flex items-center justify-center">
            <AnimatePresence mode="wait">

            {/* MAIN QUESTION PHASE (Multi-step) */}
            {status === 'playing' && question && phase === 'main_question' && (
              <MainQuestionCard
                key="main-question"
                stem={question.stem || question.questionText || question.title}
                imageUrl={question.imageUrl || (question as any).image_url || null}
                totalSteps={totalSteps}
                isWebSocketConnected={isWebSocketConnected}
                onSubmitEarly={() => {
                  if (!isWebSocketConnected) {
                    toast.error('Connection lost. Please wait for reconnection...');
                    return;
                  }
                  submitEarlyAnswer();
                }}
              />
            )}

            {/* STEPS PHASE (Multi-step) */}
            {status === 'playing' && question && phase === 'steps' && currentStep && !(allStepsComplete && waitingForOpponentToCompleteSteps) && (
              <StepCard
                key="steps"
                stepIndex={currentStepIndex}
                totalSteps={totalSteps}
                segment={currentSegment}
                subStepIndex={currentSubStepIndex}
                prompt={currentStep.prompt || currentStep.question}
                options={currentStep.options}
                answerSubmitted={answerSubmitted}
                disabled={stepTimeLeft !== null && stepTimeLeft <= 0}
                onSelectOption={(idx) => submitStepAnswer(currentStepIndex, idx)}
              />
            )}

            {/* WAITING FOR OPPONENT TO COMPLETE ALL STEPS */}
            {status === 'playing' && phase === 'steps' && allStepsComplete && waitingForOpponentToCompleteSteps && (
              <motion.div
                key="waiting-steps"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="w-full max-w-2xl bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-12 text-center shadow-[0_0_50px_rgba(0,0,0,0.5)]"
              >
                <div className="mb-6">
                  <Loader2 className="w-16 h-16 animate-spin text-blue-400 mx-auto mb-4" />
                  <h2 className="text-3xl font-bold mb-2 tracking-tight">
                    ALL PARTS COMPLETE
                  </h2>
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

            {/* PLAYING STATE (Single-step) */}
            {status === 'playing' && question && phase === 'question' && (
              <SingleStepCard
                key="playing"
                questionText={question.stem || question.questionText || question.title}
                imageUrl={question.imageUrl || (question as any).image_url || null}
                options={question.steps?.[0]?.options ?? []}
                answerSubmitted={answerSubmitted}
                onSelectOption={(idx) => submitAnswer(idx)}
              />
            )}

            {/* RESULTS STATE */}
            {(() => {
              const shouldShowResults = status === 'results' && results
              console.log('[BattleConnected] Results render check:', {
                status,
                hasResults: !!results,
                shouldShowResults,
                resultsPlayer1Answer: results?.player1_answer,
                resultsPlayer2Answer: results?.player2_answer,
                resultsRoundWinner: results?.round_winner
              })
              return null
            })()}
            {status === 'results' && results && (
              <motion.div
                key="results"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                className="w-full max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 text-center shadow-[0_0_50px_rgba(0,0,0,0.5)]"
              >
                <div className="mb-8">
                  {results.round_winner === currentUser ? (
                    <motion.div 
                      initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}
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
                        Final Score: {isPlayer1 ? (playerRoundWins?.[currentUser || ''] || 0) : (playerRoundWins?.[opponentId || ''] || 0)} - {isPlayer1 ? (playerRoundWins?.[opponentId || ''] || 0) : (playerRoundWins?.[currentUser || ''] || 0)}
                      </div>
                      <p className="text-white/40 font-mono text-sm">
                        {matchWinnerId === currentUser ? 'VICTORY ACHIEVED!' : 'BETTER LUCK NEXT TIME.'}
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-4xl font-bold mb-2 tracking-tight">
                        {results.round_winner === currentUser ? 'ROUND SECURED' : results.round_winner === null ? 'STALEMATE' : 'ROUND LOST'}
                      </h2>
                      <div className="text-sm text-white/60 font-mono mb-2">
                        Round {currentRoundNumber || 1} of {targetRoundsToWin || 3} needed
                      </div>
                      {results.p1Score !== undefined && results.p2Score !== undefined && (
                        <div className="text-lg font-bold mb-2">
                          Round Score: {isPlayer1 ? results.p1Score : results.p2Score} - {isPlayer1 ? results.p2Score : results.p1Score}
                        </div>
                      )}
                      <div className="text-sm font-bold mb-2">
                        Match Score: {isPlayer1 ? (playerRoundWins?.[currentUser || ''] || 0) : (playerRoundWins?.[opponentId || ''] || 0)} - {isPlayer1 ? (playerRoundWins?.[opponentId || ''] || 0) : (playerRoundWins?.[currentUser || ''] || 0)}
                      </div>
                      <p className="text-white/40 font-mono text-sm">
                        {results.round_winner === currentUser ? 'EXCELLENT WORK, OPERATOR.' : 'ADJUST STRATEGY.'}
                      </p>
                    </>
                  )}
                </div>

                {/* Step-by-step results with "X out of 4" format */}
                {results.stepResults && results.stepResults.length > 0 && (
                  <div className="mb-8">
                    {/* Calculate parts correct for each player */}
                    {(() => {
                      const totalParts =
                        typeof results.totalParts === 'number' && Number.isFinite(results.totalParts) && results.totalParts > 0
                          ? results.totalParts
                          : results.stepResults.length;

                      const hasAggregateParts =
                        typeof results.p1PartsCorrect === 'number' && typeof results.p2PartsCorrect === 'number';

                      const getMainAnswer = (stepResult: any, which: 'p1' | 'p2') =>
                        which === 'p1'
                          ? (stepResult.p1MainAnswerIndex ?? stepResult.p1AnswerIndex)
                          : (stepResult.p2MainAnswerIndex ?? stepResult.p2AnswerIndex);

                      const getMainCorrect = (stepResult: any) =>
                        stepResult.mainCorrectAnswer ?? stepResult.correctAnswer;

                      const myPartsCorrect = hasAggregateParts
                        ? (isPlayer1 ? results.p1PartsCorrect : results.p2PartsCorrect)
                        : results.stepResults.filter((stepResult: any) => {
                            const myPartCorrect = isPlayer1 ? stepResult.p1PartCorrect : stepResult.p2PartCorrect;
                            if (typeof myPartCorrect === 'boolean') return myPartCorrect;

                            // Legacy fallback (main-only)
                            const myAnswer = getMainAnswer(stepResult, isPlayer1 ? 'p1' : 'p2');
                            const correct = getMainCorrect(stepResult);
                            return myAnswer !== null && myAnswer !== undefined && correct !== null && correct !== undefined && myAnswer === correct;
                          }).length;

                      const oppPartsCorrect = hasAggregateParts
                        ? (isPlayer1 ? results.p2PartsCorrect : results.p1PartsCorrect)
                        : results.stepResults.filter((stepResult: any) => {
                            const oppPartCorrect = isPlayer1 ? stepResult.p2PartCorrect : stepResult.p1PartCorrect;
                            if (typeof oppPartCorrect === 'boolean') return oppPartCorrect;

                            // Legacy fallback (main-only)
                            const oppAnswer = getMainAnswer(stepResult, isPlayer1 ? 'p2' : 'p1');
                            const correct = getMainCorrect(stepResult);
                            return oppAnswer !== null && oppAnswer !== undefined && correct !== null && correct !== undefined && oppAnswer === correct;
                          }).length;

                      const iWon = myPartsCorrect > oppPartsCorrect;
                      const isTie = myPartsCorrect === oppPartsCorrect;
                      
                      return (
                        <>
                          {/* Main "X out of 4" Display */}
                          <div className="grid grid-cols-2 gap-6 mb-6">
                            {/* Player Section */}
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
                              <div className={`text-5xl md:text-6xl font-black mb-2 ${
                                iWon ? 'text-green-400' : isTie ? 'text-blue-400' : 'text-red-400'
                              }`}>
                                {myPartsCorrect} out of {totalParts}
                              </div>
                              <div className="text-sm text-white/60 font-mono">
                                {myPartsCorrect === totalParts ? 'Perfect!' : `${totalParts - myPartsCorrect} incorrect`}
                              </div>
                            </motion.div>
                            
                            {/* Opponent Section */}
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
                              <div className={`text-5xl md:text-6xl font-black mb-2 ${
                                !iWon && !isTie ? 'text-green-400' : isTie ? 'text-blue-400' : 'text-red-400'
                              }`}>
                                {oppPartsCorrect} out of {totalParts}
                              </div>
                              <div className="text-sm text-white/60 font-mono">
                                {oppPartsCorrect === totalParts ? 'Perfect!' : `${totalParts - oppPartsCorrect} incorrect`}
                              </div>
                            </motion.div>
                          </div>
                          
                          {/* Divider */}
                          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent mb-6" />
                          
                          {/* Winner Announcement */}
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
                          
                          {/* Step-by-step breakdown (optional, smaller) */}
                          <details className="mt-4">
                            <summary className="text-sm font-mono text-white/60 mb-3 uppercase tracking-wider cursor-pointer hover:text-white/80 transition-colors">
                              Step Breakdown
                            </summary>
                            <div className="space-y-2 mt-3">
                              {results.stepResults.map((stepResult, idx) => {
                                const myPartCorrect = isPlayer1 ? stepResult.p1PartCorrect : stepResult.p2PartCorrect
                                const myCorrect = typeof myPartCorrect === 'boolean'
                                  ? myPartCorrect
                                  : (() => {
                                      const myAnswer = isPlayer1
                                        ? (stepResult.p1MainAnswerIndex ?? stepResult.p1AnswerIndex)
                                        : (stepResult.p2MainAnswerIndex ?? stepResult.p2AnswerIndex)
                                      const correct = stepResult.mainCorrectAnswer ?? stepResult.correctAnswer
                                      return myAnswer !== null && myAnswer !== undefined && correct !== null && correct !== undefined && myAnswer === correct
                                    })()

                                const myAwarded = isPlayer1
                                  ? (stepResult.p1StepAwarded ?? stepResult.p1Marks ?? 0)
                                  : (stepResult.p2StepAwarded ?? stepResult.p2Marks ?? 0)
                                return (
                                  <div
                                    key={idx}
                                    className={`p-2 rounded-lg border text-left text-xs ${
                                      myCorrect ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold">Step {stepResult.stepIndex + 1}</span>
                                      <span className="font-mono">
                                        {myCorrect ? '✓' : '✗'} {myAwarded} pts
                                      </span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </details>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Single-step results */}
                {(!results.stepResults || results.stepResults.length === 0) && results.player1_answer !== undefined && results.player2_answer !== undefined && (
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <motion.div 
                      initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.1 }}
                      className={`p-4 rounded-2xl border ${
                      (playerRole === 'player1' && results.player1_correct) || (playerRole === 'player2' && results.player2_correct)
                        ? 'bg-green-500/10 border-green-500/20' 
                        : 'bg-red-500/10 border-red-500/20'
                    }`}>
                      <div className="text-xs font-mono opacity-50 mb-1">YOU CHOSE</div>
                      <div className="text-xl font-bold flex items-center justify-center gap-2">
                        {(() => {
                          const myAnswer = playerRole === 'player1' ? results.player1_answer : results.player2_answer
                          const myCorrect = (playerRole === 'player1' && results.player1_correct) || (playerRole === 'player2' && results.player2_correct)
                          // Handle both boolean (0/1) and multi-option (0-5) answers
                          const answerDisplay = myAnswer !== null && myAnswer !== undefined 
                            ? (typeof myAnswer === 'number' && Number.isInteger(myAnswer) && myAnswer >= 0
                                ? String.fromCharCode(65 + myAnswer)
                                : String(myAnswer))
                            : 'N/A'
                          return (
                            <>
                              {answerDisplay}
                              {myCorrect ? <Check className="w-5 h-5 text-green-500" /> : <X className="w-5 h-5 text-red-500" />}
                            </>
                          )
                        })()}
                      </div>
                    </motion.div>

                    <motion.div 
                      initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                      className={`p-4 rounded-2xl border ${
                      (playerRole === 'player1' && results.player2_correct) || (playerRole === 'player2' && results.player1_correct)
                        ? 'bg-green-500/10 border-green-500/20' 
                        : 'bg-red-500/10 border-red-500/20'
                    }`}>
                      <div className="text-xs font-mono opacity-50 mb-1">OPPONENT CHOSE</div>
                      <div className="text-xl font-bold flex items-center justify-center gap-2">
                        {(() => {
                          const oppAnswer = playerRole === 'player1' ? results.player2_answer : results.player1_answer
                          const oppCorrect = (playerRole === 'player1' && results.player2_correct) || (playerRole === 'player2' && results.player1_correct)
                          // Handle both boolean (0/1) and multi-option (0-5) answers
                          const answerDisplay = oppAnswer !== null && oppAnswer !== undefined 
                            ? (typeof oppAnswer === 'number' && Number.isInteger(oppAnswer) && oppAnswer >= 0
                                ? String.fromCharCode(65 + oppAnswer)
                                : String(oppAnswer))
                            : 'N/A'
                          return (
                            <>
                              {answerDisplay}
                              {oppCorrect ? <Check className="w-5 h-5 text-green-500" /> : <X className="w-5 h-5 text-red-500" />}
                            </>
                          )
                        })()}
                      </div>
                    </motion.div>
                  </div>
                )}
                
                {/* Fallback: Show basic results if structure is different */}
                {(!results.stepResults || results.stepResults.length === 0) && (results.player1_answer === undefined || results.player2_answer === undefined) && (
                  <div className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="text-sm font-mono text-yellow-400 mb-2">⚠️ Results data structure mismatch</div>
                    <div className="text-xs text-white/60 font-mono">
                      player1_answer: {results.player1_answer ?? 'null'} | 
                      player2_answer: {results.player2_answer ?? 'null'} | 
                      round_winner: {results.round_winner ?? 'null'}
                    </div>
                  </div>
                )}

                {!matchOver && (
                  <div className="mt-6">
                    <div className="flex flex-col items-center gap-3">
                      {!isWebSocketConnected ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                          <div className="text-sm font-mono text-white/60">CONNECTING...</div>
                        </>
                      ) : typeof nextRoundCountdown === 'number' ? (
                        nextRoundCountdown > 0 ? (
                          <>
                            <div className="text-xs font-mono text-white/50 tracking-widest">NEXT ROUND IN</div>
                            <div className="text-5xl font-black tracking-tight">{nextRoundCountdown}s</div>
                          </>
                        ) : (
                          <>
                            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                            <div className="text-sm font-mono text-white/60">STARTING NEXT ROUND...</div>
                          </>
                        )
                      ) : (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                          <div className="text-sm font-mono text-white/60">STARTING NEXT ROUND...</div>
                        </>
                      )}

                      {/* Manual safety net: if countdown is missing/stuck, allow player to re-request next round */}
                      {isWebSocketConnected && nextRoundCountdown == null && (
                        <button
                          onClick={() => readyForNextRound()}
                          className="mt-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                        >
                          SYNC NEXT ROUND
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {matchOver && (
                  <div className="mt-4">
                    <button
                      onClick={closeDoorAndExitToLobby}
                      className="px-6 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                    >
                      RETURN TO LOBBY
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* MATCH FINISHED */}
            {status === 'match_finished' && (
              <motion.div
                key="finished"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center relative z-50"
              >
                <div className="mb-8">
                  <Trophy className={`w-32 h-32 mx-auto mb-6 ${matchWinner === currentUser ? 'text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]' : 'text-gray-500'}`} />
                  <h1 className="text-6xl md:text-8xl font-black mb-6 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                    {matchWinner === currentUser ? 'VICTORY' : matchWinner === opponentId ? 'DEFEAT' : 'DRAW'}
                  </h1>
                </div>
                <button 
                  onClick={closeDoorAndExitToLobby}
                  className="px-8 py-4 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                >
                  RETURN TO BASE
                </button>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <BattleDoorOverlay
        isOpen={isDoorOpen}
        durationMs={DOOR_DURATION_MS}
        zIndex={70}
        title={doorOverlayContent.title}
        subtitle={doorOverlayContent.subtitle}
        showSpinner={doorOverlayContent.showSpinner}
      />
    </div>
  );
}