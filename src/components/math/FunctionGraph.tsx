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
  // Temporarily disabled to fix white screen crash
  // TODO: Fix function-plot CommonJS require() issue
  if (!equation?.trim()) return null

  return (
    <div
      className={cn(
        'w-full rounded-xl border border-yellow-400/20 bg-[#1A0008] p-4 overflow-hidden',
        className
      )}
    >
      <div className="text-yellow-400 text-sm p-4 border border-yellow-400/30 rounded">
        Graph feature temporarily disabled. Equation: <code className="text-white">{equation}</code>
      </div>
    </div>
  )
}

