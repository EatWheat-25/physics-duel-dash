import { cn } from '@/lib/utils'

type Accent = 'blue' | 'amber' | 'neutral'

const ACCENT_STYLES: Record<
  Accent,
  {
    fill: string
  }
> = {
  blue: {
    fill: 'bg-[#00D4FF]',
  },
  amber: {
    fill: 'bg-[#FFD400]',
  },
  neutral: {
    fill: 'bg-[#141318]',
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
        <div className="mb-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em] text-white/65">
          <span>{label ?? ''}</span>
          <span className="tabular-nums">{rightText ?? ''}</span>
        </div>
      )}

      <div
        className={cn(
          'relative h-4 w-full overflow-hidden rounded-full',
          'bg-[#F7F2E7] ring-2 ring-black/80',
          'shadow-[0_2px_0_rgba(0,0,0,0.35)]',
          isLow ? 'ring-red-500/90' : ''
        )}
        role="progressbar"
        aria-label={label ?? 'Timer'}
        aria-valuemin={0}
        aria-valuemax={totalSeconds}
        aria-valuenow={Math.max(0, Math.min(totalSeconds, secondsLeft))}
      >
        {/* Tick marks */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.28] mix-blend-multiply"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to right, rgba(0,0,0,0.32) 0, rgba(0,0,0,0.32) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 12px)',
          }}
        />

        {/* Fill (drains as time passes) */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-linear',
            a.fill,
            isLow ? 'animate-pulse' : ''
          )}
          style={{ width: `${pct}%` }}
        >
          {/* Halftone on the ink */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.18] mix-blend-overlay"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.35) 1px, rgba(0,0,0,0) 1.2px)',
              backgroundSize: '14px 14px',
            }}
          />
          {/* Shine */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.38), rgba(255,255,255,0))',
            }}
          />
        </div>

        {/* Ink outline hint */}
        <div aria-hidden className="absolute inset-0 rounded-full ring-1 ring-black/55" />
      </div>
    </div>
  )
}


