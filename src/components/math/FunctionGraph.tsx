import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

// Theme colors that match the app's design system
const THEME_COLORS = {
  yellow: '#fbbf24',      // yellow-400 (matches buttons and accents)
  amber: '#f59e0b',        // amber-500
  blue: '#58c4ff',         // blue-400 (matches accents)
  cyan: '#5ef1ff',         // aqua
  purple: '#9a5bff',       // violet
  red: '#ef4444',          // red-500
  green: '#10b981',        // green-500
} as const

export type GraphColor = keyof typeof THEME_COLORS | string

export function FunctionGraph({
  equation,
  color = 'yellow',  // Default to yellow-400 to match theme
  width = 600,
  height = 400,
  className,
}: {
  equation: string | null | undefined
  color?: GraphColor
  width?: number
  height?: number
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!equation?.trim() || !containerRef.current) return

    let cancelled = false

    ;(async () => {
      try {
        // Clear previous graph
        containerRef.current!.innerHTML = ''

        // Resolve color - use theme color or custom hex
        const lineColor = THEME_COLORS[color as keyof typeof THEME_COLORS] || color

        // NOTE: function-plot's published package.json points to a missing dist/index.js.
        // Import the bundled UMD build directly so Vite can resolve it in production builds.
        const mod: any = await import('function-plot/dist/function-plot.js')
        const functionPlot: any = mod?.default ?? mod?.functionPlot ?? mod

        if (cancelled || !containerRef.current || typeof functionPlot !== 'function') return

        functionPlot({
          target: containerRef.current,
          width,
          height,
          xAxis: {
            label: 'x',
            domain: [-10, 10],
          },
          yAxis: {
            label: 'y',
            domain: [-10, 10],
          },
          grid: true,
          disableZoom: false,
          annotations: [],
          data: [
            {
              fn: equation.trim(),
              color: lineColor,
              graphType: 'polyline',
              attr: {
                'stroke-width': 2.5, // Thicker lines for visibility
              },
            },
          ],
          tip: {
            xLine: true,
            yLine: true,
          },
        })
      } catch (error) {
        console.error('Error plotting function:', error)
        if (containerRef.current) {
          containerRef.current.innerHTML = `<div class="text-red-400 text-sm p-4">Error rendering graph: ${error instanceof Error ? error.message : 'Invalid equation'}</div>`
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [equation, color, width, height])

  if (!equation?.trim()) return null

  return (
    <div
      className={cn(
        'w-full rounded-xl border border-yellow-400/20 bg-[#1A0008] p-4 overflow-hidden',
        className
      )}
    >
      <div ref={containerRef} className="w-full" />
    </div>
  )
}

