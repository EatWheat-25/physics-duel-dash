import React from 'react'
import { cn } from '@/lib/utils'
import { MathText } from '@/components/math/MathText'

type Accent = 'blue' | 'amber'

const ACCENT: Record<
  Accent,
  {
    hoverBorder: string
    hoverShadow: string
    overlayFrom: string
    badgeHover: string
  }
> = {
  blue: {
    hoverBorder: 'hover:border-blue-500/50',
    hoverShadow: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]',
    overlayFrom: 'from-blue-500/10',
    badgeHover: 'group-hover:bg-blue-500 group-hover:text-white',
  },
  amber: {
    hoverBorder: 'hover:border-amber-500/50',
    hoverShadow: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]',
    overlayFrom: 'from-amber-500/10',
    badgeHover: 'group-hover:bg-amber-500 group-hover:text-white',
  },
}

export function AnswerOptionButton({
  index,
  text,
  accent = 'blue',
  disabled = false,
  onClick,
  className,
}: {
  index: number
  text: string
  accent?: Accent
  disabled?: boolean
  onClick?: () => void
  className?: string
}) {
  const letter = String.fromCharCode(65 + index)
  const a = ACCENT[accent]

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative group overflow-hidden p-5 md:p-6 rounded-2xl border transition-all duration-300 text-left backdrop-blur-md',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]',
        disabled
          ? 'border-white/5 bg-white/5 opacity-50 cursor-not-allowed'
          : cn(
              'border-white/10 bg-white/5 hover:bg-white/10 hover:-translate-y-0.5 active:scale-[0.98]',
              a.hoverBorder,
              a.hoverShadow
            ),
        className
      )}
    >
      <div
        aria-hidden
        className={cn(
          'absolute inset-0 bg-gradient-to-r to-transparent opacity-0 group-hover:opacity-100 transition-opacity',
          a.overlayFrom
        )}
      />
      <div className="flex items-center gap-4 relative z-10">
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm transition-colors',
            disabled ? 'bg-white/10 text-white/40' : cn('bg-white/10 text-white/60', a.badgeHover)
          )}
        >
          {letter}
        </div>
        <MathText text={text} className="text-lg font-medium" />
      </div>
    </button>
  )
}


