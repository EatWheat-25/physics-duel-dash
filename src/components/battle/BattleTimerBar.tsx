import React from 'react'
import { cn } from '@/lib/utils'

type Accent = 'blue' | 'amber' | 'neutral'

const ACCENT_STYLES: Record<
  Accent,
  {
    fill: string
    glow: string
  }
> = {
  blue: {
    fill: 'bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500',
    glow: 'shadow-[0_0_18px_rgba(59,130,246,0.28)]',
  },
  amber: {
    fill: 'bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500',
    glow: 'shadow-[0_0_18px_rgba(245,158,11,0.22)]',
  },
  neutral: {
    fill: 'bg-gradient-to-r from-white/60 via-white/70 to-white/60',
    glow: 'shadow-[0_0_12px_rgba(255,255,255,0.12)]',
  },
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function BattleTimerBar({
  secondsLeft,
  totalSeconds,
  accent = 'blue',
  isLow = false,
  label,
  rightText,
  className,
}: {
  secondsLeft: number | null
  totalSeconds: number
  accent?: Accent
  isLow?: boolean
  label?: string
  rightText?: string
  className?: string
}) {
  if (secondsLeft == null || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return null

  const ratio = clamp01(secondsLeft / totalSeconds)
  const pct = Math.round(ratio * 1000) / 10
  const a = ACCENT_STYLES[accent]

  return (
    <div className={cn('w-full', className)}>
      {(label || rightText) && (
        <div className="mb-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em] text-white/55">
          <span>{label ?? ''}</span>
          <span className="tabular-nums">{rightText ?? ''}</span>
        </div>
      )}

      <div
        className={cn(
          'relative h-3 w-full overflow-hidden rounded-full',
          'bg-white/10 ring-1 ring-white/10',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]'
        )}
        role="progressbar"
        aria-label={label ?? 'Timer'}
        aria-valuemin={0}
        aria-valuemax={totalSeconds}
        aria-valuenow={Math.max(0, Math.min(totalSeconds, secondsLeft))}
      >
        {/* Fill (drains as time passes) */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-linear',
            a.fill,
            a.glow,
            isLow ? 'animate-pulse' : ''
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}


