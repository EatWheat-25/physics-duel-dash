import React from 'react'
import { Starfield } from '@/components/Starfield'
import { cn } from '@/lib/utils'

export function BattleHudShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-h-screen bg-[#050505] text-white overflow-hidden relative', className)}>
      <Starfield />

      {/* Arena lighting (dark base + subtle highlights for a light/dark mix) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/12 via-[#050505] to-[#050505]" />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/6 blur-3xl" />
        <div className="absolute -bottom-48 left-1/3 h-[540px] w-[540px] -translate-x-1/3 rounded-full bg-blue-500/8 blur-3xl" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-70" />
      </div>

      <div className="relative z-10 min-h-screen w-full max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6 flex flex-col">
        {children}
      </div>
    </div>
  )
}


