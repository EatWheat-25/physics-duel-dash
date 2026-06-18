import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'

type ResultsPatternBackgroundProps = {
  outcome?: 'win' | 'loss' | 'draw'
}

const outcomePalette = {
  win: {
    primary: '250,204,21',
    secondary: '34,197,94',
    tertiary: '56,189,248',
    patternStroke: '#F6D968',
  },
  loss: {
    primary: '244,63,94',
    secondary: '250,204,21',
    tertiary: '56,189,248',
    patternStroke: '#F8B84E',
  },
  draw: {
    primary: '245,158,11',
    secondary: '56,189,248',
    tertiary: '148,163,184',
    patternStroke: '#F5C85D',
  },
} as const

export function ResultsPatternBackground({ outcome = 'win' }: ResultsPatternBackgroundProps) {
  const prefersReducedMotion = useReducedMotion()
  const palette = outcomePalette[outcome]

  const patternSvg = useMemo(
    () =>
      encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <g fill="none" stroke="${palette.patternStroke}" stroke-opacity="0.20" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M26 34h34c6 0 10 4 10 10v44c0-6-4-10-10-10H26z"/>
        <path d="M26 34v44"/>
        <path d="M60 34v44"/>
        <path d="M40 44h18"/>
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
        <circle cx="64" cy="150" r="5"/>
        <path d="M64 134c22 0 40 7 40 16s-18 16-40 16-40-7-40-16 18-16 40-16z"/>
        <path d="M44 140c10-16 28-26 40-22 12 4 14 22 4 38s-28 26-40 22c-12-4-14-22-4-38z"/>
        <path d="M84 140c-10-16-28-26-40-22-12 4-14 22-4 38s28 26 40 22c12-4 14-22 4-38z"/>
        <path d="M170 126h24"/>
        <path d="M178 126v18l-20 34c-2 4 1 8 6 8h44c5 0 8-4 6-8l-20-34v-18"/>
        <path d="M168 172h44"/>
        <path d="M34 212l40-40 10 10-40 40H34z"/>
        <path d="M74 172l10 10"/>
        <path d="M30 216l4-4"/>
        <rect x="120" y="200" width="74" height="16" rx="6"/>
        <path d="M132 200v8"/>
        <path d="M144 200v6"/>
        <path d="M156 200v8"/>
        <path d="M168 200v6"/>
        <path d="M180 200v8"/>
        <path d="M206 120c0-10-8-18-18-18s-18 8-18 18c0 7 4 13 9 16v6h18v-6c5-3 9-9 9-16z"/>
        <path d="M178 148h20"/>
        <path d="M180 156h16"/>
        <path d="M26 124v34h34"/>
        <path d="M30 152l10-12 10 8 10-18"/>
        <path d="M116 44l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>
        <circle cx="112" cy="92" r="2"/>
        <circle cx="122" cy="108" r="2"/>
        <circle cx="102" cy="110" r="2"/>
        <path d="M214 96l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>
      </g>
    </svg>
  `),
    [palette.patternStroke],
  )

  const patternUrl = `url("data:image/svg+xml,${patternSvg}")`

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#02030a]">
      <div
        className="absolute inset-0"
        style={{
          background: [
            `radial-gradient(circle at 54% 38%, rgba(${palette.primary},0.16) 0%, rgba(8,10,24,0.82) 42%, rgba(2,3,10,0.98) 78%, #02030a 100%)`,
            `radial-gradient(920px 680px at 18% 18%, rgba(${palette.secondary},0.12) 0%, transparent 62%)`,
            `radial-gradient(920px 700px at 82% 80%, rgba(${palette.tertiary},0.10) 0%, transparent 64%)`,
          ].join(','),
        }}
      />

      <motion.div
        className="absolute inset-[-18%] blur-[120px]"
        style={{
          background: `conic-gradient(from 210deg at 50% 50%, transparent 0deg, rgba(${palette.primary},0.18) 72deg, transparent 140deg, rgba(${palette.secondary},0.14) 230deg, transparent 300deg, rgba(${palette.tertiary},0.10) 360deg)`,
          opacity: 0.6,
        }}
        initial={prefersReducedMotion ? false : { rotate: 0, scale: 1 }}
        animate={
          prefersReducedMotion
            ? { rotate: 0, scale: 1, x: '0%', y: '0%' }
            : {
                rotate: [0, 10, -8, 0],
                scale: [1, 1.06, 1],
                x: ['0%', '-2%', '1%', '0%'],
                y: ['0%', '2%', '-1%', '0%'],
              }
        }
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute left-[-30%] top-[-28%] h-[160%] w-[160%] pointer-events-none"
        style={{
          backgroundImage: patternUrl,
          backgroundRepeat: 'repeat',
          backgroundSize: '210px 210px',
          opacity: outcome === 'loss' ? 0.12 : 0.15,
          transformOrigin: 'center',
        }}
        initial={prefersReducedMotion ? false : { rotate: -12, scale: 1.12 }}
        animate={
          prefersReducedMotion
            ? { rotate: -12, scale: 1.12, x: '0%', y: '0%' }
            : {
                rotate: [-12, -9, -13, -12],
                scale: [1.12, 1.15, 1.13, 1.12],
                x: ['0%', '2%', '-1%', '0%'],
                y: ['0%', '1%', '-1%', '0%'],
              }
        }
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: [
            'linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)',
            'linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)',
          ].join(','),
          backgroundSize: '120px 120px',
          maskImage: 'radial-gradient(circle at 50% 45%, black 12%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 45%, black 12%, transparent 80%)',
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/[0.05] to-transparent" />

      <motion.div
        className="absolute left-[-12%] top-[-24%] h-[52%] w-[52%] rounded-full blur-[190px]"
        style={{ background: `rgba(${palette.primary},0.42)` }}
        animate={
          prefersReducedMotion
            ? { opacity: 0.24 }
            : { opacity: [0.18, 0.3, 0.2], x: [0, 20, -12, 0], y: [0, -14, 8, 0] }
        }
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[-26%] right-[-14%] h-[54%] w-[54%] rounded-full blur-[210px]"
        style={{ background: `rgba(${palette.tertiary},0.34)` }}
        animate={
          prefersReducedMotion
            ? { opacity: 0.2 }
            : { opacity: [0.14, 0.24, 0.16], x: [0, -18, 12, 0], y: [0, 18, -10, 0] }
        }
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[-18%] left-[-8%] h-[44%] w-[44%] rounded-full blur-[190px]"
        style={{ background: `rgba(${palette.secondary},0.24)` }}
        animate={
          prefersReducedMotion
            ? { opacity: 0.16 }
            : { opacity: [0.12, 0.2, 0.14], x: [0, 14, -6, 0], y: [0, -10, 8, 0] }
        }
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(900px 650px at 50% 44%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.18) 62%, rgba(0,0,0,0.72) 100%)',
        }}
      />
    </div>
  )
}

