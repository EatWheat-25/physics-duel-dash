import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { SmilesDiagram } from '@/components/chem/SmilesDiagram'
import {
  MOL_FONT_FAMILY,
  buildMolDrawing,
  type MolInputKind,
  type MolStyle,
} from '@/lib/chem/draw'

const INK = '#0f172a'
const SCALE = { sm: 0.82, md: 1, lg: 1.2 } as const

/**
 * Draws a molecule from a structural formula (CH3CH2OH) or SMILES (CCO) in one
 * of the three Cambridge styles. Used by the [[mol:...]] tag in question text.
 */
export function Molecule({
  input,
  style = 'skeletal',
  kind = 'auto',
  label,
  rotate,
  flip,
  size = 'md',
  className,
}: {
  input: string
  style?: MolStyle
  kind?: MolInputKind
  label?: string
  rotate?: number
  flip?: boolean
  size?: keyof typeof SCALE
  className?: string
}) {
  const result = useMemo(
    () => buildMolDrawing(input, { style, kind, rotate, flip }),
    [input, style, kind, rotate, flip],
  )
  const scale = SCALE[size]
  const drawing = result.drawing

  return (
    <span
      className={cn(
        'inline-flex flex-col items-center align-middle rounded-xl border border-black/10 bg-white px-2 py-1.5 shadow-sm max-w-full',
        className,
      )}
      role="img"
      aria-label={label ? `Structure ${label}` : 'Chemical structure diagram'}
    >
      {label && (
        <span className="text-sm font-bold leading-tight" style={{ color: INK, fontFamily: MOL_FONT_FAMILY }}>
          {label}
        </span>
      )}

      {drawing && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${drawing.width} ${drawing.height}`}
          width={drawing.width * scale}
          height={drawing.height * scale}
          className="block max-w-full h-auto"
        >
          <g stroke={INK} strokeWidth={drawing.strokeWidth} strokeLinecap="round" fill="none">
            {drawing.lines.map((l, i) => (
              <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
            ))}
            {drawing.circles.map((c, i) => (
              <circle key={i} cx={c.cx} cy={c.cy} r={c.r} />
            ))}
          </g>
          <g fill={INK} fontFamily={MOL_FONT_FAMILY}>
            {drawing.texts.map((t, i) => (
              <text key={i} x={t.x} y={t.y} fontSize={t.size}>
                {t.text}
              </text>
            ))}
          </g>
        </svg>
      )}

      {!drawing && result.fallbackSmiles && (
        <SmilesDiagram smiles={result.fallbackSmiles} size={size} className="border-0 shadow-none" />
      )}

      {result.error && (
        <span className="block px-2 py-1 text-[11px] font-mono text-red-700 bg-red-50 rounded">
          {result.error}
        </span>
      )}
    </span>
  )
}
