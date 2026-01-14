import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Check, X, Trophy, Clock } from 'lucide-react';
import { useGame } from '@/hooks/useGame';
import type { MatchRow } from '@/types/schema';
import { motion, AnimatePresence } from 'framer-motion';
import { RedYellowPatternBackground } from '@/components/battle/RedYellowPatternBackground';
import { MainQuestionCard } from '@/components/battle/MainQuestionCard';
import { StepCard } from '@/components/battle/StepCard';
import { SingleStepCard } from '@/components/battle/SingleStepCard';
import { RoundTransitionOverlay } from '@/components/battle/RoundTransitionOverlay';
import { BrandMark } from '@/components/BrandMark';
import { getRankByPoints } from '@/types/ranking';

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
  const [playerRanks, setPlayerRanks] = useState<Record<string, { display_name: string; rank_points: number }>>({});
  const [redirectedToResults, setRedirectedToResults] = useState(false);
  const [roundTransitionSeconds, setRoundTransitionSeconds] = useState<number | null>(null);
  const [autoReadySent, setAutoReadySent] = useState(false);

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

  // Fetch rank points + display names for both players (RLS-safe via RPC)
  useEffect(() => {
    if (!match?.player1_id || !match?.player2_id) return;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_players_rank_public_v1', {
        p_ids: [match.player1_id, match.player2_id],
      });

      if (cancelled) return;
      if (error || !Array.isArray(data)) return;

      const map: Record<string, { display_name: string; rank_points: number }> = {};
      for (const row of data as any[]) {
        if (row?.id) {
          map[String(row.id)] = {
            display_name: String(row.display_name ?? 'Player'),
            rank_points: Number(row.rank_points ?? 0),
          };
        }
      }
      setPlayerRanks(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [match?.player1_id, match?.player2_id]);

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

  // Round transition countdown (auto-advance after results)
  useEffect(() => {
    if (status !== 'results' || !results || matchOver) {
      setRoundTransitionSeconds(null);
      setAutoReadySent(false);
      return;
    }
    setRoundTransitionSeconds(10);
    setAutoReadySent(false);
  }, [status, results, matchOver]);

  useEffect(() => {
    if (roundTransitionSeconds === null || roundTransitionSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setRoundTransitionSeconds(prev => (prev === null ? prev : Math.max(prev - 1, 0)));
    }, 1000);
    return () => clearTimeout(timer);
  }, [roundTransitionSeconds]);

  useEffect(() => {
    if (roundTransitionSeconds === null || roundTransitionSeconds > 0) return;
    if (status !== 'results' || matchOver) return;
    if (resultsAcknowledged || autoReadySent || !isWebSocketConnected) return;
    readyForNextRound();
    setAutoReadySent(true);
  }, [
    roundTransitionSeconds,
    status,
    matchOver,
    resultsAcknowledged,
    autoReadySent,
    isWebSocketConnected,
    readyForNextRound
  ]);

  // Polling fallback - removed as it uses columns that don't exist in schema
  // Results are handled via WebSocket messages from useGame hook

  // --- Rendering Helpers ---

  const isPlayer1 = match?.player1_id === currentUser;
  const opponentId = isPlayer1 ? match?.player2_id : match?.player1_id;
  const stepSegmentTimeLeft = currentSegment === 'sub' ? subStepTimeLeft : stepTimeLeft;
  const hasStartedMatch = status === 'playing' || status === 'results' || status === 'match_finished' || !!question;
  const isConnectingPhase = status === 'connecting' || status === 'connected' || status === 'both_connected';

  const myMeta = currentUser ? playerRanks[currentUser] : undefined;
  const oppMeta = opponentId ? playerRanks[opponentId] : undefined;
  const myRank = getRankByPoints(myMeta?.rank_points ?? 0);
  const oppRank = getRankByPoints(oppMeta?.rank_points ?? 0);

  // When the match is fully over, redirect to the ranked results page.
  useEffect(() => {
    if (!matchId) return;
    if (!matchOver) return;
    if (redirectedToResults) return;
    // Wait until both players have acknowledged the final results to avoid yanking mid-screen.
    if (!resultsAcknowledged || waitingForOpponentToAcknowledge) return;
    setRedirectedToResults(true);
    navigate(`/match-results/${matchId}`);
  }, [matchId, matchOver, resultsAcknowledged, waitingForOpponentToAcknowledge, redirectedToResults, navigate]);

  const formatPoints = (n: number | null | undefined): string => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '0';
    const rounded = Math.round(n);
    if (Math.abs(n - rounded) < 1e-9) return String(rounded);
    return n.toFixed(1);
  };

  if (!match || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <RedYellowPatternBackground />
        <div className="paper-card text-center relative z-10 w-full max-w-md">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="w-16 h-16 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-blue-500/20 rounded-full animate-pulse" />
            </div>
          </div>
          <p className="text-slate-700 font-mono tracking-widest text-sm">INITIALIZING BATTLEGROUND</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <RedYellowPatternBackground />
        <div className="max-w-md w-full paper-card text-center relative z-10">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">CONNECTION LOST</h2>
          <p className="text-slate-600 mb-8 text-sm">{errorMessage || 'The neural link was severed.'}</p>
          <button 
            onClick={() => navigate('/matchmaking-new')}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-bold transition-colors border border-black/20"
          >
            RETURN TO LOBBY
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white font-sans selection:bg-blue-500/30 overflow-hidden relative">
      <RedYellowPatternBackground />
      
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

      <RoundTransitionOverlay
        isVisible={status === 'results' && !!results && !matchOver}
        secondsLeft={roundTransitionSeconds ?? 10}
        hasAcknowledged={resultsAcknowledged}
        waitingForOpponent={waitingForOpponentToAcknowledge}
        isConnected={isWebSocketConnected}
      />

      {/* Header */}
      <header className="relative z-20 w-full max-w-7xl mx-auto p-4 md:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <BrandMark />
          <button 
            onClick={() => navigate('/matchmaking-new')}
            className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group"
          >
            <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium tracking-wide">EXIT</span>
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full backdrop-blur-md">
          {(() => {
            const inMatch = status === 'playing' || status === 'results'
            const isReconnecting = inMatch && !isWebSocketConnected
            const label = isReconnecting ? 'reconnecting' : status.replace('_', ' ')
            const dotClass =
              isReconnecting
                ? 'bg-yellow-500 animate-pulse'
                : (status.includes('connected') || status === 'playing')
                ? 'bg-green-500 animate-pulse'
                : 'bg-yellow-500'
            return (
              <>
                <div className={`w-2 h-2 rounded-full ${dotClass}`} />
                <span className="text-xs font-mono text-blue-200 uppercase tracking-wider">
                  {label}
                </span>
              </>
            )
          })()}
        </div>
      </header>

      {/* Main Arena */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-6 flex flex-col h-[calc(100vh-100px)]">
        
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
                <div className="flex items-center gap-2">
                  {myRank.imageUrl && (
                    <img
                      src={myRank.imageUrl}
                      alt={myRank.tier}
                      className="w-6 h-6"
                      loading="lazy"
                    />
                  )}
                  <div className="font-bold text-shadow-glow text-lg">{myMeta?.display_name ?? 'YOU'}</div>
                </div>
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
                <div className="flex items-center gap-2 justify-end">
                  <div className="font-bold text-shadow-glow text-lg">{oppMeta?.display_name ?? 'OPPONENT'}</div>
                  {oppRank.imageUrl && (
                    <img
                      src={oppRank.imageUrl}
                      alt={oppRank.tier}
                      className="w-6 h-6"
                      loading="lazy"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Game Content */}
        <div className="flex-1 relative flex items-center justify-center">
          <AnimatePresence mode="wait">
            {/* CONNECTING STATE */}
            {isConnectingPhase && (
              <motion.div
                key="connecting"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
                className="w-full max-w-xl"
              >
                <div className="paper-card text-center">
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
                    {hasStartedMatch
                      ? 'RECONNECTING...'
                      : status === 'both_connected'
                      ? 'OPPONENT LOCKED'
                      : 'SEARCHING FOR TARGET'}
                  </h2>
                  <p className="text-slate-600 font-mono text-sm">
                    {hasStartedMatch
                      ? 'RESTORING LINK...'
                      : status === 'both_connected'
                      ? 'INITIATING COMBAT SEQUENCE...'
                      : 'SCANNING FREQUENCIES...'}
                  </p>
                </div>
              </motion.div>
            )}

            {/* In-match reconnect hint (keeps UX clear if status stays playing but socket is down) */}
            {hasStartedMatch && !isWebSocketConnected && status !== 'match_finished' && (
              <motion.div
                key="reconnecting-banner"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-30"
              >
                <div className="px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 backdrop-blur-md flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span className="text-xs font-mono text-blue-200 uppercase tracking-wider">
                    RECONNECTING...
                  </span>
                </div>
              </motion.div>
            )}

            {/* MAIN QUESTION PHASE (Multi-step) */}
            {status === 'playing' && question && phase === 'main_question' && !showRoundIntro && (
              <div className="w-full max-w-6xl">
                <MainQuestionCard
                  stem={(question as any).stem || (question as any).questionText || (question as any).title || ''}
                  imageUrl={(question as any).imageUrl || (question as any).image_url || null}
                  structureSmiles={(question as any).structureSmiles || (question as any).structure_smiles || null}
                  graph={(question as any).graph || null}
                  totalSteps={totalSteps ?? 0}
                  isWebSocketConnected={isWebSocketConnected}
                  onSubmitEarly={() => {
                    if (!isWebSocketConnected) {
                      toast.error('Connection lost. Please wait for reconnection...');
                      return;
                    }
                    submitEarlyAnswer();
                  }}
                />
              </div>
            )}

            {/* STEPS PHASE (Multi-step) */}
            {status === 'playing' && question && phase === 'steps' && currentStep && !showRoundIntro && !(allStepsComplete && waitingForOpponentToCompleteSteps) && (
              <div className="w-full max-w-6xl">
                <StepCard
                  stepIndex={currentStepIndex}
                  totalSteps={totalSteps ?? 0}
                  segment={currentSegment}
                  subStepIndex={currentSubStepIndex}
                  prompt={(currentStep as any).prompt || (currentStep as any).question || ''}
                  diagramSmiles={(currentStep as any).diagramSmiles || (currentStep as any).diagram_smiles || null}
                  diagramImageUrl={(currentStep as any).diagramImageUrl || (currentStep as any).diagram_image_url || null}
                  graph={(currentStep as any).graph || null}
                  options={(currentStep as any).options}
                  answerSubmitted={answerSubmitted}
                  disabled={
                    answerSubmitted ||
                    !isWebSocketConnected ||
                    (stepSegmentTimeLeft !== null && stepSegmentTimeLeft <= 0)
                  }
                  onSelectOption={(idx) => submitStepAnswer(currentStepIndex, idx)}
                />
              </div>
            )}

            {/* WAITING FOR OPPONENT TO COMPLETE ALL STEPS */}
            {status === 'playing' && phase === 'steps' && allStepsComplete && waitingForOpponentToCompleteSteps && (
              <motion.div
                key="waiting-steps"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="w-full max-w-2xl paper-card text-center"
              >
                <div className="mb-6">
                  <Loader2 className="w-16 h-16 animate-spin text-blue-400 mx-auto mb-4" />
                  <h2 className="text-3xl font-bold mb-2 tracking-tight">
                    ALL PARTS COMPLETE
                  </h2>
                  <p className="text-slate-600 font-mono text-sm mb-4">
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
            {status === 'playing' && question && phase === 'question' && !showRoundIntro && (
              <div className="w-full max-w-6xl">
                <SingleStepCard
                  questionText={
                    (question as any).stem ||
                    (question as any).questionText ||
                    (question as any).text ||
                    ''
                  }
                  imageUrl={(question as any).imageUrl || (question as any).image_url || null}
                  structureSmiles={(question as any).structureSmiles || (question as any).structure_smiles || null}
                  graph={(question as any).graph || null}
                  options={(question as any).steps?.[0]?.options}
                  answerSubmitted={answerSubmitted}
                  onSelectOption={(idx) => submitAnswer(idx)}
                />
              </div>
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
                className="w-full max-w-4xl paper-card text-center"
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
                    <div className="inline-block p-4 rounded-full bg-slate-100 mb-4 ring-4 ring-slate-200">
                      <Clock className="w-12 h-12 text-slate-600" />
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
                      <p className="text-slate-600 font-mono text-sm">
                        {matchWinnerId === currentUser ? 'VICTORY ACHIEVED!' : 'BETTER LUCK NEXT TIME.'}
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-4xl font-bold mb-2 tracking-tight">
                        {results.round_winner === currentUser ? 'ROUND SECURED' : results.round_winner === null ? 'STALEMATE' : 'ROUND LOST'}
                      </h2>
                      <div className="text-sm text-slate-600 font-mono mb-2">
                        Round {currentRoundNumber || 1} of {targetRoundsToWin || 4} needed
                      </div>
                      {results.p1Score !== undefined && results.p2Score !== undefined && (
                        <div className="text-lg font-bold mb-2">
                          Round Score: {isPlayer1 ? formatPoints(results.p1Score) : formatPoints(results.p2Score)} - {isPlayer1 ? formatPoints(results.p2Score) : formatPoints(results.p1Score)}
                        </div>
                      )}
                      <div className="text-sm font-bold mb-2">
                        Match Score: {isPlayer1 ? (playerRoundWins?.[currentUser || ''] || 0) : (playerRoundWins?.[opponentId || ''] || 0)} - {isPlayer1 ? (playerRoundWins?.[opponentId || ''] || 0) : (playerRoundWins?.[currentUser || ''] || 0)}
                      </div>
                      <p className="text-slate-600 font-mono text-sm">
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
                      const isPartCorrect = (sr: any, forPlayer1: boolean) => {
                        const partCorrect = forPlayer1 ? sr?.p1PartCorrect : sr?.p2PartCorrect;
                        if (typeof partCorrect === 'boolean') return partCorrect;
                        const ans = forPlayer1 ? sr?.p1AnswerIndex : sr?.p2AnswerIndex;
                        const correct = sr?.correctAnswer;
                        return ans !== null && ans !== undefined && correct !== null && correct !== undefined && ans === correct;
                      };

                      const myPartsCorrect = results.stepResults.filter((sr) => isPartCorrect(sr, !!isPlayer1)).length;
                      const oppPartsCorrect = results.stepResults.filter((sr) => isPartCorrect(sr, !isPlayer1)).length;

                      const totalSteps = results.stepResults.length;
                      const isTie = (results.round_winner ?? null) === null;
                      const iWon = !isTie && results.round_winner === currentUser;
                      
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
                              <div className="text-xs font-mono text-slate-700 mb-2 uppercase tracking-wider opacity-70">YOU</div>
                              <div className={`text-5xl md:text-6xl font-black mb-2 ${
                                iWon ? 'text-green-400' : isTie ? 'text-blue-400' : 'text-red-400'
                              }`}>
                                {myPartsCorrect} out of {totalSteps}
                              </div>
                              <div className="text-sm text-slate-700 font-mono opacity-70">
                                {myPartsCorrect === totalSteps ? 'Perfect!' : `${totalSteps - myPartsCorrect} incorrect`}
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
                              <div className="text-xs font-mono text-slate-700 mb-2 uppercase tracking-wider opacity-70">OPPONENT</div>
                              <div className={`text-5xl md:text-6xl font-black mb-2 ${
                                !iWon && !isTie ? 'text-green-400' : isTie ? 'text-blue-400' : 'text-red-400'
                              }`}>
                                {oppPartsCorrect} out of {totalSteps}
                              </div>
                              <div className="text-sm text-slate-700 font-mono opacity-70">
                                {oppPartsCorrect === totalSteps ? 'Perfect!' : `${totalSteps - oppPartsCorrect} incorrect`}
                              </div>
                            </motion.div>
                          </div>
                          
                          {/* Divider */}
                          <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-300 to-transparent mb-6" />
                          
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
                            <summary className="text-sm font-mono text-slate-600 mb-3 uppercase tracking-wider cursor-pointer hover:text-slate-900 transition-colors">
                              Step Breakdown
                            </summary>
                            <div className="space-y-2 mt-3">
                              {results.stepResults.map((stepResult, idx) => {
                                    const myCorrect = isPartCorrect(stepResult, !!isPlayer1);
                                    const myMarks = isPlayer1
                                      ? (stepResult.p1StepAwarded ?? stepResult.p1Marks ?? 0)
                                      : (stepResult.p2StepAwarded ?? stepResult.p2Marks ?? 0);
                                    const mySubPoints = isPlayer1
                                      ? (stepResult.p1SubPoints ?? 0)
                                      : (stepResult.p2SubPoints ?? 0);

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
                                            {myCorrect ? '✓' : '✗'} {myMarks} / {formatPoints(mySubPoints)} pts
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
                          // Handle both boolean (0/1) and multi-option (0-3) answers
                          const answerDisplay = myAnswer !== null && myAnswer !== undefined 
                            ? (myAnswer === 0 ? 'A' : myAnswer === 1 ? 'B' : myAnswer === 2 ? 'C' : myAnswer === 3 ? 'D' : String(myAnswer))
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
                          // Handle both boolean (0/1) and multi-option (0-3) answers
                          const answerDisplay = oppAnswer !== null && oppAnswer !== undefined 
                            ? (oppAnswer === 0 ? 'A' : oppAnswer === 1 ? 'B' : oppAnswer === 2 ? 'C' : oppAnswer === 3 ? 'D' : String(oppAnswer))
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
                    <div className="text-xs text-slate-600 font-mono">
                      player1_answer: {results.player1_answer ?? 'null'} | 
                      player2_answer: {results.player2_answer ?? 'null'} | 
                      round_winner: {results.round_winner ?? 'null'}
                    </div>
                  </div>
                )}

                {matchOver && (
                  <div className="mt-4">
                    <button
                      onClick={() => navigate(`/match-results/${matchId}`)}
                      className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-full border border-black/20 transition-colors active:scale-[0.99]"
                    >
                      VIEW MATCH RESULTS
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
                  onClick={() => navigate('/matchmaking-new')}
                  className="px-8 py-4 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
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