import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Award,
  Shield,
  Sparkles,
  Star,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import RankBadge from '@/components/RankBadge';
import { ScienceText } from '@/components/chem/ScienceText';
import { Rank, UserRankData, getNextRank, getRankByPoints } from '@/types/ranking';
import { RankProgressRing } from '@/components/RankProgressRing';
import { ResultsPatternBackground } from '@/components/ResultsPatternBackground';
import { cn } from '@/lib/utils';

interface MatchStats {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  playerScore: number;
  opponentScore: number;
  pointsEarned: number;
  won: boolean;
  outcome?: 'win' | 'loss' | 'draw';
}

interface StepMatchStats {
  totalQuestions: number;
  totalSteps: number;
  playerMarks: number;
  opponentMarks: number;
  totalPossibleMarks: number;
  accuracy: number;
  won: boolean;
}

interface QuestionReportRow {
  round_index: number;
  question_id: string;
  title: string;
  stem: string;
  p1_correct_parts: number;
  p1_total_parts: number;
  p2_correct_parts: number;
  p2_total_parts: number;
}

interface PostMatchResultsProps {
  matchStats: MatchStats;
  userData: UserRankData;
  onContinue: () => void;
  onPlayAgain?: () => void;
  stepStats?: StepMatchStats;
  questionReport?: QuestionReportRow[];
  reportLoading?: boolean;
  isPlayer1?: boolean;
  isBotMatch?: boolean;
  botMinAccuracyPct?: number;
  challengeLabel?: string;
}

type RankDeltaState = 'up' | 'down' | 'steady';

const clampPct = (value: number): number => Math.max(0, Math.min(100, value));

const getProgressPct = (points: number, rank: Rank): number => {
  const range = Math.max(1, rank.maxPoints - rank.minPoints);
  return clampPct(((points - rank.minPoints) / range) * 100);
};

const formatSigned = (value: number): string => `${value > 0 ? '+' : ''}${value}`;

function useAnimatedNumber({
  from,
  to,
  active,
  duration = 1200,
}: {
  from: number;
  to: number;
  active: boolean;
  duration?: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [value, setValue] = useState(from);

  useEffect(() => {
    if (!active) {
      setValue(from);
      return;
    }

    if (prefersReducedMotion || from === to) {
      setValue(to);
      return;
    }

    let frame = 0;
    const startedAt = performance.now();
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

    setValue(from);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const nextValue = Math.round(from + (to - from) * easeOutQuart(progress));
      setValue(nextValue);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, duration, from, prefersReducedMotion, to]);

  return value;
}

function SectionCard({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 md:p-6 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.32)]',
        className,
      )}
    >
      <div className="mb-4 space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/45">{eyebrow}</div>
        <h3 className="text-lg font-semibold text-white/90">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function MetricTile({
  label,
  value,
  helper,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  helper?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">{label}</div>
      <div className={cn('mt-2 text-2xl font-black tracking-tight', valueClassName ?? 'text-white')}>{value}</div>
      {helper ? <div className="mt-1 text-xs text-white/45">{helper}</div> : null}
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-white/55">{label}</span>
      <span className={cn('font-medium', valueClassName ?? 'text-white/90')}>{value}</span>
    </div>
  );
}

const PostMatchResults: React.FC<PostMatchResultsProps> = ({
  matchStats,
  userData,
  onContinue,
  onPlayAgain,
  stepStats,
  questionReport = [],
  reportLoading = false,
  isPlayer1 = false,
  isBotMatch = false,
  botMinAccuracyPct = 65,
  challengeLabel = 'Solo Challenge',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [showHeader, setShowHeader] = useState(false);
  const [showPoints, setShowPoints] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const previousPoints = userData.currentPoints - matchStats.pointsEarned;
  const previousRank = getRankByPoints(previousPoints);
  const currentRank = getRankByPoints(userData.currentPoints);
  const nextRank = getNextRank(currentRank);
  const currentRankName = { tier: currentRank.tier, subRank: currentRank.subRank } as const;
  const previousRankName = { tier: previousRank.tier, subRank: previousRank.subRank } as const;

  const accuracy = matchStats.totalQuestions > 0
    ? Math.floor((matchStats.correctAnswers / matchStats.totalQuestions) * 100)
    : 0;
  const thresholdDelta = accuracy - botMinAccuracyPct;
  const scoreDelta = matchStats.playerScore - matchStats.opponentScore;
  const outcome = matchStats.outcome ?? (matchStats.won ? 'win' : 'loss');

  const rankDeltaState: RankDeltaState =
    currentRank.tier !== previousRank.tier || currentRank.subRank !== previousRank.subRank
      ? userData.currentPoints > previousPoints
        ? 'up'
        : 'down'
      : 'steady';

  const progressInCurrentRank = nextRank ? getProgressPct(userData.currentPoints, currentRank) : 100;
  const previousProgressInRank = nextRank
    ? rankDeltaState === 'up'
      ? 0
      : rankDeltaState === 'down'
        ? 100
        : getProgressPct(previousPoints, currentRank)
    : 100;
  const pointsToNextRank = nextRank ? Math.max(0, nextRank.minPoints - userData.currentPoints) : 0;

  const animatedPoints = useAnimatedNumber({
    from: 0,
    to: matchStats.pointsEarned,
    active: showPoints,
    duration: 900,
  });
  const animatedXp = useAnimatedNumber({
    from: previousPoints,
    to: userData.currentPoints,
    active: showProgress,
    duration: 1500,
  });

  useEffect(() => {
    if (prefersReducedMotion) {
      setShowHeader(true);
      setShowPoints(true);
      setShowProgress(true);
      setShowDetails(true);
      setShowActions(true);
      return;
    }

    setShowHeader(false);
    setShowPoints(false);
    setShowProgress(false);
    setShowDetails(false);
    setShowActions(false);

    const timers = [
      setTimeout(() => setShowHeader(true), 140),
      setTimeout(() => setShowPoints(true), 320),
      setTimeout(() => setShowProgress(true), 560),
      setTimeout(() => setShowDetails(true), 900),
      setTimeout(() => setShowActions(true), 1180),
    ];

    return () => timers.forEach(clearTimeout);
  }, [prefersReducedMotion]);

  const modeLabel = isBotMatch ? challengeLabel : stepStats ? 'Step Battle' : 'Ranked Match';
  const outcomeTitle = isBotMatch
    ? matchStats.won
      ? `${challengeLabel} Cleared`
      : `${challengeLabel} Failed`
    : outcome === 'draw'
      ? 'Draw'
      : matchStats.won
        ? 'Victory'
        : 'Defeat';

  const outcomeSubtitle = isBotMatch
    ? matchStats.won
      ? `You cleared the ${botMinAccuracyPct}% threshold with ${accuracy}% accuracy and banked ${Math.max(matchStats.pointsEarned, 0)} rank points.`
      : `You landed ${accuracy}% accuracy, ${Math.abs(thresholdDelta)}% short of the ${botMinAccuracyPct}% line this run.`
    : outcome === 'draw'
      ? `The scoreboard finished level at ${matchStats.playerScore}-${matchStats.opponentScore}. Accuracy kept the ladder pressure on.`
      : matchStats.won
        ? `You closed the match ${matchStats.playerScore}-${matchStats.opponentScore} with ${accuracy}% accuracy and momentum on your side.`
        : `The match ended ${matchStats.playerScore}-${matchStats.opponentScore}. You still converted ${accuracy}% of your answers and can recover the swing next run.`;

  const tone = useMemo(() => {
    if (outcome === 'draw') {
      return {
        accentClass: 'text-amber-200',
        emphasisClass: 'text-white',
        borderClass: 'border-amber-300/20',
        softSurfaceClass: 'bg-amber-400/10',
        deltaClass: 'text-amber-200',
        glow: 'rgba(245,158,11,0.28)',
        heroGlow: [
          'radial-gradient(900px 540px at 18% 18%, rgba(245,158,11,0.15) 0%, transparent 62%)',
          'radial-gradient(840px 520px at 82% 18%, rgba(250,204,21,0.12) 0%, transparent 60%)',
          'radial-gradient(900px 640px at 50% 85%, rgba(56,189,248,0.10) 0%, transparent 64%)',
        ].join(','),
        icon: Swords,
      };
    }

    if (matchStats.won) {
      return {
        accentClass: 'text-emerald-200',
        emphasisClass: 'text-amber-100',
        borderClass: 'border-emerald-300/20',
        softSurfaceClass: 'bg-emerald-400/10',
        deltaClass: matchStats.pointsEarned >= 0 ? 'text-emerald-200' : 'text-amber-200',
        glow: 'rgba(34,197,94,0.28)',
        heroGlow: [
          'radial-gradient(920px 560px at 16% 18%, rgba(250,204,21,0.14) 0%, transparent 64%)',
          'radial-gradient(820px 520px at 82% 22%, rgba(34,197,94,0.16) 0%, transparent 60%)',
          'radial-gradient(900px 640px at 50% 88%, rgba(56,189,248,0.12) 0%, transparent 64%)',
        ].join(','),
        icon: Trophy,
      };
    }

    return {
      accentClass: 'text-rose-200',
      emphasisClass: 'text-amber-100',
      borderClass: 'border-rose-300/20',
      softSurfaceClass: 'bg-rose-400/10',
      deltaClass: 'text-rose-200',
      glow: 'rgba(244,63,94,0.28)',
      heroGlow: [
        'radial-gradient(920px 560px at 16% 18%, rgba(250,204,21,0.12) 0%, transparent 64%)',
        'radial-gradient(820px 520px at 82% 22%, rgba(244,63,94,0.18) 0%, transparent 60%)',
        'radial-gradient(900px 640px at 50% 88%, rgba(56,189,248,0.08) 0%, transparent 64%)',
      ].join(','),
      icon: Target,
    };
  }, [matchStats.pointsEarned, matchStats.won, outcome]);

  const rankStateMeta = useMemo(() => {
    if (rankDeltaState === 'up') {
      return {
        label: 'Promotion secured',
        headline: `Now ${currentRank.displayName}`,
        detail: `${previousRank.displayName} -> ${currentRank.displayName}`,
        icon: TrendingUp,
        className: 'text-emerald-200',
        surfaceClass: 'border-emerald-300/20 bg-emerald-400/10',
      };
    }

    if (rankDeltaState === 'down') {
      return {
        label: 'Rank adjusted',
        headline: `Back to ${currentRank.displayName}`,
        detail: `${previousRank.displayName} -> ${currentRank.displayName}`,
        icon: TrendingDown,
        className: 'text-rose-200',
        surfaceClass: 'border-rose-300/20 bg-rose-400/10',
      };
    }

    return {
      label: 'Rank held',
      headline: nextRank ? `${pointsToNextRank} RP to ${nextRank.displayName}` : 'Top rank maintained',
      detail: nextRank ? 'Keep the streak alive to climb again.' : 'You are already sitting at the cap.',
      icon: Shield,
      className: 'text-white',
      surfaceClass: 'border-white/12 bg-white/5',
    };
  }, [currentRank.displayName, nextRank, pointsToNextRank, previousRank.displayName, rankDeltaState]);

  const rankJourneyCopy =
    rankDeltaState === 'up'
      ? `You broke through ${previousRank.displayName} and landed in ${currentRank.displayName}.`
      : rankDeltaState === 'down'
        ? `This result moved you out of ${previousRank.displayName}. A sharp recovery puts you straight back in the climb.`
        : nextRank
          ? `You held ${currentRank.displayName}. ${pointsToNextRank} more RP unlocks ${nextRank.displayName}.`
          : 'You are already sitting at the top of the ladder.';

  const heroHighlights = useMemo(() => {
    const chips: Array<{
      label: string;
      icon: React.ComponentType<{ className?: string; size?: number }>;
      className: string;
    }> = [];

    if (isBotMatch) {
      chips.push(
        matchStats.won
          ? {
              label: 'Threshold Cleared',
              icon: Trophy,
              className: 'border-emerald-300/20 bg-emerald-400/12 text-emerald-100',
            }
          : {
              label: 'Below Threshold',
              icon: Target,
              className: 'border-rose-300/20 bg-rose-400/12 text-rose-100',
            },
      );
    } else if (outcome === 'draw') {
      chips.push({
        label: 'Dead Heat',
        icon: Swords,
        className: 'border-amber-300/20 bg-amber-400/12 text-amber-100',
      });
    } else if (Math.abs(scoreDelta) <= 1) {
      chips.push({
        label: 'Photo Finish',
        icon: Zap,
        className: 'border-amber-300/20 bg-amber-400/12 text-amber-100',
      });
    } else if (matchStats.won) {
      chips.push({
        label: 'Scoreboard Control',
        icon: Award,
        className: 'border-sky-300/20 bg-sky-400/12 text-sky-100',
      });
    }

    if (matchStats.wrongAnswers === 0) {
      chips.push({
        label: 'Perfect Run',
        icon: Star,
        className: 'border-amber-300/20 bg-amber-400/12 text-amber-100',
      });
    }

    if (rankDeltaState === 'up') {
      chips.push({
        label: 'Rank Up',
        icon: Sparkles,
        className: 'border-emerald-300/20 bg-emerald-400/12 text-emerald-100',
      });
    } else if (rankDeltaState === 'down') {
      chips.push({
        label: 'Rank Down',
        icon: TrendingDown,
        className: 'border-rose-300/20 bg-rose-400/12 text-rose-100',
      });
    }

    return chips.slice(0, 3);
  }, [isBotMatch, matchStats.won, matchStats.wrongAnswers, outcome, rankDeltaState, scoreDelta]);

  const performanceTiles = isBotMatch
    ? [
        {
          label: 'Accuracy',
          value: `${accuracy}%`,
          helper: thresholdDelta >= 0 ? `${thresholdDelta}% above target` : `${Math.abs(thresholdDelta)}% below target`,
          valueClassName: thresholdDelta >= 0 ? 'text-emerald-100' : 'text-rose-100',
        },
        {
          label: 'Correct',
          value: `${matchStats.correctAnswers}/${matchStats.totalQuestions}`,
          helper: 'Answers converted',
          valueClassName: 'text-white',
        },
        {
          label: 'Wrong',
          value: matchStats.wrongAnswers,
          helper: 'Missed answers',
          valueClassName: 'text-white',
        },
        {
          label: 'Threshold',
          value: `≥${botMinAccuracyPct}%`,
          helper: matchStats.won ? 'Requirement met' : 'Target line',
          valueClassName: 'text-amber-100',
        },
      ]
    : [
        {
          label: 'Your Score',
          value: matchStats.playerScore,
          helper: 'Points secured',
          valueClassName: 'text-sky-100',
        },
        {
          label: 'Opponent',
          value: matchStats.opponentScore,
          helper: 'Enemy score',
          valueClassName: 'text-white',
        },
        {
          label: 'Margin',
          value: `${scoreDelta > 0 ? '+' : scoreDelta < 0 ? '-' : '±'}${Math.abs(scoreDelta)}`,
          helper: outcome === 'draw' ? 'Even finish' : scoreDelta > 0 ? 'Ahead on scoreboard' : 'Scoreline gap',
          valueClassName: scoreDelta > 0 ? 'text-emerald-100' : scoreDelta < 0 ? 'text-rose-100' : 'text-amber-100',
        },
        {
          label: 'Accuracy',
          value: `${accuracy}%`,
          helper: `${matchStats.correctAnswers}/${matchStats.totalQuestions} correct`,
          valueClassName: 'text-white',
        },
      ];

  const heroSummaryTiles = [
    {
      label: 'Mode',
      value: modeLabel,
      helper: isBotMatch ? 'Ranked campaign run' : 'Shared ranked arena',
      valueClassName: 'text-white',
    },
    {
      label: 'Questions',
      value: matchStats.totalQuestions,
      helper: isBotMatch ? 'Challenge prompts faced' : 'Scoreable rounds played',
      valueClassName: 'text-white',
    },
    {
      label: 'Accuracy',
      value: `${accuracy}%`,
      helper: `${matchStats.correctAnswers}/${matchStats.totalQuestions} converted`,
      valueClassName: tone.accentClass,
    },
  ];

  const OutcomeIcon = tone.icon;
  const RankStateIcon = rankStateMeta.icon;

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 text-white md:px-8 md:py-10">
      <ResultsPatternBackground outcome={outcome} />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {!prefersReducedMotion && (
          <>
            <motion.div
              className="absolute left-[10%] top-[16%] h-40 w-40 rounded-full bg-amber-300/12 blur-[110px]"
              animate={{ y: [0, -20, 6, 0], x: [0, 10, -8, 0], opacity: [0.35, 0.55, 0.4, 0.35] }}
              transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute bottom-[10%] right-[12%] h-56 w-56 rounded-full bg-sky-300/10 blur-[140px]"
              animate={{ y: [0, 16, -10, 0], x: [0, -12, 8, 0], opacity: [0.28, 0.45, 0.3, 0.28] }}
              transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        )}
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="grid gap-4 lg:grid-cols-[1.25fr_320px] lg:items-end">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={showHeader ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            <div
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.36em] text-white/75 backdrop-blur-xl',
                tone.borderClass,
                tone.softSurfaceClass,
              )}
            >
              <OutcomeIcon size={14} className={tone.accentClass} />
              {modeLabel}
            </div>

            <div className="space-y-3">
              <h1 className={cn('text-5xl font-black uppercase tracking-[0.08em] md:text-7xl', tone.accentClass)}>
                {outcomeTitle}
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-white/68 md:text-base">{outcomeSubtitle}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 18 }}
            animate={showPoints ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.95, y: 18 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-black/25 p-5 backdrop-blur-2xl"
            style={{ boxShadow: `0 0 40px ${tone.glow}` }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: [
                  'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.01) 100%)',
                  'radial-gradient(circle at 20% 20%, rgba(250,204,21,0.14) 0%, transparent 48%)',
                  'radial-gradient(circle at 82% 22%, rgba(56,189,248,0.12) 0%, transparent 54%)',
                ].join(','),
              }}
            />
            <div className="relative z-10">
              <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/45">
                {matchStats.pointsEarned > 0 ? 'Rank points gained' : matchStats.pointsEarned < 0 ? 'Rank points lost' : 'Rank points held'}
              </div>
              <div className={cn('mt-3 text-5xl font-black tracking-tight md:text-6xl', tone.deltaClass)}>
                {formatSigned(animatedPoints)}
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-white/55">
                <span className="tabular-nums">{previousPoints}</span>
                <ArrowRight size={14} className="text-white/35" />
                <span className="tabular-nums text-white/85">{userData.currentPoints}</span>
              </div>
              <div className="mt-1 text-xs text-white/40">Live ladder rating after match resolution.</div>
            </div>
          </motion.div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 28 }}
          animate={showProgress ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[2.75rem] border border-white/10 bg-black/20 px-5 py-8 backdrop-blur-[28px] md:px-8 md:py-10"
        >
          <div className="pointer-events-none absolute inset-0" style={{ background: tone.heroGlow }} />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div className="relative z-10 space-y-6 md:space-y-8">
            <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
              <div
                className={cn(
                  'relative overflow-hidden rounded-[2rem] border p-5 shadow-[0_16px_48px_rgba(0,0,0,0.24)] md:p-6',
                  rankStateMeta.surfaceClass,
                )}
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_70%)]" />
                <div className="relative z-10 flex flex-col gap-5">
                  <div className="flex items-start gap-4">
                    <div className={cn('mt-1 rounded-[1.25rem] border border-white/12 bg-black/20 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.25)]', rankStateMeta.surfaceClass)}>
                      <RankStateIcon size={22} className={rankStateMeta.className} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
                        {rankDeltaState === 'up' ? 'Promotion Moment' : rankDeltaState === 'down' ? 'Ladder Update' : 'Rank Status'}
                      </div>
                      <div className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
                        {rankStateMeta.headline}
                      </div>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-white/64">{rankJourneyCopy}</p>
                    </div>
                  </div>

                  {heroHighlights.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {heroHighlights.map((chip) => {
                        const Icon = chip.icon;
                        return (
                          <div
                            key={chip.label}
                            className={cn(
                              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] backdrop-blur-xl',
                              chip.className,
                            )}
                          >
                            <Icon size={14} />
                            {chip.label}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5 backdrop-blur-2xl md:p-6">
                {rankDeltaState === 'steady' ? (
                  <div className="flex h-full flex-col justify-between gap-5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/45">Current Position</div>
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <RankBadge rank={currentRankName} size="lg" />
                        <div>
                          <div className="text-2xl font-black text-white">{currentRank.displayName}</div>
                          <div className="mt-1 text-sm text-white/55">{userData.currentPoints} RP after this result</div>
                        </div>
                      </div>
                      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-left">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">
                          {nextRank ? 'Next unlock' : 'Ladder cap'}
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {nextRank ? nextRank.displayName : 'Maximum tier held'}
                        </div>
                        <div className="mt-1 text-sm text-white/55">
                          {nextRank ? `${pointsToNextRank} RP remaining` : 'No higher promotion is available.'}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col gap-5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/45">
                      {rankDeltaState === 'up' ? 'Promotion Confirmed' : 'Rank Shift'}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-center sm:text-left">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/40">Before</div>
                        <div className="mt-4 flex justify-center sm:justify-start">
                          <RankBadge rank={previousRankName} size="md" />
                        </div>
                        <div className="mt-3 text-xl font-bold text-white">{previousRank.displayName}</div>
                        <div className="text-sm text-white/50">{previousPoints} RP</div>
                      </div>

                      <div className="flex justify-center">
                        <div className="rounded-full border border-white/10 bg-white/[0.05] p-3 text-white/70 shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
                          <ArrowRight size={22} />
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4 text-center sm:text-left">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/40">After</div>
                        <div className="mt-4 flex justify-center sm:justify-start">
                          <RankBadge rank={currentRankName} size="xl" showAnimation={rankDeltaState === 'up'} />
                        </div>
                        <div className="mt-3 text-2xl font-black text-white">{currentRank.displayName}</div>
                        <div className={cn('text-sm font-semibold', tone.deltaClass)}>
                          {formatSigned(matchStats.pointsEarned)} RP this result
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid items-center gap-6 xl:grid-cols-[250px_minmax(0,1fr)_250px]">
              <div className="rounded-[1.85rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">Run Snapshot</div>
                <div className="mt-5 space-y-3">
                  <InfoRow label="Mode" value={modeLabel} />
                  <InfoRow label="Outcome" value={outcomeTitle} valueClassName={tone.accentClass} />
                  <InfoRow label="Accuracy" value={`${accuracy}%`} valueClassName={tone.accentClass} />
                  <InfoRow
                    label={isBotMatch ? 'Threshold' : 'Score'}
                    value={isBotMatch ? `≥${botMinAccuracyPct}%` : `${matchStats.playerScore}-${matchStats.opponentScore}`}
                    valueClassName="text-white"
                  />
                </div>

                <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">
                    {matchStats.pointsEarned > 0 ? 'Rating swing' : matchStats.pointsEarned < 0 ? 'Rating dip' : 'Rating held'}
                  </div>
                  <div className={cn('mt-2 text-3xl font-black tracking-tight', tone.deltaClass)}>
                    {formatSigned(matchStats.pointsEarned)} RP
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/55">
                    {matchStats.pointsEarned > 0
                      ? 'You banked ladder progress and pushed the emblem forward.'
                      : matchStats.pointsEarned < 0
                        ? 'The ladder dipped this run, but the next result can immediately stabilize it.'
                        : 'Your rating held steady on this result.'}
                  </p>
                </div>
              </div>

              <div className="relative flex flex-col items-center justify-center gap-6 text-center">
                <div className="space-y-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/45">Current Rank</div>
                  <div className="text-4xl font-black tracking-tight md:text-5xl" style={{ color: currentRank.color }}>
                    {currentRank.displayName}
                  </div>
                  <p className="mx-auto max-w-2xl text-sm leading-7 text-white/58">{rankJourneyCopy}</p>
                </div>

                <RankProgressRing
                  rank={currentRankName}
                  points={animatedXp}
                  progressPct={progressInCurrentRank}
                  initialProgressPct={previousProgressInRank}
                  animate={showProgress}
                  size="hero"
                  pointsLabel="RP"
                />

                <div className="w-full max-w-xl rounded-[1.85rem] border border-white/10 bg-black/20 p-5 shadow-[0_14px_40px_rgba(0,0,0,0.18)]">
                  <div className="flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
                    <span className="text-white/55">
                      {nextRank ? `${Math.round(progressInCurrentRank)}% charged toward ${nextRank.displayName}` : 'Final rank cap reached'}
                    </span>
                    <span className="font-semibold text-white/90">
                      {nextRank ? `${pointsToNextRank} RP remaining` : 'No higher tier available'}
                    </span>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: currentRank.gradient }}
                      initial={{ width: prefersReducedMotion ? `${progressInCurrentRank}%` : `${previousProgressInRank}%` }}
                      animate={{ width: `${progressInCurrentRank}%` }}
                      transition={{ duration: prefersReducedMotion ? 0 : 1.3, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>

                <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
                  {heroSummaryTiles.map((tile) => (
                    <MetricTile
                      key={tile.label}
                      label={tile.label}
                      value={tile.value}
                      helper={tile.helper}
                      valueClassName={tile.valueClassName}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-[1.85rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">
                  {nextRank ? 'Next Target' : 'Peak Ladder'}
                </div>
                {nextRank ? (
                  <div className="mt-4 flex flex-col items-center gap-4 text-center">
                    <RankBadge rank={{ tier: nextRank.tier, subRank: nextRank.subRank }} size="lg" />
                    <div>
                      <div className="text-2xl font-black text-white">{nextRank.displayName}</div>
                      <div className="mt-1 text-sm text-white/50">{nextRank.minPoints} RP unlock threshold</div>
                    </div>
                    <div className="w-full rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-left">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">Climb note</div>
                      <div className="mt-2 text-sm leading-6 text-white/58">
                        {pointsToNextRank === 0
                          ? 'You are sitting on the promotion line. One more positive result locks it in.'
                          : `${pointsToNextRank} RP still separates you from the next emblem.`}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                    <div className="text-xl font-black text-white">Max Rank Secured</div>
                    <div className="mt-2 text-sm leading-6 text-white/55">
                      You are already sitting at the highest visible tier on the shared ladder.
                    </div>
                  </div>
                )}

                <div className="mt-5 space-y-3">
                  <InfoRow label="Current rating" value={`${userData.currentPoints} RP`} valueClassName="text-white" />
                  <InfoRow
                    label={nextRank ? 'Remaining' : 'Status'}
                    value={nextRank ? `${pointsToNextRank} RP` : 'Maximum tier'}
                    valueClassName="text-white"
                  />
                  <InfoRow label="Previous rank" value={previousRank.displayName} valueClassName="text-white/80" />
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={showDetails ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-4 xl:grid-cols-[1.05fr_1.2fr]"
        >
          <SectionCard
            eyebrow={isBotMatch ? `${challengeLabel} Breakdown` : 'Match Breakdown'}
            title={isBotMatch ? 'Run Overview' : 'Score Overview'}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {performanceTiles.map((tile) => (
                <MetricTile
                  key={tile.label}
                  label={tile.label}
                  value={tile.value}
                  helper={tile.helper}
                  valueClassName={tile.valueClassName}
                />
              ))}
            </div>

            {isBotMatch ? (
              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.28em] text-white/45">
                  <span>Threshold line</span>
                  <span>≥{botMinAccuracyPct}%</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className={cn('h-full rounded-full', thresholdDelta >= 0 ? 'bg-emerald-300' : 'bg-rose-300')}
                    initial={{ width: 0 }}
                    animate={{ width: `${clampPct(accuracy)}%` }}
                    transition={{ duration: prefersReducedMotion ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <div className="relative mt-2">
                  <div
                    className="absolute top-[-14px] h-6 w-px bg-white/35"
                    style={{ left: `${clampPct(botMinAccuracyPct)}%` }}
                  />
                </div>
                <p className="mt-5 text-sm text-white/58">
                  {thresholdDelta >= 0
                    ? `You finished ${thresholdDelta}% above the challenge requirement.`
                    : `You ended ${Math.abs(thresholdDelta)}% short of the challenge requirement.`}
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">Scoreline</div>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div>
                    <div className="text-3xl font-black text-sky-100">{matchStats.playerScore}</div>
                    <div className="text-xs uppercase tracking-[0.22em] text-white/45">You</div>
                  </div>
                  <div className="pb-2 text-xs uppercase tracking-[0.28em] text-white/35">vs</div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-white">{matchStats.opponentScore}</div>
                    <div className="text-xs uppercase tracking-[0.22em] text-white/45">Opponent</div>
                  </div>
                </div>
                <div className="mt-4 text-sm text-white/58">
                  {outcome === 'draw'
                    ? 'Neither side pulled ahead on the board.'
                    : scoreDelta > 0
                      ? `You finished ${Math.abs(scoreDelta)} point${Math.abs(scoreDelta) === 1 ? '' : 's'} ahead.`
                      : `Opponent finished ${Math.abs(scoreDelta)} point${Math.abs(scoreDelta) === 1 ? '' : 's'} ahead.`}
                </div>
              </div>
            )}

            {stepStats ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <MetricTile
                  label="Marks Secured"
                  value={`${stepStats.playerMarks}/${stepStats.totalPossibleMarks}`}
                  helper={`${stepStats.totalSteps} total steps`}
                  valueClassName="text-sky-100"
                />
                <MetricTile
                  label="Opponent Marks"
                  value={stepStats.opponentMarks}
                  helper={`${stepStats.accuracy}% step accuracy`}
                  valueClassName="text-white"
                />
              </div>
            ) : null}
          </SectionCard>

          {isBotMatch ? (
            <SectionCard eyebrow="Next Objective" title={`${challengeLabel} Intel`}>
              <div className="space-y-4">
                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">Result readout</div>
                  <p className="mt-3 text-sm leading-7 text-white/60">
                    {matchStats.won
                      ? `You cleared the gate and converted ${matchStats.correctAnswers} of ${matchStats.totalQuestions} answers. Keep the same pace to continue climbing.`
                      : `You missed the gate this time. Tighten the misses, especially the ${matchStats.wrongAnswers} answers that slipped away, and the next run can still swing the ladder back.`}
                  </p>
                </div>

                <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                  <InfoRow label="Questions answered" value={matchStats.totalQuestions} />
                  <InfoRow label="Rank after run" value={`${userData.currentPoints} RP`} valueClassName="text-white" />
                  <InfoRow
                    label="Next goal"
                    value={nextRank ? `${nextRank.displayName} at ${nextRank.minPoints} RP` : 'Maintain top position'}
                    valueClassName={nextRank ? 'text-amber-100' : 'text-white'}
                  />
                </div>
              </div>
            </SectionCard>
          ) : (
            <SectionCard eyebrow="Question Report" title="Per-Question Breakdown">
              {reportLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-24 animate-pulse rounded-[1.5rem] border border-white/10 bg-white/[0.04]"
                    />
                  ))}
                </div>
              ) : questionReport.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-white/12 bg-black/20 p-6 text-sm text-white/55">
                  Detailed question data is unavailable for this match.
                </div>
              ) : (
                <div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
                  {questionReport.map((row) => {
                    const myCorrectParts = isPlayer1 ? row.p1_correct_parts : row.p2_correct_parts;
                    const myTotalParts = isPlayer1 ? row.p1_total_parts : row.p2_total_parts;
                    const oppCorrectParts = isPlayer1 ? row.p2_correct_parts : row.p1_correct_parts;
                    const oppTotalParts = isPlayer1 ? row.p2_total_parts : row.p1_total_parts;
                    const myCorrect = myTotalParts > 0 && myCorrectParts === myTotalParts;
                    const oppCorrect = oppTotalParts > 0 && oppCorrectParts === oppTotalParts;

                    return (
                      <div
                        key={`${row.question_id}-${row.round_index}`}
                        className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <ScienceText text={row.title} className="block text-sm font-semibold text-white/90" />
                            <ScienceText text={row.stem} className="mt-1 block text-xs leading-6 text-white/55" />
                          </div>
                          <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">
                            R{row.round_index + 1}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <div
                            className={cn(
                              'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em]',
                              myCorrect
                                ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
                                : 'border-rose-300/20 bg-rose-400/10 text-rose-100',
                            )}
                          >
                            You • {myCorrectParts}/{myTotalParts}
                          </div>
                          <div
                            className={cn(
                              'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em]',
                              oppCorrect
                                ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
                                : 'border-rose-300/20 bg-rose-400/10 text-rose-100',
                            )}
                          >
                            Opponent • {oppCorrectParts}/{oppTotalParts}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          )}
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={showActions ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center"
        >
          {onPlayAgain ? (
            <Button
              onClick={onPlayAgain}
              className="h-14 rounded-2xl border border-white/10 bg-white/10 px-8 text-sm font-semibold uppercase tracking-[0.28em] text-white shadow-[0_0_30px_rgba(250,204,21,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/15"
            >
              <Zap size={18} className="mr-2" />
              Play Again
            </Button>
          ) : null}

          <Button
            onClick={onContinue}
            className={cn(
              'h-14 rounded-2xl px-8 text-sm font-semibold uppercase tracking-[0.28em] text-slate-950 transition-all duration-300 hover:-translate-y-0.5',
              matchStats.won || outcome === 'draw'
                ? 'bg-amber-300 hover:bg-amber-200'
                : 'bg-rose-200 hover:bg-rose-100',
            )}
          >
            Continue
            <ArrowRight size={18} className="ml-2" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default PostMatchResults;