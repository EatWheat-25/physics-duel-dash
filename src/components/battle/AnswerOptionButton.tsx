import React from 'react'
import { cn } from '@/lib/utils'
import { MathText } from '@/components/math/MathText'

type Accent = 'blue' | 'amber'

const ACCENT: Record<
  Accent,
  {
    stripe: string
    glow: string
    badge: string
  }
> = {
  blue: {
    stripe: 'bg-gradient-to-b from-sky-400 via-blue-500 to-indigo-500',
    glow: 'hover:shadow-[0_0_26px_rgba(59,130,246,0.22)]',
    badge: 'group-hover:bg-blue-500 group-hover:text-white',
  },
  amber: {
    stripe: 'bg-gradient-to-b from-amber-400 via-orange-500 to-rose-500',
    glow: 'hover:shadow-[0_0_26px_rgba(245,158,11,0.18)]',
    badge: 'group-hover:bg-amber-500 group-hover:text-white',
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
        'relative group w-full overflow-hidden rounded-2xl px-5 py-4 md:px-6 md:py-5 text-left backdrop-blur-md',
        'ring-1 ring-white/10 bg-black/25',
        'shadow-[0_16px_48px_rgba(0,0,0,0.35)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]',
        disabled
          ? 'opacity-45 cursor-not-allowed'
          : cn(
              'transition-[transform,background,box-shadow] duration-200',
              'hover:bg-white/10 hover:ring-white/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]',
              a.glow
            ),
        className
      )}
    >
      {/* Accent stripe (game lane) */}
      <div aria-hidden className={cn('absolute inset-y-0 left-0 w-1.5 opacity-90', a.stripe)} />

      {/* Subtle highlight */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-70"
      />

      <div className="relative z-10 flex items-start gap-4">
        <div
          className={cn(
            'mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center font-mono font-black text-sm transition-colors',
            'bg-white/10 ring-1 ring-white/15',
            disabled ? 'text-white/40' : cn('text-white/70', a.badge)
          )}
        >
          {letter}
        </div>
        <MathText text={text} className="text-lg md:text-xl font-semibold leading-snug" />
      </div>
    </button>
  )
}


