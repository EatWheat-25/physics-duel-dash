import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import SmilesDrawer from 'smiles-drawer'

type SizePreset = 'sm' | 'md' | 'lg'

const SIZE: Record<SizePreset, { minHeightPx: number }> = {
  sm: { minHeightPx: 120 },
  md: { minHeightPx: 160 },
  lg: { minHeightPx: 220 },
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
              bondThickness: 1.6,
              bondLength: 18,
              fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, sans-serif',
              fontSizeLarge: 10,
              fontSizeSmall: 3,
            },
            true
          )

          drawer.draw(tree, svg, 'dark')

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
  }, [cleaned])

  const minHeightPx = SIZE[size].minHeightPx

  return (
    <span
      className={cn(
        'inline-block w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden',
        className
      )}
      style={{ minHeight: minHeightPx }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg ref={svgRef} className="w-full h-auto" xmlns="http://www.w3.org/2000/svg" />

      {error && (
        <span className="block px-3 py-2 text-[11px] font-mono text-red-300/80">
          {error}
        </span>
      )}
    </span>
  )
}


