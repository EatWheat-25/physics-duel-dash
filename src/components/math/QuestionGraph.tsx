import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type {
  GraphAngleMarker,
  GraphConfig,
  GraphColor,
  GraphDisplayMode,
  GraphFunctionSeries,
  GraphLabel,
  GraphPoint,
  GraphPolygon,
  GraphPointsSeries,
  GraphScaleMode,
  GraphSeries,
} from '@/types/question-contract'

type Domain = { xMin: number; xMax: number; yMin: number; yMax: number }
type Range = { xMin: number; xMax: number }
type Margins = { l: number; r: number; t: number; b: number }
type ScreenPoint = { x: number; y: number }

type NormalizedGraph = {
  color: GraphColor
  displayMode: GraphDisplayMode
  scaleMode: GraphScaleMode
  xMin?: number
  xMax?: number
  yMin?: number
  yMax?: number
  series: GraphSeries[]
  polygons: GraphPolygon[]
  labels: GraphLabel[]
  angleMarkers: GraphAngleMarker[]
}

type PreparedFunctionSeries = {
  kind: 'function'
  series: GraphFunctionSeries
  fn: (x: number) => number
  sampleRange: Range
  sampledPoints: GraphPoint[]
}

type PreparedPointsSeries = {
  kind: 'points'
  series: GraphPointsSeries
  points: GraphPoint[]
}

type PreparedSeries = PreparedFunctionSeries | PreparedPointsSeries

type EndpointDecoration = {
  point: GraphPoint
  text?: string
  textAnchor: 'start' | 'end'
  dx: number
  dy: number
}

type RenderedFunctionSeries = {
  kind: 'function'
  path: string
  endpoints: EndpointDecoration[]
}

type RenderedPointsSeries = {
  kind: 'points'
  poly: string
  points: GraphPoint[]
  endpoints: EndpointDecoration[]
}

type RenderedPolygon = {
  points: string
  fill: boolean
  stroke: boolean
}

type RenderedLabel = {
  point: ScreenPoint
  text: string
  dx: number
  dy: number
}

type RenderedAngleMarker = {
  path: string
}

type RenderedSeries = RenderedFunctionSeries | RenderedPointsSeries

type RenderState =
  | {
      error: string
      color: GraphColor
    }
  | {
      error: null
      color: GraphColor
      displayMode: GraphDisplayMode
      W: number
      H: number
      M: Margins
      PW: number
      PH: number
      stroke: string
      axisStroke: string
      gridStroke: string
      xTicks: number[]
      yTicks: number[]
      xAxisY: number
      yAxisX: number
      domain: Domain
      series: RenderedSeries[]
      polygons: RenderedPolygon[]
      labels: RenderedLabel[]
      angleMarkers: RenderedAngleMarker[]
      xToPx: (x: number) => number
      yToPx: (y: number) => number
    }

const DEFAULT_DOMAIN: Pick<Domain, 'xMin' | 'xMax'> = { xMin: -10, xMax: 10 }
const SAMPLE_COUNT = 400
const MAX_SAFE_Y = 1e6
const AUTO_DOMAIN_PADDING_RATIO = 0.08

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

function normalizeDisplayMode(raw: any): GraphDisplayMode {
  const mode = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return mode === 'alevelsketch' || mode === 'a_level_sketch' || mode === 'a-level-sketch'
    ? 'aLevelSketch'
    : 'standard'
}

function normalizeScaleMode(raw: any): GraphScaleMode {
  const mode = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return mode === 'fill' ? 'fill' : 'equalUnits'
}

function coerceNumber(n: any): number | null {
  if (typeof n === 'number' && Number.isFinite(n)) return n
  if (typeof n === 'string' && n.trim() !== '') {
    const v = Number(n)
    return Number.isFinite(v) ? v : null
  }
  return null
}

function coerceBoolean(n: any): boolean | undefined {
  return typeof n === 'boolean' ? n : undefined
}

function normalizeGraphPoint(raw: any): GraphPoint | null {
  if (!raw || typeof raw !== 'object') return null
  const x = coerceNumber(raw.x)
  const y = coerceNumber(raw.y)
  return isFiniteNumber(x) && isFiniteNumber(y) ? { x, y } : null
}

function normalizeGraphPolygon(raw: any): GraphPolygon | null {
  if (!raw || typeof raw !== 'object') return null

  const pointsRaw = Array.isArray(raw.points) ? raw.points : []
  const points = pointsRaw
    .map(normalizeGraphPoint)
    .filter(Boolean) as GraphPoint[]

  if (points.length < 3) return null

  const fill = coerceBoolean(raw.fill)
  const stroke = coerceBoolean(raw.stroke)
  if (fill === false && stroke === false) return null

  return {
    points,
    fill,
    stroke,
  }
}

function normalizeGraphLabel(raw: any): GraphLabel | null {
  if (!raw || typeof raw !== 'object') return null

  const x = coerceNumber(raw.x)
  const y = coerceNumber(raw.y)
  const text = typeof raw.text === 'string' ? raw.text.trim() : ''
  if (!text || !isFiniteNumber(x) || !isFiniteNumber(y)) return null

  const offsetX = coerceNumber(raw.offsetX ?? raw.offset_x)
  const offsetY = coerceNumber(raw.offsetY ?? raw.offset_y)

  return {
    x,
    y,
    text,
    offsetX: offsetX ?? undefined,
    offsetY: offsetY ?? undefined,
  }
}

function normalizeGraphAngleMarker(raw: any): GraphAngleMarker | null {
  if (!raw || typeof raw !== 'object') return null
  const type = typeof raw.type === 'string' ? raw.type.trim().toLowerCase() : ''
  if (type !== 'right') return null

  const vertex = normalizeGraphPoint(raw.vertex)
  const p1 = normalizeGraphPoint(raw.p1)
  const p2 = normalizeGraphPoint(raw.p2)
  if (!vertex || !p1 || !p2) return null

  return {
    vertex,
    p1,
    p2,
    type: 'right',
  }
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

function formatCoordinateLabel(point: GraphPoint): string {
  return `(${formatTick(point.x)}, ${formatTick(point.y)})`
}

function normalizeEquation(input: string): string {
  let s = input.trim()
  s = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi')
  s = s.replace(/²/g, '^2').replace(/³/g, '^3')
  s = s.replace(/(\d)\s*(x)/gi, '$1*$2')
  s = s.replace(/(\d)\s*\(/g, '$1*(')
  s = s.replace(/\)\s*(\d)/g, ')*$1')
  s = s.replace(/\)\s*(x)/gi, ')*$1')
  s = s.replace(/(x)\s*\(/gi, '$1*(')
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
  if (/[\[\]{};=<>`$]/.test(expr)) return 'Invalid characters in equation'
  if (!/^[0-9+\-*/().,\sA-Za-z_]*$/.test(expr)) return 'Equation contains unsupported characters'

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

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('x', body) as (x: number) => number
    return { fn, error: null }
  } catch {
    return { fn: () => NaN, error: 'Equation could not be parsed' }
  }
}

function normalizeGraphSeries(raw: any): GraphSeries | null {
  if (!raw || typeof raw !== 'object') return null

  const type = typeof raw.type === 'string' ? raw.type.trim().toLowerCase() : ''
  const showEndpoints = coerceBoolean(raw.showEndpoints ?? raw.show_endpoints)
  const showEndpointLabels = coerceBoolean(raw.showEndpointLabels ?? raw.show_endpoint_labels)

  if (type === 'function') {
    const equation = typeof raw.equation === 'string' ? raw.equation.trim() : ''
    if (!equation) return null

    let xStart = coerceNumber(raw.xStart ?? raw.x_start)
    let xEnd = coerceNumber(raw.xEnd ?? raw.x_end)
    if (xStart != null && xEnd != null && xStart > xEnd) {
      ;[xStart, xEnd] = [xEnd, xStart]
    }
    if (xStart != null && xEnd != null && xStart === xEnd) {
      xStart = null
      xEnd = null
    }

    return {
      type: 'function',
      equation,
      xStart: xStart ?? undefined,
      xEnd: xEnd ?? undefined,
      showEndpoints,
      showEndpointLabels,
    }
  }

  if (type === 'points') {
    const pointsRaw = Array.isArray(raw.points) ? raw.points : []
    const points: GraphPoint[] = pointsRaw
      .map((point: any) => ({
        x: coerceNumber(point?.x),
        y: coerceNumber(point?.y),
      }))
      .filter((point: any) => isFiniteNumber(point.x) && isFiniteNumber(point.y))
      .map((point: any) => ({ x: point.x, y: point.y }))

    if (points.length < 2) return null

    return {
      type: 'points',
      points,
      showEndpoints,
      showEndpointLabels,
    }
  }

  return null
}

function normalizeGraphConfig(graph: GraphConfig | null | undefined): NormalizedGraph | null {
  if (!graph || typeof graph !== 'object') return null

  const displayMode = normalizeDisplayMode((graph as any).displayMode ?? (graph as any).display_mode)
  const scaleMode = normalizeScaleMode((graph as any).scaleMode ?? (graph as any).scale_mode)
  const color = normalizeColor((graph as any).color)
  const xMin = coerceNumber((graph as any).xMin ?? (graph as any).x_min)
  const xMax = coerceNumber((graph as any).xMax ?? (graph as any).x_max)
  const yMin = coerceNumber((graph as any).yMin ?? (graph as any).y_min)
  const yMax = coerceNumber((graph as any).yMax ?? (graph as any).y_max)

  let series: GraphSeries[] = []
  if (Array.isArray((graph as any).series)) {
    series = ((graph as any).series as any[])
      .map(normalizeGraphSeries)
      .filter(Boolean) as GraphSeries[]
  } else {
    const legacySeries = normalizeGraphSeries(graph as any)
    if (legacySeries) series = [legacySeries]
  }

  const polygons = Array.isArray((graph as any).polygons)
    ? ((graph as any).polygons as any[])
        .map(normalizeGraphPolygon)
        .filter(Boolean) as GraphPolygon[]
    : []

  const labels = Array.isArray((graph as any).labels)
    ? ((graph as any).labels as any[])
        .map(normalizeGraphLabel)
        .filter(Boolean) as GraphLabel[]
    : []

  const angleMarkersRaw = (graph as any).angleMarkers ?? (graph as any).angle_markers
  const angleMarkers = Array.isArray(angleMarkersRaw)
    ? (angleMarkersRaw as any[])
        .map(normalizeGraphAngleMarker)
        .filter(Boolean) as GraphAngleMarker[]
    : []

  if (series.length === 0 && polygons.length === 0 && labels.length === 0 && angleMarkers.length === 0) {
    return null
  }

  return {
    color,
    displayMode,
    scaleMode,
    xMin: xMin ?? undefined,
    xMax: xMax ?? undefined,
    yMin: yMin ?? undefined,
    yMax: yMax ?? undefined,
    series,
    polygons,
    labels,
    angleMarkers,
  }
}

function getFunctionSampleRange(series: GraphFunctionSeries, graph: NormalizedGraph): Range {
  const fallbackMin = graph.xMin ?? DEFAULT_DOMAIN.xMin
  const fallbackMax = graph.xMax ?? DEFAULT_DOMAIN.xMax

  let xMin = series.xStart ?? fallbackMin
  let xMax = series.xEnd ?? fallbackMax

  if (xMin > xMax) [xMin, xMax] = [xMax, xMin]
  if (xMin === xMax) {
    xMin -= 1
    xMax += 1
  }

  return { xMin, xMax }
}

function sampleFunctionPoints(fn: (x: number) => number, range: Range, count = SAMPLE_COUNT): GraphPoint[] {
  const points: GraphPoint[] = []

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1)
    const x = range.xMin + t * (range.xMax - range.xMin)

    let y: number
    try {
      y = fn(x)
    } catch {
      continue
    }

    if (!Number.isFinite(y) || Math.abs(y) > MAX_SAFE_Y) continue
    points.push({ x, y })
  }

  return points
}

function expandRange(min: number, max: number, ratio: number): { min: number; max: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min, max }
  if (min === max) return { min: min - 1, max: max + 1 }

  const span = max - min
  const pad = span * ratio
  return { min: min - pad, max: max + pad }
}

function applyOverrides(domain: Domain, graph: NormalizedGraph): Domain {
  const out: Domain = { ...domain }

  if (graph.xMin != null) out.xMin = graph.xMin
  if (graph.xMax != null) out.xMax = graph.xMax
  if (graph.yMin != null) out.yMin = graph.yMin
  if (graph.yMax != null) out.yMax = graph.yMax

  if (out.xMin === out.xMax) {
    out.xMin -= 1
    out.xMax += 1
  }
  if (out.yMin === out.yMax) {
    out.yMin -= 1
    out.yMax += 1
  }

  if (out.xMin > out.xMax) [out.xMin, out.xMax] = [out.xMax, out.xMin]
  if (out.yMin > out.yMax) [out.yMin, out.yMax] = [out.yMax, out.yMin]

  return out
}

function buildBaseDomain(graph: NormalizedGraph, preparedSeries: PreparedSeries[]): Domain | null {
  let rawXMin = Infinity
  let rawXMax = -Infinity
  let rawYMin = Infinity
  let rawYMax = -Infinity

  for (const prepared of preparedSeries) {
    if (prepared.kind === 'points') {
      for (const point of prepared.points) {
        rawXMin = Math.min(rawXMin, point.x)
        rawXMax = Math.max(rawXMax, point.x)
        rawYMin = Math.min(rawYMin, point.y)
        rawYMax = Math.max(rawYMax, point.y)
      }
      continue
    }

    rawXMin = Math.min(rawXMin, prepared.sampleRange.xMin)
    rawXMax = Math.max(rawXMax, prepared.sampleRange.xMax)

    for (const point of prepared.sampledPoints) {
      rawYMin = Math.min(rawYMin, point.y)
      rawYMax = Math.max(rawYMax, point.y)
    }
  }

  for (const polygon of graph.polygons) {
    for (const point of polygon.points) {
      rawXMin = Math.min(rawXMin, point.x)
      rawXMax = Math.max(rawXMax, point.x)
      rawYMin = Math.min(rawYMin, point.y)
      rawYMax = Math.max(rawYMax, point.y)
    }
  }

  for (const label of graph.labels) {
    rawXMin = Math.min(rawXMin, label.x)
    rawXMax = Math.max(rawXMax, label.x)
    rawYMin = Math.min(rawYMin, label.y)
    rawYMax = Math.max(rawYMax, label.y)
  }

  for (const marker of graph.angleMarkers) {
    for (const point of [marker.vertex, marker.p1, marker.p2]) {
      rawXMin = Math.min(rawXMin, point.x)
      rawXMax = Math.max(rawXMax, point.x)
      rawYMin = Math.min(rawYMin, point.y)
      rawYMax = Math.max(rawYMax, point.y)
    }
  }

  if (!Number.isFinite(rawXMin) || !Number.isFinite(rawXMax)) {
    rawXMin = graph.xMin ?? DEFAULT_DOMAIN.xMin
    rawXMax = graph.xMax ?? DEFAULT_DOMAIN.xMax
  }
  if (!Number.isFinite(rawYMin) || !Number.isFinite(rawYMax)) {
    rawYMin = graph.yMin ?? -10
    rawYMax = graph.yMax ?? 10
  }

  const xRange = expandRange(rawXMin, rawXMax, AUTO_DOMAIN_PADDING_RATIO)
  const yRange = expandRange(rawYMin, rawYMax, AUTO_DOMAIN_PADDING_RATIO)

  return applyOverrides(
    {
      xMin: xRange.min,
      xMax: xRange.max,
      yMin: yRange.min,
      yMax: yRange.max,
    },
    graph
  )
}

function fitPlotRect(domain: Domain, outerMargins: Margins, width: number, height: number, scaleMode: GraphScaleMode) {
  const availableWidth = width - outerMargins.l - outerMargins.r
  const availableHeight = height - outerMargins.t - outerMargins.b

  if (scaleMode === 'fill') {
    return {
      margins: outerMargins,
      plotWidth: availableWidth,
      plotHeight: availableHeight,
    }
  }

  const domainWidth = Math.max(domain.xMax - domain.xMin, 1e-9)
  const domainHeight = Math.max(domain.yMax - domain.yMin, 1e-9)
  const pixelsPerUnit = Math.min(availableWidth / domainWidth, availableHeight / domainHeight)
  const plotWidth = domainWidth * pixelsPerUnit
  const plotHeight = domainHeight * pixelsPerUnit
  const padX = (availableWidth - plotWidth) / 2
  const padY = (availableHeight - plotHeight) / 2

  return {
    margins: {
      l: outerMargins.l + padX,
      r: outerMargins.r + padX,
      t: outerMargins.t + padY,
      b: outerMargins.b + padY,
    },
    plotWidth,
    plotHeight,
  }
}

function clampRangeToDomain(range: Range, domain: Domain): Range | null {
  const xMin = Math.max(range.xMin, domain.xMin)
  const xMax = Math.min(range.xMax, domain.xMax)
  if (xMin >= xMax) return null
  return { xMin, xMax }
}

function isVisiblePoint(point: GraphPoint, domain: Domain): boolean {
  return (
    point.x >= domain.xMin &&
    point.x <= domain.xMax &&
    point.y >= domain.yMin &&
    point.y <= domain.yMax
  )
}

function createEndpointDecorations(
  points: GraphPoint[],
  domain: Domain,
  showLabels: boolean
): EndpointDecoration[] {
  if (points.length === 0) return []

  const uniquePoints: GraphPoint[] = []
  const seen = new Set<string>()

  for (const point of points) {
    if (!isVisiblePoint(point, domain)) continue
    const key = `${point.x}|${point.y}`
    if (seen.has(key)) continue
    seen.add(key)
    uniquePoints.push(point)
  }

  const xMid = (domain.xMin + domain.xMax) / 2
  const yMid = (domain.yMin + domain.yMax) / 2

  return uniquePoints.map((point) => ({
    point,
    text: showLabels ? formatCoordinateLabel(point) : undefined,
    textAnchor: point.x >= xMid ? 'end' : 'start',
    dx: point.x >= xMid ? -8 : 8,
    dy: point.y >= yMid ? -8 : 14,
  }))
}

function buildFunctionPath(
  fn: (x: number) => number,
  range: Range,
  domain: Domain,
  xToPx: (x: number) => number,
  yToPx: (y: number) => number,
  margins: Margins,
  plotHeight: number
): string {
  let d = ''
  let penDown = false

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const t = SAMPLE_COUNT === 1 ? 0 : i / (SAMPLE_COUNT - 1)
    const x = range.xMin + t * (range.xMax - range.xMin)

    let y: number
    try {
      y = fn(x)
    } catch {
      penDown = false
      continue
    }

    if (!Number.isFinite(y) || Math.abs(y) > MAX_SAFE_Y) {
      penDown = false
      continue
    }

    const px = xToPx(x)
    const py = yToPx(y)
    if (py < margins.t - 2000 || py > margins.t + plotHeight + 2000) {
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

  return d.trim()
}

function evaluateFunctionPoint(fn: (x: number) => number, x: number): GraphPoint | null {
  try {
    const y = fn(x)
    if (!Number.isFinite(y) || Math.abs(y) > MAX_SAFE_Y) return null
    return { x, y }
  } catch {
    return null
  }
}

function toScreenPoint(point: GraphPoint, xToPx: (x: number) => number, yToPx: (y: number) => number): ScreenPoint {
  return { x: xToPx(point.x), y: yToPx(point.y) }
}

function buildPolygonPointsString(
  points: GraphPoint[],
  xToPx: (x: number) => number,
  yToPx: (y: number) => number
): string {
  return points.map((point) => `${xToPx(point.x).toFixed(2)},${yToPx(point.y).toFixed(2)}`).join(' ')
}

function buildRightAngleMarkerPath(
  marker: GraphAngleMarker,
  xToPx: (x: number) => number,
  yToPx: (y: number) => number
): string {
  const vertex = toScreenPoint(marker.vertex, xToPx, yToPx)
  const p1 = toScreenPoint(marker.p1, xToPx, yToPx)
  const p2 = toScreenPoint(marker.p2, xToPx, yToPx)

  const v1 = { x: p1.x - vertex.x, y: p1.y - vertex.y }
  const v2 = { x: p2.x - vertex.x, y: p2.y - vertex.y }
  const len1 = Math.hypot(v1.x, v1.y)
  const len2 = Math.hypot(v2.x, v2.y)
  if (len1 < 1 || len2 < 1) return ''

  const u1 = { x: v1.x / len1, y: v1.y / len1 }
  const u2 = { x: v2.x / len2, y: v2.y / len2 }
  const cross = u1.x * u2.y - u1.y * u2.x
  if (Math.abs(cross) < 1e-6) return ''

  const size = clamp(Math.min(len1, len2) * 0.18, 8, 18)
  const a = { x: vertex.x + u1.x * size, y: vertex.y + u1.y * size }
  const c = { x: vertex.x + u2.x * size, y: vertex.y + u2.y * size }
  const b = { x: a.x + u2.x * size, y: a.y + u2.y * size }

  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)} L ${c.x.toFixed(2)} ${c.y.toFixed(2)}`
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
  const normalizedGraph = useMemo(() => normalizeGraphConfig(graph), [graph])

  const render = useMemo<RenderState>(() => {
    if (!normalizedGraph) return { error: 'No graph data', color: 'white' }

    const color = normalizedGraph.color
    const W = 640
    const H = aspect === 'square' ? 640 : 360
    const outerMargins: Margins = { l: 46, r: 18, t: 18, b: 36 }

    const stroke = color === 'black' ? '#000000' : '#ffffff'
    const axisStroke = stroke
    const gridStroke = stroke

    const preparedSeries: PreparedSeries[] = []

    for (let i = 0; i < normalizedGraph.series.length; i++) {
      const series = normalizedGraph.series[i]

      if (series.type === 'points') {
        preparedSeries.push({
          kind: 'points',
          series,
          points: series.points,
        })
        continue
      }

      const { fn, error } = compileEquation(series.equation)
      if (error) {
        return { error: `Series ${i + 1}: ${error}`, color }
      }

      const sampleRange = getFunctionSampleRange(series, normalizedGraph)
      const sampledPoints = sampleFunctionPoints(fn, sampleRange)
      if (sampledPoints.length < 2) {
        return { error: `Series ${i + 1}: equation produced no plottable values`, color }
      }

      preparedSeries.push({
        kind: 'function',
        series,
        fn,
        sampleRange,
        sampledPoints,
      })
    }

    const domain = buildBaseDomain(normalizedGraph, preparedSeries)
    if (!domain) return { error: 'No graph data', color }

    const { margins: M, plotWidth: PW, plotHeight: PH } = fitPlotRect(
      domain,
      outerMargins,
      W,
      H,
      normalizedGraph.scaleMode
    )

    const xTicks = makeTicks(domain.xMin, domain.xMax, 6)
    const yTicks = makeTicks(domain.yMin, domain.yMax, 6)

    const xToPx = (x: number) => M.l + ((x - domain.xMin) / (domain.xMax - domain.xMin)) * PW
    const yToPx = (y: number) => M.t + (1 - (y - domain.yMin) / (domain.yMax - domain.yMin)) * PH

    const renderedSeries: RenderedSeries[] = preparedSeries.map((prepared) => {
      if (prepared.kind === 'points') {
        const poly = prepared.points
          .map((point) => `${xToPx(point.x).toFixed(2)},${yToPx(point.y).toFixed(2)}`)
          .join(' ')

        const shouldDecorateEndpoints =
          prepared.series.showEndpoints === true || prepared.series.showEndpointLabels === true
        const endpoints = shouldDecorateEndpoints
          ? createEndpointDecorations(
              [prepared.points[0], prepared.points[prepared.points.length - 1]],
              domain,
              prepared.series.showEndpointLabels === true
            )
          : []

        return {
          kind: 'points',
          poly,
          points: prepared.points,
          endpoints,
        }
      }

      const unclampedRange = getFunctionSampleRange(prepared.series, normalizedGraph)
      const plotRange = clampRangeToDomain(unclampedRange, domain)
      const path = plotRange ? buildFunctionPath(prepared.fn, plotRange, domain, xToPx, yToPx, M, PH) : ''
      const hasExplicitCap = prepared.series.xStart != null || prepared.series.xEnd != null

      const shouldDecorateEndpoints =
        hasExplicitCap &&
        (prepared.series.showEndpoints === true || prepared.series.showEndpointLabels === true)
      const endpointPoints =
        shouldDecorateEndpoints && plotRange
          ? [
              evaluateFunctionPoint(prepared.fn, plotRange.xMin),
              evaluateFunctionPoint(prepared.fn, plotRange.xMax),
            ].filter(Boolean) as GraphPoint[]
          : []

      return {
        kind: 'function',
        path,
        endpoints: shouldDecorateEndpoints
          ? createEndpointDecorations(endpointPoints, domain, prepared.series.showEndpointLabels === true)
          : [],
      }
    })

    const renderedPolygons: RenderedPolygon[] = normalizedGraph.polygons
      .map((polygon) => ({
        points: buildPolygonPointsString(polygon.points, xToPx, yToPx),
        fill: polygon.fill === true,
        stroke: polygon.stroke !== false,
      }))
      .filter((polygon) => polygon.points.length > 0)

    const renderedLabels: RenderedLabel[] = normalizedGraph.labels.map((label) => ({
      point: toScreenPoint({ x: label.x, y: label.y }, xToPx, yToPx),
      text: label.text,
      dx: label.offsetX ?? 8,
      dy: label.offsetY ?? -8,
    }))

    const renderedAngleMarkers: RenderedAngleMarker[] = normalizedGraph.angleMarkers
      .map((marker) => ({
        path: buildRightAngleMarkerPath(marker, xToPx, yToPx),
      }))
      .filter((marker) => marker.path.length > 0)

    const hasVisibleGeometry = renderedSeries.some((series) =>
      series.kind === 'function' ? series.path.length > 0 : series.poly.length > 0
    ) || renderedPolygons.length > 0 || renderedLabels.length > 0 || renderedAngleMarkers.length > 0
    if (!hasVisibleGeometry) {
      return { error: 'Graph produced no visible plots', color }
    }

    return {
      error: null,
      color,
      displayMode: normalizedGraph.displayMode,
      W,
      H,
      M,
      PW,
      PH,
      stroke,
      axisStroke,
      gridStroke,
      xTicks,
      yTicks,
      xAxisY: yToPx(clamp(0, domain.yMin, domain.yMax)),
      yAxisX: xToPx(clamp(0, domain.xMin, domain.xMax)),
      domain,
      series: renderedSeries,
      polygons: renderedPolygons,
      labels: renderedLabels,
      angleMarkers: renderedAngleMarkers,
      xToPx,
      yToPx,
    }
  }, [aspect, normalizedGraph])

  if (!normalizedGraph) return null

  if (render.error) {
    return (
      <div className={cn('w-full rounded-xl border border-white/10 p-3 text-xs text-white/70', className)}>
        <div className="mb-1 font-semibold">Graph unavailable</div>
        <div className="font-mono opacity-80">{String(render.error)}</div>
      </div>
    )
  }

  const isSketch = render.displayMode === 'aLevelSketch'
  const opacityAxis = isSketch ? 0.8 : 0.65
  const opacityGrid = isSketch ? 0 : 0.18
  const opacityBorder = isSketch ? 0 : 0.35

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${render.W} ${render.H}`}
        className="h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Question graph"
      >
        {!isSketch && (
          <rect
            x={render.M.l}
            y={render.M.t}
            width={render.PW}
            height={render.PH}
            fill="none"
            stroke={render.axisStroke}
            strokeOpacity={opacityBorder}
            strokeWidth={1}
          />
        )}

        {render.xTicks.map((x, i) => {
          const px = render.xToPx(x)
          return (
            <g key={`x-${i}`}>
              {!isSketch && (
                <line
                  x1={px}
                  y1={render.M.t}
                  x2={px}
                  y2={render.M.t + render.PH}
                  stroke={render.gridStroke}
                  strokeOpacity={opacityGrid}
                  strokeWidth={1}
                />
              )}
              {!isSketch && (
                <text
                  x={px}
                  y={render.M.t + render.PH + 18}
                  textAnchor="middle"
                  fontSize="10"
                  fill={render.axisStroke}
                  fillOpacity={opacityAxis}
                >
                  {formatTick(x)}
                </text>
              )}
            </g>
          )
        })}

        {render.yTicks.map((y, i) => {
          const py = render.yToPx(y)
          return (
            <g key={`y-${i}`}>
              {!isSketch && (
                <line
                  x1={render.M.l}
                  y1={py}
                  x2={render.M.l + render.PW}
                  y2={py}
                  stroke={render.gridStroke}
                  strokeOpacity={opacityGrid}
                  strokeWidth={1}
                />
              )}
              {!isSketch && (
                <text
                  x={render.M.l - 8}
                  y={py + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill={render.axisStroke}
                  fillOpacity={opacityAxis}
                >
                  {formatTick(y)}
                </text>
              )}
            </g>
          )
        })}

        <line
          x1={render.M.l}
          y1={render.xAxisY}
          x2={render.M.l + render.PW}
          y2={render.xAxisY}
          stroke={render.axisStroke}
          strokeOpacity={opacityAxis}
          strokeWidth={isSketch ? 1 : 1.2}
        />
        <line
          x1={render.yAxisX}
          y1={render.M.t}
          x2={render.yAxisX}
          y2={render.M.t + render.PH}
          stroke={render.axisStroke}
          strokeOpacity={opacityAxis}
          strokeWidth={isSketch ? 1 : 1.2}
        />

        {render.polygons.map((polygon, polygonIndex) => (
          <polygon
            key={`polygon-${polygonIndex}`}
            points={polygon.points}
            fill={polygon.fill ? render.stroke : 'none'}
            fillOpacity={polygon.fill ? (isSketch ? 0.08 : 0.1) : 0}
            stroke={polygon.stroke ? render.stroke : 'none'}
            strokeOpacity={polygon.stroke ? 0.95 : 0}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        ))}

        {render.series.map((series, seriesIndex) => (
          <g key={`series-${seriesIndex}`}>
            {series.kind === 'function' ? (
              <path
                d={series.path}
                fill="none"
                stroke={render.stroke}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : (
              <>
                <polyline
                  points={series.poly}
                  fill="none"
                  stroke={render.stroke}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {series.points.map((point, pointIndex) => (
                  <circle
                    key={`point-${seriesIndex}-${pointIndex}`}
                    cx={render.xToPx(point.x)}
                    cy={render.yToPx(point.y)}
                    r={2.5}
                    fill={render.stroke}
                    fillOpacity={isSketch ? 0.82 : 0.65}
                  />
                ))}
              </>
            )}

            {series.endpoints.map((endpoint, endpointIndex) => (
              <g key={`endpoint-${seriesIndex}-${endpointIndex}`}>
                <circle
                  cx={render.xToPx(endpoint.point.x)}
                  cy={render.yToPx(endpoint.point.y)}
                  r={4}
                  fill={render.stroke}
                  fillOpacity={0.95}
                />
                {endpoint.text ? (
                  <text
                    x={render.xToPx(endpoint.point.x) + endpoint.dx}
                    y={render.yToPx(endpoint.point.y) + endpoint.dy}
                    textAnchor={endpoint.textAnchor}
                    fontSize="11"
                    fill={render.axisStroke}
                    fillOpacity={0.95}
                  >
                    {endpoint.text}
                  </text>
                ) : null}
              </g>
            ))}
          </g>
        ))}

        {render.angleMarkers.map((marker, markerIndex) => (
          <path
            key={`angle-marker-${markerIndex}`}
            d={marker.path}
            fill="none"
            stroke={render.stroke}
            strokeOpacity={0.95}
            strokeWidth={1.8}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {render.labels.map((label, labelIndex) => (
          <text
            key={`label-${labelIndex}`}
            x={label.point.x + label.dx}
            y={label.point.y + label.dy}
            fontSize={isSketch ? '13' : '12'}
            fill={render.axisStroke}
            fillOpacity={0.98}
          >
            {label.text}
          </text>
        ))}
      </svg>
    </div>
  )
}


