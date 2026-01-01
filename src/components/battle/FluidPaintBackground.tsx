import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'

/**
 * Battle-only background: red/yellow “fluid paint” (acrylic pour) vibe.
 * Purely visual, static (no animation), pointer-events none.
 */
export function FluidPaintBackground({ className }: { className?: string }) {
  const noiseId = useMemo(() => `fluidNoise-${Math.random().toString(36).slice(2, 9)}`, [])

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none fixed inset-0 z-0 overflow-hidden', className)}
    >
      {/* Base dark */}
      <div className="absolute inset-0 bg-[#120006]" />

      {/* Fluid color fields */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            // red pools
            'radial-gradient(900px 700px at 18% 26%, rgba(255, 0, 86, 0.55) 0%, rgba(255, 0, 86, 0) 62%)',
            'radial-gradient(780px 620px at 70% 18%, rgba(255, 52, 52, 0.40) 0%, rgba(255, 52, 52, 0) 60%)',
            'radial-gradient(980px 760px at 58% 84%, rgba(255, 14, 96, 0.45) 0%, rgba(255, 14, 96, 0) 64%)',
            // yellow pours
            'radial-gradient(760px 620px at 82% 34%, rgba(255, 214, 0, 0.45) 0%, rgba(255, 214, 0, 0) 58%)',
            'radial-gradient(820px 660px at 34% 78%, rgba(255, 184, 0, 0.25) 0%, rgba(255, 184, 0, 0) 62%)',
          ].join(','),
        }}
      />

      {/* Subtle “swirl” layer */}
      <div
        className="absolute inset-0 opacity-[0.45]"
        style={{
          transform: 'rotate(-10deg) scale(1.15)',
          filter: 'blur(70px)',
          background:
            'conic-gradient(from 210deg at 52% 48%, rgba(255, 214, 0, 0.22), rgba(255, 0, 86, 0.22), rgba(255, 214, 0, 0.14), rgba(255, 0, 86, 0.24))',
        }}
      />

      {/* Grain to break up gradients */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.10] mix-blend-overlay">
        <filter id={noiseId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${noiseId})`} />
      </svg>

      {/* Vignette for readability */}
      <div className="absolute inset-0 bg-[radial-gradient(transparent_30%,rgba(0,0,0,0.80)_100%)] opacity-80" />
    </div>
  )
}


