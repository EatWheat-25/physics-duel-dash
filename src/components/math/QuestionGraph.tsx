import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { GraphConfig, GraphColor, GraphPoint } from '@/types/question-contract'

type Domain = { xMin: number; xMax: number; yMin: number; yMax: number }

const DEFAULT_DOMAIN: Pick<Domain, 'xMin' | 'xMax'> = { xMin: -10, xMax: 10 }

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function isFiniteNumber(n: any): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

function normalizeColor(raw: any): GraphColor {
  const c = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return c === 'black' ? 'black' : 'white'
}

function coerceNumber(n: any): number | null {
  if (typeof n === 'number' && Number.isFinite(n)) return n
  if (typeof n === 'string' && n.trim() !== '') {
    const v = Number(n)
    return Number.isFinite(v) ? v : null
  }
  return null
}

function roundNice(n: number): number {
  if (!Number.isFinite(n) || n === 0) return 0
  const sign = n < 0 ? -1 : 1
  const abs = Math.abs(n)
  const exp = Math.floor(Math.log10(abs))
  const base = abs / Math.pow(10, exp)
  const niceBase = base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10
  return sign * niceBase * Math.pow(10, exp)
}

function makeTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || count <= 1) return []
  if (min === max) return [min]

  const span = max - min
  const step = roundNice(span / (count - 1))
  if (step === 0) return []

  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step

  const ticks: number[] = []
  for (let v = start; v <= end + step / 2; v += step) {
    // Keep within a slightly expanded range so labels align to nice boundaries
    ticks.push(Number(v.toFixed(10)))
    if (ticks.length > 100) break
  }
  return ticks
}

function formatTick(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1000 || (abs > 0 && abs < 0.01)) return n.toExponential(1)
  if (abs >= 10) return String(Math.round(n))
  if (abs >= 1) return n.toFixed(1).replace(/\.0$/, '')
  return n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function normalizeEquation(input: string): string {
  let s = input.trim()
  // Normalize common math glyphs
  s = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi')
  // Superscripts (common)
  s = s.replace(/²/g, '^2').replace(/³/g, '^3')
  // Insert explicit multiplications for very common patterns: 2x, 2(x), (x)2
  s = s.replace(/(\d)\s*(x)/gi, '$1*$2')
  s = s.replace(/(\d)\s*\(/g, '$1*(')
  s = s.replace(/\)\s*(\d)/g, ')*$1')
  s = s.replace(/\)\s*(x)/gi, ')*$1')
  s = s.replace(/(x)\s*\(/gi, '$1*(')
  // Exponent: caret -> JS exponent
  s = s.replace(/\^/g, '**')
  return s
}

const ALLOWED_IDENTIFIERS = new Set([
  'x',
  'pi',
  'e',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'sqrt',
  'abs',
  'exp',
  'log',
  'ln',
  'pow',
  'min',
  'max',
])

function validateExpression(expr: string): string | null {
  // Disallow anything that could escape expression context
  if (/[\[\]{};=<>`$]/.test(expr)) return 'Invalid characters in equation'
  // Allow numbers, operators, dots, commas, parens, whitespace, and letters/underscores
  if (!/^[0-9+\-*/().,\sA-Za-z_]*$/.test(expr)) return 'Equation contains unsupported characters'

  // Validate identifiers
  const identifiers = expr.match(/[A-Za-z_]+/g) ?? []
  for (const id of identifiers) {
    const lower = id.toLowerCase()
    if (!ALLOWED_IDENTIFIERS.has(lower)) {
      return `Unsupported identifier "${id}"`
    }
  }

  return null
}

function compileEquation(raw: string): { fn: (x: number) => number; error: string | null } {
  const normalized = normalizeEquation(raw)
  const err = validateExpression(normalized)
  if (err) {
    return { fn: () => NaN, error: err }
  }

  // Map identifiers to Math functions/constants in a local scope
  const body = `
    const pi = Math.PI;
    const e = Math.E;
    const sin = Math.sin;
    const cos = Math.cos;
    const tan = Math.tan;
    const asin = Math.asin;
    const acos = Math.acos;
    const atan = Math.atan;
    const sqrt = Math.sqrt;
    const abs = Math.abs;
    const exp = Math.exp;
    const log = Math.log;
    const ln = Math.log;
    const pow = Math.pow;
    const min = Math.min;
    const max = Math.max;
    return (${normalized});
  `

  // eslint-disable-next-line no-new-func
  const fn = new Function('x', body) as (x: number) => number
  return { fn, error: null }
}

function domainFromPoints(points: GraphPoint[]): Domain {
  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity

  for (const p of points) {
    xMin = Math.min(xMin, p.x)
    xMax = Math.max(xMax, p.x)
    yMin = Math.min(yMin, p.y)
    yMax = Math.max(yMax, p.y)
  }

  // Add padding
  const xSpan = xMax - xMin
  const ySpan = yMax - yMin
  const xPad = xSpan === 0 ? 1 : xSpan * 0.08
  const yPad = ySpan === 0 ? 1 : ySpan * 0.12

  return {
    xMin: xMin - xPad,
    xMax: xMax + xPad,
    yMin: yMin - yPad,
    yMax: yMax + yPad,
  }
}

function applyOverrides(domain: Domain, g: any): Domain {
  const xMin = coerceNumber(g?.xMin)
  const xMax = coerceNumber(g?.xMax)
  const yMin = coerceNumber(g?.yMin)
  const yMax = coerceNumber(g?.yMax)

  const out: Domain = { ...domain }
  if (xMin != null) out.xMin = xMin
  if (xMax != null) out.xMax = xMax
  if (yMin != null) out.yMin = yMin
  if (yMax != null) out.yMax = yMax

  if (out.xMin === out.xMax) {
    out.xMin -= 1
    out.xMax += 1
  }
  if (out.yMin === out.yMax) {
    out.yMin -= 1
    out.yMax += 1
  }

  // Ensure ordering
  if (out.xMin > out.xMax) [out.xMin, out.xMax] = [out.xMax, out.xMin]
  if (out.yMin > out.yMax) [out.yMin, out.yMax] = [out.yMax, out.yMin]

  return out
}

export function QuestionGraph({
  graph,
  className,
  aspect = 'wide',
}: {
  graph: GraphConfig | null | undefined
  className?: string
  aspect?: 'wide' | 'square'
}) {
  const normalizedGraph = useMemo(() => {
    if (!graph) return null
    const color = normalizeColor((graph as any).color)
    if (graph.type === 'function') {
      const equation = typeof graph.equation === 'string' ? graph.equation.trim() : ''
      if (!equation) return null
      return { ...graph, equation, color } as GraphConfig
    }
    const points = Array.isArray((graph as any).points) ? (graph as any).points : null
    if (!points || points.length < 2) return null
    return { ...graph, color } as GraphConfig
  }, [graph])

  const render = useMemo(() => {
    if (!normalizedGraph) return { error: 'No graph data', color: 'white' as GraphColor }

    const color = normalizeColor((normalizedGraph as any).color)

    // Layout
    const W = 640
    const H = aspect === 'square' ? 640 : 360
    const M = { l: 46, r: 18, t: 18, b: 36 }
    const PW = W - M.l - M.r
    const PH = H - M.t - M.b

    const stroke = color === 'black' ? '#000000' : '#ffffff'
    const axisStroke = stroke
    const gridStroke = stroke

    const xTicksTarget = 6
    const yTicksTarget = 6

    if (normalizedGraph.type === 'points') {
      const ptsRaw = (normalizedGraph as any).points
      const pts: GraphPoint[] = (Array.isArray(ptsRaw) ? ptsRaw : [])
        .map((p: any) => ({ x: coerceNumber(p?.x), y: coerceNumber(p?.y) }))
        .filter((p: any) => isFiniteNumber(p.x) && isFiniteNumber(p.y))
        .map((p: any) => ({ x: p.x, y: p.y }))

      if (pts.length < 2) return { error: 'Graph points are invalid', color }

      const baseDomain = domainFromPoints(pts)
      const domain = applyOverrides(baseDomain, normalizedGraph)

      const xTicks = makeTicks(domain.xMin, domain.xMax, xTicksTarget)
      const yTicks = makeTicks(domain.yMin, domain.yMax, yTicksTarget)

      const xToPx = (x: number) => M.l + ((x - domain.xMin) / (domain.xMax - domain.xMin)) * PW
      const yToPx = (y: number) => M.t + (1 - (y - domain.yMin) / (domain.yMax - domain.yMin)) * PH

      const poly = pts.map((p) => `${xToPx(p.x).toFixed(2)},${yToPx(p.y).toFixed(2)}`).join(' ')

      const xAxisY = yToPx(clamp(0, domain.yMin, domain.yMax))
      const yAxisX = xToPx(clamp(0, domain.xMin, domain.xMax))

      return {
        type: 'points' as const,
        W,
        H,
        M,
        PW,
        PH,
        axisStroke,
        gridStroke,
        stroke,
        xTicks,
        yTicks,
        xAxisY,
        yAxisX,
        poly,
        pts,
        xToPx,
        yToPx,
        domain,
        color,
        error: null as string | null,
      }
    }

    // function
    const equation = normalizedGraph.equation
    const { fn, error } = compileEquation(equation)
    if (error) return { error, color }

    const xMin = isFiniteNumber((normalizedGraph as any).xMin) ? (normalizedGraph as any).xMin : DEFAULT_DOMAIN.xMin
    const xMax = isFiniteNumber((normalizedGraph as any).xMax) ? (normalizedGraph as any).xMax : DEFAULT_DOMAIN.xMax
    const baseXMin = Math.min(xMin, xMax)
    const baseXMax = Math.max(xMin, xMax)

    const sampleCount = 400
    const xs: number[] = []
    const ys: number[] = []

    for (let i = 0; i < sampleCount; i++) {
      const t = i / (sampleCount - 1)
      const x = baseXMin + t * (baseXMax - baseXMin)
      let y: number
      try {
        y = fn(x)
      } catch {
        continue
      }
      if (!Number.isFinite(y)) continue
      // Hard clamp extreme values to avoid the whole plot being destroyed by asymptotes
      if (Math.abs(y) > 1e6) continue
      xs.push(x)
      ys.push(y)
    }

    if (ys.length < 2) return { error: 'Equation produced no plottable values', color }

    let yMin = Math.min(...ys)
    let yMax = Math.max(...ys)

    // Padding and degenerate ranges
    const ySpan = yMax - yMin
    const yPad = ySpan === 0 ? 1 : ySpan * 0.12
    yMin -= yPad
    yMax += yPad
    if (yMin === yMax) {
      yMin -= 1
      yMax += 1
    }

    let domain: Domain = { xMin: baseXMin, xMax: baseXMax, yMin, yMax }
    domain = applyOverrides(domain, normalizedGraph)

    const xTicks = makeTicks(domain.xMin, domain.xMax, xTicksTarget)
    const yTicks = makeTicks(domain.yMin, domain.yMax, yTicksTarget)

    const xToPx = (x: number) => M.l + ((x - domain.xMin) / (domain.xMax - domain.xMin)) * PW
    const yToPx = (y: number) => M.t + (1 - (y - domain.yMin) / (domain.yMax - domain.yMin)) * PH

    // Build a single path; break segments at discontinuities
    let d = ''
    let penDown = false
    for (let i = 0; i < sampleCount; i++) {
      const t = i / (sampleCount - 1)
      const x = domain.xMin + t * (domain.xMax - domain.xMin)
      let y: number
      try {
        y = fn(x)
      } catch {
        penDown = false
        continue
      }
      if (!Number.isFinite(y) || Math.abs(y) > 1e6) {
        penDown = false
        continue
      }
      const px = xToPx(x)
      const py = yToPx(y)
      // If wildly outside y domain (e.g. asymptote), lift pen
      if (py < M.t - 2000 || py > M.t + PH + 2000) {
        penDown = false
        continue
      }
      if (!penDown) {
        d += `M ${px.toFixed(2)} ${py.toFixed(2)} `
        penDown = true
      } else {
        d += `L ${px.toFixed(2)} ${py.toFixed(2)} `
      }
    }

    const xAxisY = yToPx(clamp(0, domain.yMin, domain.yMax))
    const yAxisX = xToPx(clamp(0, domain.xMin, domain.xMax))

    return {
      type: 'function' as const,
      W,
      H,
      M,
      PW,
      PH,
      axisStroke,
      gridStroke,
      stroke,
      xTicks,
      yTicks,
      xAxisY,
      yAxisX,
      d,
      domain,
      color,
      error: null as string | null,
    }
  }, [normalizedGraph, aspect])

  if (!normalizedGraph) return null

  if ((render as any).error) {
    return (
      <div className={cn('w-full rounded-xl border border-white/10 p-3 text-xs text-white/70', className)}>
        <div className="font-semibold mb-1">Graph unavailable</div>
        <div className="font-mono opacity-80">{String((render as any).error)}</div>
      </div>
    )
  }

  const r: any = render
  const stroke = r.stroke
  const axisStroke = r.axisStroke
  const gridStroke = r.gridStroke
  const opacityAxis = 0.65
  const opacityGrid = 0.18
  const opacityBorder = 0.35

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${r.W} ${r.H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Question graph"
      >
        {/* Plot border */}
        <rect
          x={r.M.l}
          y={r.M.t}
          width={r.PW}
          height={r.PH}
          fill="none"
          stroke={axisStroke}
          strokeOpacity={opacityBorder}
          strokeWidth={1}
        />

        {/* Grid + ticks */}
        {r.xTicks.map((x: number, i: number) => {
          const px = r.M.l + ((x - r.domain.xMin) / (r.domain.xMax - r.domain.xMin)) * r.PW
          return (
            <g key={`x-${i}`}>
              <line
                x1={px}
                y1={r.M.t}
                x2={px}
                y2={r.M.t + r.PH}
                stroke={gridStroke}
                strokeOpacity={opacityGrid}
                strokeWidth={1}
              />
              <text
                x={px}
                y={r.M.t + r.PH + 18}
                textAnchor="middle"
                fontSize="10"
                fill={axisStroke}
                fillOpacity={opacityAxis}
              >
                {formatTick(x)}
              </text>
            </g>
          )
        })}

        {r.yTicks.map((y: number, i: number) => {
          const py = r.M.t + (1 - (y - r.domain.yMin) / (r.domain.yMax - r.domain.yMin)) * r.PH
          return (
            <g key={`y-${i}`}>
              <line
                x1={r.M.l}
                y1={py}
                x2={r.M.l + r.PW}
                y2={py}
                stroke={gridStroke}
                strokeOpacity={opacityGrid}
                strokeWidth={1}
              />
              <text
                x={r.M.l - 8}
                y={py + 3}
                textAnchor="end"
                fontSize="10"
                fill={axisStroke}
                fillOpacity={opacityAxis}
              >
                {formatTick(y)}
              </text>
            </g>
          )
        })}

        {/* Axes at 0 when in range (otherwise they clamp to border) */}
        <line
          x1={r.M.l}
          y1={r.xAxisY}
          x2={r.M.l + r.PW}
          y2={r.xAxisY}
          stroke={axisStroke}
          strokeOpacity={opacityAxis}
          strokeWidth={1.2}
        />
        <line
          x1={r.yAxisX}
          y1={r.M.t}
          x2={r.yAxisX}
          y2={r.M.t + r.PH}
          stroke={axisStroke}
          strokeOpacity={opacityAxis}
          strokeWidth={1.2}
        />

        {/* Graph */}
        {r.type === 'function' ? (
          <path d={r.d} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ) : (
          <>
            <polyline
              points={r.poly}
              fill="none"
              stroke={stroke}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {r.pts.map((p: GraphPoint, i: number) => (
              <circle key={i} cx={r.xToPx(p.x)} cy={r.yToPx(p.y)} r={3} fill={stroke} fillOpacity={0.9} />
            ))}
          </>
        )}
      </svg>
    </div>
  )
}


