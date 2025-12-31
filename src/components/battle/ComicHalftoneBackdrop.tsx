import React, { useMemo } from 'react'

/**
 * Comic halftone + paper grain backdrop for the battle flow.
 * Purely visual: no layout, no pointer events.
 */
export function ComicHalftoneBackdrop() {
  const noiseId = useMemo(() => `comicNoise-${Math.random().toString(36).slice(2, 9)}`, [])

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Base ink atmosphere (dark) */}
      <div className="absolute inset-0 bg-[#07070a]" />

      {/* Ink vignette + subtle arena light */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/25 to-black/65" />

      {/* Halftone dots (paper print vibe) */}
      <div
        className="absolute inset-0 opacity-[0.22] mix-blend-overlay"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.22) 1px, rgba(0,0,0,0) 1.2px)',
          backgroundSize: '18px 18px',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.10] mix-blend-soft-light"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.22) 1px, rgba(0,0,0,0) 1.2px)',
          backgroundSize: '26px 26px',
        }}
      />

      {/* Paper grain (very subtle) */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.08]">
        <filter id={noiseId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${noiseId})`} />
      </svg>

      {/* Top edge highlight (comic page shine) */}
      <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-60" />
    </div>
  )
}



