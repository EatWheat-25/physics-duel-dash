import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import SmilesDrawer from 'smiles-drawer'

type SizePreset = 'sm' | 'md' | 'lg'

const SIZE: Record<
  SizePreset,
  {
    minHeightPx: number
    maxWidthPx: number
    bondThickness: number
    bondLength: number
    fontSizeLarge: number
    fontSizeSmall: number
    padding: number
  }
> = {
  sm: { minHeightPx: 96, maxWidthPx: 320, bondThickness: 1.05, bondLength: 16, fontSizeLarge: 8, fontSizeSmall: 3, padding: 22 },
  md: { minHeightPx: 128, maxWidthPx: 420, bondThickness: 1.1, bondLength: 17, fontSizeLarge: 8, fontSizeSmall: 3, padding: 24 },
  lg: { minHeightPx: 160, maxWidthPx: 520, bondThickness: 1.15, bondLength: 18, fontSizeLarge: 9, fontSizeSmall: 3, padding: 26 },
}

type SmilesTheme = Record<string, string>

const MONO_INK = '#0f172a' // slate-900-ish (Cambridge ink)

const MONO_THEME_LIGHT: SmilesTheme = {
  C: MONO_INK,
  O: MONO_INK,
  N: MONO_INK,
  F: MONO_INK,
  CL: MONO_INK,
  BR: MONO_INK,
  I: MONO_INK,
  P: MONO_INK,
  S: MONO_INK,
  B: MONO_INK,
  SI: MONO_INK,
  H: MONO_INK,
  BACKGROUND: 'transparent',
}

const MONO_THEME_DARK: SmilesTheme = {
  ...MONO_THEME_LIGHT,
  // On very dark UIs we still keep a paper background, but allow future switching.
}

export function SmilesDiagram({
  smiles,
  size = 'md',
  className,
  'aria-label': ariaLabel = 'Chemical structure diagram',
}: {
  smiles: string | null | undefined
  size?: SizePreset
  className?: string
  'aria-label'?: string
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cfg = SIZE[size]

  const cleaned = useMemo(() => {
    const raw = String(smiles ?? '').trim()
    if (!raw) return ''
    // SmilesDrawer provides a conservative cleaner; it helps avoid odd control chars.
    return typeof (SmilesDrawer as any)?.clean === 'function' ? (SmilesDrawer as any).clean(raw) : raw
  }, [smiles])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    // Clear previous render
    while (svg.firstChild) svg.removeChild(svg.firstChild)
    setError(null)

    if (!cleaned) return

    const parse = (SmilesDrawer as any)?.parse as
      | ((s: string, ok: (tree: any) => void, bad: (err: any) => void) => void)
      | undefined

    const SvgDrawer = (SmilesDrawer as any)?.SvgDrawer as any

    if (!parse || !SvgDrawer) {
      setError('SMILES renderer not available')
      return
    }

    parse(
      cleaned,
      (tree: any) => {
        try {
          const drawer = new SvgDrawer(
            {
              // Keep scale=0 so SmilesDrawer uses a viewBox (responsive) instead of fixed px sizing.
              scale: 0,
              compactDrawing: true,
              padding: cfg.padding,
              bondThickness: cfg.bondThickness,
              bondLength: cfg.bondLength,
              fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, sans-serif',
              fontSizeLarge: cfg.fontSizeLarge,
              fontSizeSmall: cfg.fontSizeSmall,
              // Cambridge-style: monochrome, paper-like.
              themes: {
                dark: MONO_THEME_DARK,
                light: MONO_THEME_LIGHT,
              },
            },
            true
          )

          // Use the light theme so structures render as dark ink on a white "paper" panel.
          drawer.draw(tree, svg, 'light')

          // Ensure SVG is responsive inside our layout.
          svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
        } catch (e: any) {
          setError(e?.message ? String(e.message) : 'Failed to render SMILES')
        }
      },
      (err: any) => {
        setError(err?.message ? String(err.message) : 'Invalid SMILES')
      }
    )
  }, [cleaned, cfg.bondLength, cfg.bondThickness, cfg.fontSizeLarge, cfg.fontSizeSmall, cfg.padding])

  return (
    <span
      className={cn(
        // Keep structures readable everywhere by rendering on a paper-like panel.
        'inline-block w-full mx-auto rounded-xl border border-black/10 bg-white overflow-hidden shadow-sm',
        className
      )}
      style={{ minHeight: cfg.minHeightPx, maxWidth: cfg.maxWidthPx }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg ref={svgRef} className="block w-full h-auto" xmlns="http://www.w3.org/2000/svg" />

      {error && (
        <span className="block px-3 py-2 text-[11px] font-mono text-red-700 bg-red-50">
          {error}
        </span>
      )}
    </span>
  )
}


