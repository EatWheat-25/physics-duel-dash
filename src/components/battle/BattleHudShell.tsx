import React from 'react'
import { cn } from '@/lib/utils'
import { ComicHalftoneBackdrop } from '@/components/battle/ComicHalftoneBackdrop'

export function BattleHudShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'battle-comic min-h-screen text-white overflow-hidden relative',
        'bg-[#07070a]',
        className
      )}
    >
      <ComicHalftoneBackdrop />

      <div className="relative z-10 min-h-screen w-full max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6 flex flex-col">
        {children}
      </div>
    </div>
  )
}


