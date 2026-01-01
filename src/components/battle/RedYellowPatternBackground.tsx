import React, { useEffect, useMemo, useState } from 'react'

export const RedYellowPatternBackground = () => {
  // Same doodle wallpaper as StudyPatternBackground, recolored to white outlines on a royal-blue base.
  // User request: no shadow layer, slightly smaller doodles, and keep doodle size stable on resize + browser zoom.
  const BASE_TILE_PX = 255 // ~25% smaller than 340px

  const [dpr, setDpr] = useState(() => {
    if (typeof window === 'undefined') return 1
    return window.devicePixelRatio || 1
  })

  useEffect(() => {
    const onResize = () => setDpr(window.devicePixelRatio || 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Keep the physical (device pixel) tile size stable even when browser zoom changes.
  const tileSizeCss = BASE_TILE_PX / Math.max(1, dpr)

  const baseDoodleSvg = useMemo(
    () => `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <g fill="none" stroke="#FFFFFF" stroke-opacity="0.38" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <!-- Book -->
        <path d="M26 34h34c6 0 10 4 10 10v44c0-6-4-10-10-10H26z"/>
        <path d="M26 34v44"/>
        <path d="M60 34v44"/>
        <path d="M40 44h18"/>

        <!-- Calculator -->
        <rect x="154" y="28" width="48" height="58" rx="10"/>
        <rect x="164" y="38" width="28" height="10" rx="4"/>
        <g>
          <rect x="164" y="54" width="10" height="10" rx="3"/>
          <rect x="178" y="54" width="10" height="10" rx="3"/>
          <rect x="192" y="54" width="10" height="10" rx="3"/>
          <rect x="164" y="68" width="10" height="10" rx="3"/>
          <rect x="178" y="68" width="10" height="10" rx="3"/>
          <rect x="192" y="68" width="10" height="10" rx="3"/>
        </g>

        <!-- Atom -->
        <circle cx="64" cy="150" r="5"/>
        <path d="M64 134c22 0 40 7 40 16s-18 16-40 16-40-7-40-16 18-16 40-16z"/>
        <path d="M44 140c10-16 28-26 40-22 12 4 14 22 4 38s-28 26-40 22c-12-4-14-22-4-38z"/>
        <path d="M84 140c-10-16-28-26-40-22-12 4-14 22-4 38s28 26 40 22c12-4 14-22 4-38z"/>

        <!-- Flask -->
        <path d="M170 126h24"/>
        <path d="M178 126v18l-20 34c-2 4 1 8 6 8h44c5 0 8-4 6-8l-20-34v-18"/>
        <path d="M168 172h44"/>

        <!-- Pencil -->
        <path d="M34 212l40-40 10 10-40 40H34z"/>
        <path d="M74 172l10 10"/>
        <path d="M30 216l4-4"/>

        <!-- Ruler -->
        <rect x="120" y="200" width="74" height="16" rx="6"/>
        <path d="M132 200v8"/>
        <path d="M144 200v6"/>
        <path d="M156 200v8"/>
        <path d="M168 200v6"/>
        <path d="M180 200v8"/>

        <!-- Lightbulb -->
        <path d="M206 120c0-10-8-18-18-18s-18 8-18 18c0 7 4 13 9 16v6h18v-6c5-3 9-9 9-16z"/>
        <path d="M178 148h20"/>
        <path d="M180 156h16"/>

        <!-- Graph -->
        <path d="M26 124v34h34"/>
        <path d="M30 152l10-12 10 8 10-18"/>

        <!-- Small stars/dots -->
        <path d="M116 44l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>
        <circle cx="112" cy="92" r="2"/>
        <circle cx="122" cy="108" r="2"/>
        <circle cx="102" cy="110" r="2"/>
        <path d="M214 96l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>
      </g>
    </svg>
  `,
    []
  )

  const patternUrl = useMemo(() => {
    const patternSvg = encodeURIComponent(baseDoodleSvg)
    return `url("data:image/svg+xml,${patternSvg}")`
  }, [baseDoodleSvg])

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-black">
      {/* 1. Royal-blue base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            // Deep royal blue with no bright center “reflection”
            'radial-gradient(circle at 50% 45%, #1E40AF 0%, #1E3A8A 45%, #0B1B5E 80%, #020617 100%)',
        }}
      />

      {/* 2. White outline pattern layer (no shadow, smaller icons) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          width: '160%',
          height: '160%',
          left: '-30%',
          top: '-30%',
          transform: 'rotate(-12deg) scale(1.2)',
          transformOrigin: 'center',
          backgroundImage: patternUrl,
          backgroundRepeat: 'repeat',
          backgroundSize: `${tileSizeCss}px ${tileSizeCss}px`,
          opacity: 0.18,
        }}
      />

      {/* 3. Soft vignette (shadows) */}
      <div className="absolute inset-0 bg-[radial-gradient(transparent_35%,rgba(0,0,0,0.55)_100%)] opacity-75 pointer-events-none" />

      {/* 4. Royal-blue glow drifts (subtle motion like Home) */}
      <div
        className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] opacity-20 animate-blob-float"
        style={{ background: '#1D4ED8' }} // blue-700-ish (no white)
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] opacity-12 animate-blob-float"
        style={{
          background: '#1D4ED8', // blue-700
          animationDelay: '-5s',
        }}
      />
    </div>
  )
}


