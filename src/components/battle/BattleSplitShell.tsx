import React from 'react'
import { Starfield } from '@/components/Starfield'
import { cn } from '@/lib/utils'

export function BattleSplitShell({
  top,
  bottom,
  className,
}: {
  top: React.ReactNode
  bottom: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-h-screen bg-[#050505] text-white overflow-hidden relative', className)}>
      <Starfield />

      {/* Subtle overlay to better match the app theme (keeps both halves dark). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-[#050505] to-[#050505]" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-60" />
      </div>

      <div className="relative z-10 min-h-screen w-full max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-6 flex flex-col">
        <div className="flex-1 min-h-0 lobby-card">
          <div className="flex flex-col h-full">
            {/* TOP PANEL */}
            <section className="relative flex-[0.95] min-h-0 bg-gradient-to-b from-black/35 via-black/45 to-black/55">
              {/* TopImageSlot: place character/subject art here later (kept empty on purpose). */}
              <div aria-hidden className="absolute inset-0 pointer-events-none">
                <div className="absolute -left-10 -top-10 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
                <div className="absolute -right-16 -bottom-16 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
              </div>

              <div className="relative h-full overflow-y-auto p-4 md:p-6">{top}</div>
            </section>

            {/* Divider (the “merge” seam) */}
            <div aria-hidden className="h-px bg-gradient-to-r from-transparent via-blue-500/35 to-transparent" />

            {/* BOTTOM PANEL */}
            <section className="relative flex-[1.15] min-h-0 bg-gradient-to-t from-black/60 via-black/55 to-black/50">
              {/* BottomImageSlot: place bottom art here later (kept empty on purpose). */}
              <div aria-hidden className="absolute inset-0 pointer-events-none">
                <div className="absolute -left-12 -bottom-12 h-72 w-72 rounded-full bg-amber-500/8 blur-3xl" />
                <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-blue-500/8 blur-3xl" />
              </div>

              <div className="relative h-full overflow-y-auto p-4 md:p-6">{bottom}</div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}


