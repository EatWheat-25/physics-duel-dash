import { useEffect, useId, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { RANKS, type RankName } from '@/types/ranking'

type RingSize = 'sm' | 'md' | 'lg' | 'hero'

const clampPct = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

const sizeConfig: Record<RingSize, { diameter: number | string; strokeWidth: number; iconBox: number }> = {
  sm: { diameter: 124, strokeWidth: 7, iconBox: 58 },
  md: { diameter: 156, strokeWidth: 8, iconBox: 72 },
  lg: { diameter: 196, strokeWidth: 10, iconBox: 96 },
  hero: { diameter: 'clamp(320px, 46vw, 540px)', strokeWidth: 9.5, iconBox: 196 },
}

export function RankProgressRing({
  rank,
  points,
  progressPct,
  initialProgressPct,
  animate = false,
  size = 'md',
  pointsLabel = 'XP',
  className = '',
}: {
  rank: RankName
  points: number
  progressPct: number
  initialProgressPct?: number
  animate?: boolean
  size?: RingSize
  pointsLabel?: string
  className?: string
}) {
  const prefersReducedMotion = useReducedMotion()
  const uid = useId()
  const [shimmerSeq, setShimmerSeq] = useState(0)
  const cfg = sizeConfig[size]
  const isHero = size === 'hero'
  const shouldAnimate = animate && !prefersReducedMotion
  // SVG geometry (viewBox 0..100)
  const radius = 46
  const circumference = 2 * Math.PI * radius
  const dashOffsetForPct = (pct: number) => circumference * (1 - pct / 100)
  const outerTrackWidth = isHero ? cfg.strokeWidth + 4.5 : Math.max(2, cfg.strokeWidth + 3)
  const progressStrokeWidth = isHero ? cfg.strokeWidth + 0.8 : cfg.strokeWidth
  const trailStrokeWidth = isHero ? Math.max(2.4, cfg.strokeWidth - 2.4) : Math.max(1.6, cfg.strokeWidth - 3.4)
  const shimmerStrokeWidth = isHero ? Math.max(3, cfg.strokeWidth - 1.3) : Math.max(2, cfg.strokeWidth - 2)
  const innerGuideRadius = isHero ? radius - 8 : radius - 6
  const innerShellInset = isHero ? 'inset-[5.5%]' : 'inset-[7%]'
  const medallionInset = isHero ? 'inset-[7%]' : 'inset-[10%]'
  const emblemClassName = isHero
    ? 'h-[90%] w-[90%] object-contain drop-shadow-[0_14px_30px_rgba(0,0,0,0.38)]'
    : size === 'lg'
      ? 'h-[76%] w-[76%] object-contain'
      : 'h-2/3 w-2/3 object-contain'

  const rankData = useMemo(() => {
    return RANKS.find((r) => r.tier === rank.tier && r.subRank === rank.subRank) ?? RANKS[0]
  }, [rank.subRank, rank.tier])

  const progress = clampPct(progressPct)
  const previousProgress = clampPct(typeof initialProgressPct === 'number' ? initialProgressPct : progress)

  const gradientId = `rank-ring-grad-${uid}`

  const tickMarks = useMemo(() => {
    return Array.from({ length: 24 }, (_, index) => {
      const angle = ((index / 24) * Math.PI * 2) - Math.PI / 2
      const major = index % 6 === 0
      const inner = major ? radius + 0.6 : radius + 1.8
      const outer = major ? radius + 3.1 : radius + 2.6
      return {
        id: index,
        major,
        x1: 50 + Math.cos(angle) * inner,
        y1: 50 + Math.sin(angle) * inner,
        x2: 50 + Math.cos(angle) * outer,
        y2: 50 + Math.sin(angle) * outer,
      }
    })
  }, [radius])

  useEffect(() => {
    if (!shouldAnimate) return
    setShimmerSeq((prev) => prev + 1)
  }, [shouldAnimate])

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <motion.div
        className="relative isolate"
        style={{ width: cfg.diameter, height: cfg.diameter }}
        animate={shouldAnimate ? { scale: [1, 1.018, 1] } : { scale: 1 }}
        transition={{ duration: 0.55, delay: shouldAnimate ? 1.1 : 0, ease: 'easeOut' }}
      >
        <motion.div
          className="absolute inset-[-10%] rounded-full blur-3xl"
          style={{
            background: `radial-gradient(circle, ${rankData.glowColor} 0%, transparent 68%)`,
          }}
          animate={
            shouldAnimate
              ? { opacity: [0.28, 0.58, 0.34], scale: [0.92, 1.03, 0.97] }
              : { opacity: 0.34, scale: 1 }
          }
          transition={{ duration: 1.45, repeat: shouldAnimate ? Infinity : 0, ease: 'easeInOut' }}
        />

        <div
          className="absolute inset-0 rounded-full border border-white/10"
          style={{
            background: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.12), rgba(255,255,255,0.03) 48%, rgba(0,0,0,0.30) 100%)',
            boxShadow: isHero
              ? '0 28px 70px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.08)'
              : '0 24px 60px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.08)',
            backdropFilter: 'blur(18px)',
          }}
        />
        <div
          className={`absolute ${innerShellInset} rounded-full border border-white/10`}
          style={{
            background: isHero
              ? 'radial-gradient(circle at 50% 38%, rgba(255,255,255,0.12), rgba(255,255,255,0.03) 46%, rgba(0,0,0,0.10) 100%)'
              : 'radial-gradient(circle at 50% 38%, rgba(255,255,255,0.10), rgba(255,255,255,0.02) 46%, rgba(0,0,0,0.08) 100%)',
          }}
        />

        <svg
          className="absolute inset-0"
          viewBox="0 0 100 100"
          style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={rankData.color} stopOpacity="0.95" />
              <stop offset="55%" stopColor="white" stopOpacity="0.35" />
              <stop offset="100%" stopColor={rankData.color} stopOpacity="0.95" />
            </linearGradient>
          </defs>

          <circle
            cx="50"
            cy="50"
            r={radius + 1.2}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={outerTrackWidth}
          />

          {tickMarks.map((tick) => (
            <line
              key={tick.id}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke={tick.major ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.18)'}
              strokeWidth={tick.major ? 0.8 : 0.55}
              strokeLinecap="round"
            />
          ))}

          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth={isHero ? cfg.strokeWidth + 1.8 : cfg.strokeWidth}
          />
          <circle
            cx="50"
            cy="50"
            r={innerGuideRadius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={isHero ? '1.1' : '0.9'}
            strokeDasharray={isHero ? '1.8 5' : '1.5 4.5'}
          />

          <motion.circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={progressStrokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: dashOffsetForPct(previousProgress) }}
            animate={{ strokeDashoffset: dashOffsetForPct(shouldAnimate ? progress : previousProgress) }}
            transition={{ duration: shouldAnimate ? 1.55 : 0, ease: 'easeOut' }}
            style={{
              filter: isHero
                ? `drop-shadow(0 0 14px ${rankData.glowColor}) drop-shadow(0 0 30px ${rankData.glowColor})`
                : `drop-shadow(0 0 10px ${rankData.glowColor}) drop-shadow(0 0 20px ${rankData.glowColor})`,
            }}
          />

          {shouldAnimate && (
            <motion.circle
              key={`trail-${shimmerSeq}`}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.38)"
              strokeWidth={trailStrokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${Math.round(circumference * 0.12)} ${Math.round(circumference * 0.88)}`}
              initial={{ opacity: 0, strokeDashoffset: circumference * 0.08 }}
              animate={{ opacity: [0, 0.55, 0], strokeDashoffset: [circumference * 0.08, -circumference * 0.9] }}
              transition={{ duration: 1.6, ease: 'easeInOut', delay: 0.2 }}
              style={{
                filter: `drop-shadow(0 0 16px ${rankData.glowColor})`,
              }}
            />
          )}

          {shouldAnimate && (
            <motion.circle
              key={`shimmer-${shimmerSeq}`}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.85)"
              strokeWidth={shimmerStrokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${Math.round(circumference * 0.16)} ${Math.round(circumference * 0.84)}`}
              initial={{ opacity: 0, strokeDashoffset: 0 }}
              animate={{ opacity: [0, 0.75, 0], strokeDashoffset: [0, -circumference] }}
              transition={{ duration: 1.5, ease: 'easeInOut' }}
              style={{
                filter: `drop-shadow(0 0 18px ${rankData.glowColor})`,
              }}
            />
          )}
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="relative flex items-center justify-center overflow-hidden rounded-full border border-white/12"
            style={{
              width: cfg.iconBox,
              height: cfg.iconBox,
              background:
                'radial-gradient(circle at 34% 30%, rgba(255,255,255,0.22), rgba(255,255,255,0.05) 42%, rgba(0,0,0,0.46) 100%)',
              boxShadow: isHero
                ? `0 0 52px ${rankData.glowColor}, inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -18px 28px rgba(0,0,0,0.32)`
                : `0 0 40px ${rankData.glowColor}, inset 0 1px 0 rgba(255,255,255,0.12)`,
            }}
          >
            <div className={`absolute ${medallionInset} rounded-full border border-white/10`} />
            {isHero ? (
              <div className="pointer-events-none absolute inset-[4%] rounded-full bg-[radial-gradient(circle_at_32%_24%,rgba(255,255,255,0.16),transparent_42%)]" />
            ) : null}
            {rankData.imageUrl ? (
              <img
                src={rankData.imageUrl}
                alt={rankData.displayName}
                className={emblemClassName}
              />
            ) : (
              <span
                className={
                  isHero
                    ? 'text-7xl md:text-8xl'
                    : size === 'lg'
                      ? 'text-6xl'
                      : size === 'md'
                        ? 'text-5xl'
                        : 'text-4xl'
                }
              >
                {rankData.emoji}
              </span>
            )}
          </motion.div>
        </div>
      </motion.div>

      {isHero ? (
        <div className="mt-7 space-y-2 text-center">
          <div className="flex items-baseline justify-center gap-3">
            <div className="text-5xl font-black text-white tabular-nums tracking-tight drop-shadow-[0_0_18px_rgba(250,204,21,0.10)] md:text-6xl">
              {points}
            </div>
            <div className="text-sm font-semibold uppercase tracking-[0.35em] text-white/60 md:text-base">
              {pointsLabel}
            </div>
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/46">
            {Math.round(progress)}% charged
          </div>
        </div>
      ) : (
        <div className="mt-3 text-sm font-semibold text-white/80 tabular-nums tracking-wide">
          {points} {pointsLabel}
        </div>
      )}
    </div>
  )
}

