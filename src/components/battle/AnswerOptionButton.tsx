import React from 'react'
import { cn } from '@/lib/utils'
import { MathText } from '@/components/math/MathText'
import { motion, useReducedMotion } from 'framer-motion'
import { buttonPressMotion } from '@/components/battle/battleMotion'

type Accent = 'blue' | 'amber'

const ACCENT: Record<
  Accent,
  {
    stripe: string
    badgeBg: string
    badgeText: string
    shadow: string
  }
> = {
  blue: {
    stripe: 'bg-[#00D4FF]',
    badgeBg: 'bg-[#00D4FF]/20',
    badgeText: 'text-[#00A6C7]',
    shadow: 'shadow-[10px_10px_0_rgba(0,0,0,0.55)]',
  },
  amber: {
    stripe: 'bg-[#FFD400]',
    badgeBg: 'bg-[#FFD400]/25',
    badgeText: 'text-[#B08500]',
    shadow: 'shadow-[10px_10px_0_rgba(0,0,0,0.55)]',
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
  const reduceMotion = useReducedMotion()
  const press = buttonPressMotion(reduceMotion)

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...press}
      className={cn(
        'relative group w-full overflow-hidden rounded-[22px] px-5 py-4 md:px-6 md:py-5 text-left',
        'bg-[#F7F2E7] text-[#141318]',
        'ring-2 ring-black/80',
        a.shadow,
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070a]',
        disabled
          ? 'opacity-55 cursor-not-allowed'
          : cn(
              'transition-colors duration-150',
              'hover:bg-[#FBF7EE]'
            ),
        className
      )}
    >
      {/* Accent stripe (comic print) */}
      <div aria-hidden className={cn('absolute inset-y-0 left-0 w-2', a.stripe)} />

      {/* Halftone + paper sheen */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.12) 1px, rgba(0,0,0,0) 1.2px)',
          backgroundSize: '16px 16px',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/65 via-transparent to-transparent opacity-70"
      />

      <div className="relative z-10 flex items-start gap-4">
        <div
          className={cn(
            'mt-0.5 w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-colors',
            'bg-white/70 ring-2 ring-black/80',
            disabled ? 'text-black/40' : cn(a.badgeBg, a.badgeText)
          )}
        >
          {letter}
        </div>
        <MathText text={text} className="text-lg md:text-xl font-extrabold leading-snug" />
      </div>
    </motion.button>
  )
}


