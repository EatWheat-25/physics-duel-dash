import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import type {
  GraphAngleMarker,
  GraphArc,
  GraphArcFill,
  GraphCircle,
  GraphColor,
  GraphConfig,
  GraphDisplayMode,
  GraphScaleMode,
  GraphLabel,
  GraphPoint,
  GraphPolygon,
  GraphSegment,
  GraphSeries,
} from '@/types/question-contract';
import { StepBasedQuestion, QuestionStep } from '@/types/question-contract';
import { dbRowToQuestion } from '@/lib/question-contract';
import { uploadQuestionImage } from '@/utils/questionImageUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, ArrowLeft, Shield, Save, X, Search, Filter, Eye, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import SpaceBackground from '@/components/SpaceBackground';
import { useIsAdmin } from '@/hooks/useUserRole';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScienceText } from '@/components/chem/ScienceText';
import { SmilesDiagram } from '@/components/chem/SmilesDiagram';
import { GameQuestionPreview } from '@/components/battle/GameQuestionPreview';
import { InGamePreview } from '@/components/admin/InGamePreview';
import { SmilesPresetSelect } from '@/components/admin/SmilesPresetSelect';
import { QuestionGraph } from '@/components/math/QuestionGraph';
import { smilesAuthoringWarnings } from '@/lib/smilesAuthoringHints';
import { hasMathDelimiters, normalizeInlineMathOption, optionNeedsInlineMathWrapper } from '@/lib/optionMath';
import { getArchetypeValue, setArchetypeTag, getSuggestedFamilies } from '@/lib/archetypes';

const PHYSICS_A1_CHAPTER_TITLES: string[] = [
  'Chapter 1: Physical Quantities',
  'Chapter 2: Kinematics',
  'Chapter 3: Dynamics',
  'Chapter 4: Force Density and Pressure',
  'Chapter 5: Work, Power and Energy',
  'Chapter 6: Deformation of Solids',
  'Chapter 7: Waves',
  'Chapter 8: Superpositions',
  'Chapter 9: Current of Electricity',
  'Chapter 10: DC Circuits',
  'Chapter 11: Nuclear Physics',
];

const CHEMISTRY_CHAPTER_TITLES: string[] = [
  'Atomic Structure',
  'Moles & Calculations',
  'Bonding & Structure',
  'States of Matter & Gases',
  'Energetics',
  'Rate of Reaction',
  'Equilibrium',
  'Acids, Bases & pH',
  'Redox & Electrochemistry',
  'Periodicity & Group Chemistry',
  'Organic Basics',
  'Hydrocarbons',
  'Organic Functional Groups',
  'Analytical Techniques',
];

const MATH_A1_CHAPTER_TITLES: string[] = [
  'Coordinate geometry',
  'Circular measure',
  'sequence',
  'Binomial',
  'quadratics',
  'Trignometry',
  'Functions',
  'Differenciation',
  'Integeration',
];

const MATH_A2_CHAPTER_TITLES: string[] = [
  'Algebra',
  'Binomial',
  'Logarithmic and Exponential Functions',
  'Trigonometry',
  'Differentiation',
  'Integration',
  'Differential Equations',
  'Numerical Solutions',
  'Vectors',
  'Complex Numbers',
];

const QUESTIONS_PAGE_SIZE = 1000;
const QUESTIONS_MAX_PAGES = 50;

type QuestionFilter = {
  subject: 'all' | 'math' | 'physics' | 'chemistry';
  level: 'all' | 'A1' | 'A2';
  difficulty: 'all' | 'easy' | 'medium' | 'hard';
  rankTier: string;
  done: 'all' | 'done' | 'pending';
};

type BulkEditState = {
  subject: 'keep' | 'math' | 'physics' | 'chemistry';
  chapter: string;
  level: 'keep' | 'A1' | 'A2';
  difficulty: 'keep' | 'easy' | 'medium' | 'hard';
  mainQuestionTimerSeconds: string;
};

type EditorMode = 'idle' | 'creating' | 'editing';

type FormSubStep = {
  type: 'mcq' | 'true_false';
  prompt: string;
  options: string[];
  correctAnswer: number;
  timeLimitSeconds: number | null;
  explanation: string;
};

type FormStep = {
  id?: string;
  type: 'mcq' | 'true_false';
  title: string;
  prompt: string;
  diagramSmiles: string;
  diagramImageUrl: string;
  options: string[];
  correctAnswer: number;
  marks: number;
  timeLimitSeconds: number | null;
  explanation: string;
  subSteps: FormSubStep[];
};

type FormGraphSeries = {
  id: string;
  type: 'function' | 'points';
  equation: string;
  pointsText: string;
  xStart: string;
  xEnd: string;
  showEndpoints: boolean;
  showEndpointLabels: boolean;
};

type FormGraphPolygon = {
  id: string;
  pointsText: string;
  fill: boolean;
  stroke: boolean;
};

type FormGraphLabel = {
  id: string;
  x: string;
  y: string;
  text: string;
  offsetX: string;
  offsetY: string;
};

type FormGraphAngleMarker = {
  id: string;
  type: 'right';
  vertexX: string;
  vertexY: string;
  p1X: string;
  p1Y: string;
  p2X: string;
  p2Y: string;
};

type FormGraphCircle = {
  id: string;
  centerX: string;
  centerY: string;
  radius: string;
  fill: boolean;
  stroke: boolean;
};

type FormGraphArc = {
  id: string;
  centerX: string;
  centerY: string;
  radius: string;
  startAngle: string;
  endAngle: string;
  fill: GraphArcFill;
  stroke: boolean;
};

type FormGraphSegment = {
  id: string;
  fromX: string;
  fromY: string;
  toX: string;
  toY: string;
};

type QuestionForm = {
  title: string;
  subject: 'math' | 'physics' | 'chemistry';
  chapter: string;
  level: 'A1' | 'A2';
  difficulty: 'easy' | 'medium' | 'hard';
  rankTier: string;
  isEnabled: boolean;
  stem: string;
  structureSmiles: string;
  // One graph per question (optional)
  graphEnabled: boolean;
  graphColor: GraphColor; // white|black
  graphDisplayMode: GraphDisplayMode;
  graphScaleMode: GraphScaleMode;
  graphSeries: FormGraphSeries[];
  graphPolygons: FormGraphPolygon[];
  graphLabels: FormGraphLabel[];
  graphAngleMarkers: FormGraphAngleMarker[];
  graphCircles: FormGraphCircle[];
  graphArcs: FormGraphArc[];
  graphSegments: FormGraphSegment[];
  graphXMin: string;
  graphXMax: string;
  graphYMin: string;
  graphYMax: string;
  mainQuestionTimerSeconds: number;
  totalMarks: number;
  topicTags: string; // Comma-separated string for editing
  steps: FormStep[];
  imageUrl: string;
};

type MappingIssue = {
  idx: number;
  message: string;
  rowId?: string;
  title?: string;
};

type FetchStats = {
  rawCount: number;
  mappedCount: number;
  fetchedAtIso: string;
  errorMessage?: string;
};

type ChemTestRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

function normalizeGraphColor(raw: any): GraphColor {
  const c = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return c === 'black' ? 'black' : 'white'
}

function normalizeGraphScaleMode(raw: any): GraphScaleMode {
  const mode = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return mode === 'fill' ? 'fill' : 'equalUnits'
}

function parseNumberOrUndefined(raw: string): number | undefined {
  const s = String(raw ?? '').trim()
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

function parseGraphPointsText(text: string): GraphPoint[] | null {
  const raw = String(text ?? '').trim()
  if (!raw) return null

  // JSON array format: [{"x":0,"y":0},{"x":5,"y":10}]
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const pts: GraphPoint[] = parsed
          .map((p: any) => ({ x: Number(p?.x), y: Number(p?.y) }))
          .filter((p: any) => Number.isFinite(p.x) && Number.isFinite(p.y))
        return pts.length >= 2 ? pts : null
      }
    } catch {
      // fall through
    }
  }

  // CSV / whitespace lines: "0,0" per line or "0 0"
  const pts: GraphPoint[] = []
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    const parts = t.includes(',')
      ? t.split(',').map((p) => p.trim())
      : t.split(/\s+/).map((p) => p.trim())
    if (parts.length < 2) continue
    const x = Number(parts[0])
    const y = Number(parts[1])
    if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y })
  }
  return pts.length >= 2 ? pts : null
}

function pointsToText(points: GraphPoint[]): string {
  return points.map((p) => `${p.x},${p.y}`).join('\n')
}

function createGraphFormItemId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`
}

function createFormGraphSeriesId(): string {
  return createGraphFormItemId('graph-series')
}

function getEmptyGraphSeries(type: 'function' | 'points' = 'function'): FormGraphSeries {
  return {
    id: createFormGraphSeriesId(),
    type,
    equation: '',
    pointsText: '',
    xStart: '',
    xEnd: '',
    showEndpoints: false,
    showEndpointLabels: false,
  }
}

function getEmptyGraphPolygon(): FormGraphPolygon {
  return {
    id: createGraphFormItemId('graph-polygon'),
    pointsText: '',
    fill: false,
    stroke: true,
  }
}

function getEmptyGraphLabel(): FormGraphLabel {
  return {
    id: createGraphFormItemId('graph-label'),
    x: '',
    y: '',
    text: '',
    offsetX: '',
    offsetY: '',
  }
}

function getEmptyGraphAngleMarker(): FormGraphAngleMarker {
  return {
    id: createGraphFormItemId('graph-angle-marker'),
    type: 'right',
    vertexX: '',
    vertexY: '',
    p1X: '',
    p1Y: '',
    p2X: '',
    p2Y: '',
  }
}

function getEmptyGraphCircle(): FormGraphCircle {
  return {
    id: createGraphFormItemId('graph-circle'),
    centerX: '',
    centerY: '',
    radius: '',
    fill: false,
    stroke: true,
  }
}

function getEmptyGraphArc(): FormGraphArc {
  return {
    id: createGraphFormItemId('graph-arc'),
    centerX: '',
    centerY: '',
    radius: '',
    startAngle: '',
    endAngle: '',
    fill: 'none',
    stroke: true,
  }
}

function getEmptyGraphSegment(): FormGraphSegment {
  return {
    id: createGraphFormItemId('graph-segment'),
    fromX: '',
    fromY: '',
    toX: '',
    toY: '',
  }
}

function getGraphSeriesFromConfig(graph: GraphConfig | null | undefined): FormGraphSeries[] {
  const rawSeries = Array.isArray((graph as any)?.series)
    ? ((graph as any).series as any[])
    : graph && typeof (graph as any).type === 'string'
      ? [graph as any]
      : []

  const series = rawSeries
    .map((raw): FormGraphSeries | null => {
      const type = raw?.type === 'points' ? 'points' : raw?.type === 'function' ? 'function' : null
      if (!type) return null

      return {
        id: createFormGraphSeriesId(),
        type,
        equation: type === 'function' ? String(raw?.equation ?? '') : '',
        pointsText: type === 'points' ? pointsToText(Array.isArray(raw?.points) ? raw.points : []) : '',
        xStart: type === 'function' && typeof raw?.xStart === 'number' ? String(raw.xStart) : '',
        xEnd: type === 'function' && typeof raw?.xEnd === 'number' ? String(raw.xEnd) : '',
        showEndpoints: raw?.showEndpoints === true,
        showEndpointLabels: raw?.showEndpointLabels === true,
      }
    })
    .filter(Boolean) as FormGraphSeries[]

  return series.length > 0 ? series : [getEmptyGraphSeries('function')]
}

function getGraphPolygonsFromConfig(graph: GraphConfig | null | undefined): FormGraphPolygon[] {
  const rawPolygons = Array.isArray((graph as any)?.polygons) ? ((graph as any).polygons as any[]) : []
  return rawPolygons
    .map((raw): FormGraphPolygon | null => {
      const points = Array.isArray(raw?.points) ? raw.points : []
      if (points.length < 3) return null
      return {
        id: createGraphFormItemId('graph-polygon'),
        pointsText: pointsToText(points),
        fill: raw?.fill === true,
        stroke: raw?.stroke !== false,
      }
    })
    .filter(Boolean) as FormGraphPolygon[]
}

function getGraphLabelsFromConfig(graph: GraphConfig | null | undefined): FormGraphLabel[] {
  const rawLabels = Array.isArray((graph as any)?.labels) ? ((graph as any).labels as any[]) : []
  return rawLabels
    .map((raw): FormGraphLabel | null => {
      if (typeof raw?.text !== 'string') return null
      return {
        id: createGraphFormItemId('graph-label'),
        x: typeof raw?.x === 'number' ? String(raw.x) : '',
        y: typeof raw?.y === 'number' ? String(raw.y) : '',
        text: raw.text,
        offsetX: typeof raw?.offsetX === 'number' ? String(raw.offsetX) : '',
        offsetY: typeof raw?.offsetY === 'number' ? String(raw.offsetY) : '',
      }
    })
    .filter(Boolean) as FormGraphLabel[]
}

function getGraphAngleMarkersFromConfig(graph: GraphConfig | null | undefined): FormGraphAngleMarker[] {
  const rawMarkers = Array.isArray((graph as any)?.angleMarkers) ? ((graph as any).angleMarkers as any[]) : []
  return rawMarkers
    .map((raw): FormGraphAngleMarker | null => {
      if (raw?.type !== 'right') return null
      return {
        id: createGraphFormItemId('graph-angle-marker'),
        type: 'right',
        vertexX: typeof raw?.vertex?.x === 'number' ? String(raw.vertex.x) : '',
        vertexY: typeof raw?.vertex?.y === 'number' ? String(raw.vertex.y) : '',
        p1X: typeof raw?.p1?.x === 'number' ? String(raw.p1.x) : '',
        p1Y: typeof raw?.p1?.y === 'number' ? String(raw.p1.y) : '',
        p2X: typeof raw?.p2?.x === 'number' ? String(raw.p2.x) : '',
        p2Y: typeof raw?.p2?.y === 'number' ? String(raw.p2.y) : '',
      }
    })
    .filter(Boolean) as FormGraphAngleMarker[]
}

function getGraphCirclesFromConfig(graph: GraphConfig | null | undefined): FormGraphCircle[] {
  const rawCircles = Array.isArray((graph as any)?.circles) ? ((graph as any).circles as any[]) : []
  return rawCircles
    .map((raw): FormGraphCircle | null => {
      if (typeof raw?.center?.x !== 'number' || typeof raw?.center?.y !== 'number') return null
      if (typeof raw?.radius !== 'number') return null
      return {
        id: createGraphFormItemId('graph-circle'),
        centerX: String(raw.center.x),
        centerY: String(raw.center.y),
        radius: String(raw.radius),
        fill: raw?.fill === true,
        stroke: raw?.stroke !== false,
      }
    })
    .filter(Boolean) as FormGraphCircle[]
}

function getGraphArcsFromConfig(graph: GraphConfig | null | undefined): FormGraphArc[] {
  const rawArcs = Array.isArray((graph as any)?.arcs) ? ((graph as any).arcs as any[]) : []
  return rawArcs
    .map((raw): FormGraphArc | null => {
      if (typeof raw?.center?.x !== 'number' || typeof raw?.center?.y !== 'number') return null
      if (typeof raw?.radius !== 'number') return null
      if (typeof raw?.startAngle !== 'number' || typeof raw?.endAngle !== 'number') return null
      const fill: GraphArcFill = raw?.fill === 'segment' || raw?.fill === 'sector' ? raw.fill : 'none'
      return {
        id: createGraphFormItemId('graph-arc'),
        centerX: String(raw.center.x),
        centerY: String(raw.center.y),
        radius: String(raw.radius),
        startAngle: String(raw.startAngle),
        endAngle: String(raw.endAngle),
        fill,
        stroke: raw?.stroke !== false,
      }
    })
    .filter(Boolean) as FormGraphArc[]
}

function getGraphSegmentsFromConfig(graph: GraphConfig | null | undefined): FormGraphSegment[] {
  const rawSegments = Array.isArray((graph as any)?.segments) ? ((graph as any).segments as any[]) : []
  return rawSegments
    .map((raw): FormGraphSegment | null => {
      if (typeof raw?.from?.x !== 'number' || typeof raw?.from?.y !== 'number') return null
      if (typeof raw?.to?.x !== 'number' || typeof raw?.to?.y !== 'number') return null
      return {
        id: createGraphFormItemId('graph-segment'),
        fromX: String(raw.from.x),
        fromY: String(raw.from.y),
        toX: String(raw.to.x),
        toY: String(raw.to.y),
      }
    })
    .filter(Boolean) as FormGraphSegment[]
}

function buildGraphSeriesFromForm(series: FormGraphSeries): GraphSeries | null {
  if (series.type === 'function') {
    const equation = String(series.equation ?? '').trim()
    if (!equation) return null

    return {
      type: 'function',
      equation,
      xStart: parseNumberOrUndefined(series.xStart),
      xEnd: parseNumberOrUndefined(series.xEnd),
      showEndpoints: !!series.showEndpoints,
      showEndpointLabels: !!series.showEndpointLabels,
    }
  }

  const points = parseGraphPointsText(series.pointsText)
  if (!points) return null

  return {
    type: 'points',
    points,
    showEndpoints: !!series.showEndpoints,
    showEndpointLabels: !!series.showEndpointLabels,
  }
}

function parseGraphPolygonPointsText(text: string): GraphPoint[] | null {
  const points = parseGraphPointsText(text)
  return points && points.length >= 3 ? points : null
}

function buildGraphPolygonFromForm(polygon: FormGraphPolygon): GraphPolygon | null {
  const points = parseGraphPolygonPointsText(polygon.pointsText)
  if (!points) return null
  if (!polygon.fill && !polygon.stroke) return null

  return {
    points,
    fill: !!polygon.fill,
    stroke: !!polygon.stroke,
  }
}

function buildGraphLabelFromForm(label: FormGraphLabel): GraphLabel | null {
  const text = String(label.text ?? '').trim()
  const x = parseNumberOrUndefined(label.x)
  const y = parseNumberOrUndefined(label.y)
  if (!text || x == null || y == null) return null

  return {
    x,
    y,
    text,
    offsetX: parseNumberOrUndefined(label.offsetX),
    offsetY: parseNumberOrUndefined(label.offsetY),
  }
}

function buildGraphAngleMarkerFromForm(marker: FormGraphAngleMarker): GraphAngleMarker | null {
  const vertexX = parseNumberOrUndefined(marker.vertexX)
  const vertexY = parseNumberOrUndefined(marker.vertexY)
  const p1X = parseNumberOrUndefined(marker.p1X)
  const p1Y = parseNumberOrUndefined(marker.p1Y)
  const p2X = parseNumberOrUndefined(marker.p2X)
  const p2Y = parseNumberOrUndefined(marker.p2Y)

  if (
    vertexX == null ||
    vertexY == null ||
    p1X == null ||
    p1Y == null ||
    p2X == null ||
    p2Y == null
  ) {
    return null
  }

  return {
    type: 'right',
    vertex: { x: vertexX, y: vertexY },
    p1: { x: p1X, y: p1Y },
    p2: { x: p2X, y: p2Y },
  }
}

function buildGraphCircleFromForm(circle: FormGraphCircle): GraphCircle | null {
  const centerX = parseNumberOrUndefined(circle.centerX)
  const centerY = parseNumberOrUndefined(circle.centerY)
  const radius = parseNumberOrUndefined(circle.radius)
  if (centerX == null || centerY == null || radius == null || radius <= 0) return null
  if (!circle.fill && !circle.stroke) return null

  return {
    center: { x: centerX, y: centerY },
    radius,
    fill: !!circle.fill,
    stroke: !!circle.stroke,
  }
}

function buildGraphArcFromForm(arc: FormGraphArc): GraphArc | null {
  const centerX = parseNumberOrUndefined(arc.centerX)
  const centerY = parseNumberOrUndefined(arc.centerY)
  const radius = parseNumberOrUndefined(arc.radius)
  const startAngle = parseNumberOrUndefined(arc.startAngle)
  const endAngle = parseNumberOrUndefined(arc.endAngle)
  if (centerX == null || centerY == null || radius == null || radius <= 0) return null
  if (startAngle == null || endAngle == null || startAngle === endAngle) return null

  const fill: GraphArcFill = arc.fill === 'segment' || arc.fill === 'sector' ? arc.fill : 'none'

  return {
    center: { x: centerX, y: centerY },
    radius,
    startAngle,
    endAngle,
    fill,
    stroke: !!arc.stroke,
  }
}

function buildGraphSegmentFromForm(segment: FormGraphSegment): GraphSegment | null {
  const fromX = parseNumberOrUndefined(segment.fromX)
  const fromY = parseNumberOrUndefined(segment.fromY)
  const toX = parseNumberOrUndefined(segment.toX)
  const toY = parseNumberOrUndefined(segment.toY)
  if (fromX == null || fromY == null || toX == null || toY == null) return null
  if (fromX === toX && fromY === toY) return null

  return {
    from: { x: fromX, y: fromY },
    to: { x: toX, y: toY },
  }
}

function isBlankGraphSeries(series: FormGraphSeries): boolean {
  if (series.type === 'function') {
    return (
      !String(series.equation ?? '').trim() &&
      !String(series.xStart ?? '').trim() &&
      !String(series.xEnd ?? '').trim() &&
      !series.showEndpoints &&
      !series.showEndpointLabels
    )
  }

  return (
    !String(series.pointsText ?? '').trim() &&
    !series.showEndpoints &&
    !series.showEndpointLabels
  )
}

function isBlankGraphPolygon(polygon: FormGraphPolygon): boolean {
  return !String(polygon.pointsText ?? '').trim() && !polygon.fill && !!polygon.stroke
}

function isBlankGraphLabel(label: FormGraphLabel): boolean {
  return (
    !String(label.x ?? '').trim() &&
    !String(label.y ?? '').trim() &&
    !String(label.text ?? '').trim() &&
    !String(label.offsetX ?? '').trim() &&
    !String(label.offsetY ?? '').trim()
  )
}

function isBlankGraphAngleMarker(marker: FormGraphAngleMarker): boolean {
  return (
    !String(marker.vertexX ?? '').trim() &&
    !String(marker.vertexY ?? '').trim() &&
    !String(marker.p1X ?? '').trim() &&
    !String(marker.p1Y ?? '').trim() &&
    !String(marker.p2X ?? '').trim() &&
    !String(marker.p2Y ?? '').trim()
  )
}

function validateGraphSeriesForm(series: FormGraphSeries, index: number): string | null {
  if (isBlankGraphSeries(series)) return null

  if (series.type === 'function') {
    if (!String(series.equation ?? '').trim()) {
      return `Graph series ${index + 1}: please provide a valid equation.`
    }

    const xStart = parseNumberOrUndefined(series.xStart)
    const xEnd = parseNumberOrUndefined(series.xEnd)
    if (xStart != null && xEnd != null && xStart >= xEnd) {
      return `Graph series ${index + 1}: xStart must be less than xEnd.`
    }

    return null
  }

  const points = parseGraphPointsText(series.pointsText)
  if (!points) {
    return `Graph series ${index + 1}: please provide at least 2 valid points.`
  }

  return null
}

function validateGraphPolygonForm(polygon: FormGraphPolygon, index: number): string | null {
  if (isBlankGraphPolygon(polygon)) return null
  if (!polygon.fill && !polygon.stroke) {
    return `Polygon ${index + 1}: enable stroke and/or fill.`
  }

  const points = parseGraphPolygonPointsText(polygon.pointsText)
  if (!points) {
    return `Polygon ${index + 1}: please provide at least 3 valid points.`
  }

  return null
}

function validateGraphLabelForm(label: FormGraphLabel, index: number): string | null {
  if (isBlankGraphLabel(label)) return null
  if (!String(label.text ?? '').trim()) {
    return `Label ${index + 1}: please enter label text.`
  }

  const x = parseNumberOrUndefined(label.x)
  const y = parseNumberOrUndefined(label.y)
  if (x == null || y == null) {
    return `Label ${index + 1}: x and y must be valid numbers.`
  }

  const offsetX = parseNumberOrUndefined(label.offsetX)
  const offsetY = parseNumberOrUndefined(label.offsetY)
  if (String(label.offsetX ?? '').trim() && offsetX == null) {
    return `Label ${index + 1}: offsetX must be a valid number.`
  }
  if (String(label.offsetY ?? '').trim() && offsetY == null) {
    return `Label ${index + 1}: offsetY must be a valid number.`
  }

  return null
}

function validateGraphAngleMarkerForm(marker: FormGraphAngleMarker, index: number): string | null {
  if (isBlankGraphAngleMarker(marker)) return null
  if (!buildGraphAngleMarkerFromForm(marker)) {
    return `Angle marker ${index + 1}: vertex, p1, and p2 must all be valid coordinates.`
  }
  return null
}

function isBlankGraphCircle(circle: FormGraphCircle): boolean {
  return (
    !String(circle.centerX ?? '').trim() &&
    !String(circle.centerY ?? '').trim() &&
    !String(circle.radius ?? '').trim() &&
    !circle.fill &&
    !!circle.stroke
  )
}

function isBlankGraphArc(arc: FormGraphArc): boolean {
  return (
    !String(arc.centerX ?? '').trim() &&
    !String(arc.centerY ?? '').trim() &&
    !String(arc.radius ?? '').trim() &&
    !String(arc.startAngle ?? '').trim() &&
    !String(arc.endAngle ?? '').trim() &&
    arc.fill === 'none' &&
    !!arc.stroke
  )
}

function isBlankGraphSegment(segment: FormGraphSegment): boolean {
  return (
    !String(segment.fromX ?? '').trim() &&
    !String(segment.fromY ?? '').trim() &&
    !String(segment.toX ?? '').trim() &&
    !String(segment.toY ?? '').trim()
  )
}

function validateGraphCircleForm(circle: FormGraphCircle, index: number): string | null {
  if (isBlankGraphCircle(circle)) return null
  if (!circle.fill && !circle.stroke) {
    return `Circle ${index + 1}: enable stroke and/or fill.`
  }
  if (!buildGraphCircleFromForm(circle)) {
    return `Circle ${index + 1}: center and a positive radius must be valid numbers.`
  }
  return null
}

function validateGraphArcForm(arc: FormGraphArc, index: number): string | null {
  if (isBlankGraphArc(arc)) return null
  if (!buildGraphArcFromForm(arc)) {
    return `Arc ${index + 1}: center, positive radius, and distinct start/end angles must be valid.`
  }
  return null
}

function validateGraphSegmentForm(segment: FormGraphSegment, index: number): string | null {
  if (isBlankGraphSegment(segment)) return null
  if (!buildGraphSegmentFromForm(segment)) {
    return `Segment ${index + 1}: from and to must be valid, distinct coordinates.`
  }
  return null
}

function needsSciencePreview(text: string | null | undefined): boolean {
  const s = String(text ?? '')
  if (!s.trim()) return false
  return (
    s.includes('$') ||
    s.includes('\\ce{') ||
    s.includes('\\(') ||
    s.includes('\\[') ||
    s.includes('[[smiles:') ||
    s.includes('[[img:')
  )
}

function countUnescapedDollars(text: string): number {
  let count = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '$') continue
    const prev = i > 0 ? text[i - 1] : ''
    if (prev === '\\') continue
    count++
  }
  return count
}

function buildGraphConfigFromForm(form: QuestionForm): GraphConfig | null {
  if (!form.graphEnabled) return null

  const displayMode: GraphDisplayMode =
    form.graphDisplayMode === 'aLevelSketch'
      ? 'aLevelSketch'
      : form.graphDisplayMode === 'blank'
        ? 'blank'
        : 'standard'
  const scaleMode = form.graphScaleMode === 'fill' ? 'fill' : 'equalUnits'
  const color = normalizeGraphColor(form.graphColor)
  const xMin = parseNumberOrUndefined(form.graphXMin)
  const xMax = parseNumberOrUndefined(form.graphXMax)
  const yMin = parseNumberOrUndefined(form.graphYMin)
  const yMax = parseNumberOrUndefined(form.graphYMax)
  const series = (Array.isArray(form.graphSeries) ? form.graphSeries : [])
    .map(buildGraphSeriesFromForm)
    .filter(Boolean) as GraphSeries[]
  const polygons = (Array.isArray(form.graphPolygons) ? form.graphPolygons : [])
    .map(buildGraphPolygonFromForm)
    .filter(Boolean) as GraphPolygon[]
  const labels = (Array.isArray(form.graphLabels) ? form.graphLabels : [])
    .map(buildGraphLabelFromForm)
    .filter(Boolean) as GraphLabel[]
  const angleMarkers = (Array.isArray(form.graphAngleMarkers) ? form.graphAngleMarkers : [])
    .map(buildGraphAngleMarkerFromForm)
    .filter(Boolean) as GraphAngleMarker[]
  const circles = (Array.isArray(form.graphCircles) ? form.graphCircles : [])
    .map(buildGraphCircleFromForm)
    .filter(Boolean) as GraphCircle[]
  const arcs = (Array.isArray(form.graphArcs) ? form.graphArcs : [])
    .map(buildGraphArcFromForm)
    .filter(Boolean) as GraphArc[]
  const segments = (Array.isArray(form.graphSegments) ? form.graphSegments : [])
    .map(buildGraphSegmentFromForm)
    .filter(Boolean) as GraphSegment[]

  if (
    series.length === 0 &&
    polygons.length === 0 &&
    labels.length === 0 &&
    angleMarkers.length === 0 &&
    circles.length === 0 &&
    arcs.length === 0 &&
    segments.length === 0
  ) {
    return null
  }

  return {
    displayMode,
    scaleMode,
    color,
    xMin,
    xMax,
    yMin,
    yMax,
    ...(series.length > 0 ? { series } : {}),
    ...(polygons.length > 0 ? { polygons } : {}),
    ...(labels.length > 0 ? { labels } : {}),
    ...(angleMarkers.length > 0 ? { angleMarkers } : {}),
    ...(circles.length > 0 ? { circles } : {}),
    ...(arcs.length > 0 ? { arcs } : {}),
    ...(segments.length > 0 ? { segments } : {}),
  }
}

export default function AdminQuestions() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  const createParam = searchParams.get('create');
  const editParam = searchParams.get('edit');
  const isEditorView = createParam !== null || !!editParam;

  // Question list state
  const [questions, setQuestions] = useState<StepBasedQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [filters, setFilters] = useState<QuestionFilter>({
    subject: 'all',
    level: 'all',
    difficulty: 'all',
    rankTier: '',
    done: 'all'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [mappingErrors, setMappingErrors] = useState<string[]>([]);
  const [mappingIssueDetails, setMappingIssueDetails] = useState<MappingIssue[]>([]);
  const [lastFetchStats, setLastFetchStats] = useState<FetchStats | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [chemTestQuery, setChemTestQuery] = useState('Chem Test');
  const [chemTestLookup, setChemTestLookup] = useState<{
    loading: boolean;
    rows: ChemTestRow[];
    error: string | null;
    checkedAtIso: string | null;
  }>({ loading: false, rows: [], error: null, checkedAtIso: null });

  // Bulk selection + actions (list)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [doneToggleLoading, setDoneToggleLoading] = useState<Record<string, boolean>>({});
  const [bulkEdit, setBulkEdit] = useState<BulkEditState>(getEmptyBulkEdit());

  // Editor state
  const [mode, setMode] = useState<EditorMode>('idle');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [form, setForm] = useState<QuestionForm>(getEmptyForm());
  const [saving, setSaving] = useState(false);
  const [uploadingMainImage, setUploadingMainImage] = useState(false);
  const [uploadingStepImages, setUploadingStepImages] = useState<Record<number, boolean>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [structurePresetNonce, setStructurePresetNonce] = useState(0);
  const [stepDiagramPresetNonce, setStepDiagramPresetNonce] = useState<Record<number, number>>({});

  const hasAnySubStepsInForm = useMemo(() => {
    return form.steps.some((s) => Array.isArray(s.subSteps) && s.subSteps.length > 0);
  }, [form.steps]);

  const subStepsRequireTwoSteps = hasAnySubStepsInForm && form.steps.length < 2;

  const updateGraphSeries = useCallback(
    (index: number, updater: (series: FormGraphSeries) => FormGraphSeries) => {
      setForm((prev) => ({
        ...prev,
        graphSeries: prev.graphSeries.map((series, seriesIndex) =>
          seriesIndex === index ? updater(series) : series
        ),
      }))
    },
    []
  )

  const addGraphSeries = useCallback((type: 'function' | 'points' = 'function') => {
    setForm((prev) => ({
      ...prev,
      graphSeries: [...(Array.isArray(prev.graphSeries) ? prev.graphSeries : []), getEmptyGraphSeries(type)],
    }))
  }, [])

  const removeGraphSeries = useCallback((index: number) => {
    setForm((prev) => {
      const next = (Array.isArray(prev.graphSeries) ? prev.graphSeries : []).filter(
        (_, seriesIndex) => seriesIndex !== index
      )

      return {
        ...prev,
        graphSeries: next.length > 0 ? next : [getEmptyGraphSeries('function')],
      }
    })
  }, [])

  const moveGraphSeries = useCallback((index: number, direction: -1 | 1) => {
    setForm((prev) => {
      const next = [...(Array.isArray(prev.graphSeries) ? prev.graphSeries : [])]
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= next.length) return prev

      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return {
        ...prev,
        graphSeries: next,
      }
    })
  }, [])

  const updateGraphPolygon = useCallback(
    (index: number, updater: (polygon: FormGraphPolygon) => FormGraphPolygon) => {
      setForm((prev) => ({
        ...prev,
        graphPolygons: (Array.isArray(prev.graphPolygons) ? prev.graphPolygons : []).map((polygon, polygonIndex) =>
          polygonIndex === index ? updater(polygon) : polygon
        ),
      }))
    },
    []
  )

  const addGraphPolygon = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      graphPolygons: [...(Array.isArray(prev.graphPolygons) ? prev.graphPolygons : []), getEmptyGraphPolygon()],
    }))
  }, [])

  const removeGraphPolygon = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      graphPolygons: (Array.isArray(prev.graphPolygons) ? prev.graphPolygons : []).filter(
        (_, polygonIndex) => polygonIndex !== index
      ),
    }))
  }, [])

  const updateGraphLabel = useCallback(
    (index: number, updater: (label: FormGraphLabel) => FormGraphLabel) => {
      setForm((prev) => ({
        ...prev,
        graphLabels: (Array.isArray(prev.graphLabels) ? prev.graphLabels : []).map((label, labelIndex) =>
          labelIndex === index ? updater(label) : label
        ),
      }))
    },
    []
  )

  const addGraphLabel = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      graphLabels: [...(Array.isArray(prev.graphLabels) ? prev.graphLabels : []), getEmptyGraphLabel()],
    }))
  }, [])

  const removeGraphLabel = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      graphLabels: (Array.isArray(prev.graphLabels) ? prev.graphLabels : []).filter(
        (_, labelIndex) => labelIndex !== index
      ),
    }))
  }, [])

  const updateGraphAngleMarker = useCallback(
    (index: number, updater: (marker: FormGraphAngleMarker) => FormGraphAngleMarker) => {
      setForm((prev) => ({
        ...prev,
        graphAngleMarkers: (Array.isArray(prev.graphAngleMarkers) ? prev.graphAngleMarkers : []).map(
          (marker, markerIndex) => (markerIndex === index ? updater(marker) : marker)
        ),
      }))
    },
    []
  )

  const addGraphAngleMarker = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      graphAngleMarkers: [
        ...(Array.isArray(prev.graphAngleMarkers) ? prev.graphAngleMarkers : []),
        getEmptyGraphAngleMarker(),
      ],
    }))
  }, [])

  const removeGraphAngleMarker = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      graphAngleMarkers: (Array.isArray(prev.graphAngleMarkers) ? prev.graphAngleMarkers : []).filter(
        (_, markerIndex) => markerIndex !== index
      ),
    }))
  }, [])

  const updateGraphCircle = useCallback(
    (index: number, updater: (circle: FormGraphCircle) => FormGraphCircle) => {
      setForm((prev) => ({
        ...prev,
        graphCircles: (Array.isArray(prev.graphCircles) ? prev.graphCircles : []).map((circle, circleIndex) =>
          circleIndex === index ? updater(circle) : circle
        ),
      }))
    },
    []
  )

  const addGraphCircle = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      graphCircles: [...(Array.isArray(prev.graphCircles) ? prev.graphCircles : []), getEmptyGraphCircle()],
    }))
  }, [])

  const removeGraphCircle = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      graphCircles: (Array.isArray(prev.graphCircles) ? prev.graphCircles : []).filter(
        (_, circleIndex) => circleIndex !== index
      ),
    }))
  }, [])

  const updateGraphArc = useCallback(
    (index: number, updater: (arc: FormGraphArc) => FormGraphArc) => {
      setForm((prev) => ({
        ...prev,
        graphArcs: (Array.isArray(prev.graphArcs) ? prev.graphArcs : []).map((arc, arcIndex) =>
          arcIndex === index ? updater(arc) : arc
        ),
      }))
    },
    []
  )

  const addGraphArc = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      graphArcs: [...(Array.isArray(prev.graphArcs) ? prev.graphArcs : []), getEmptyGraphArc()],
    }))
  }, [])

  const removeGraphArc = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      graphArcs: (Array.isArray(prev.graphArcs) ? prev.graphArcs : []).filter(
        (_, arcIndex) => arcIndex !== index
      ),
    }))
  }, [])

  const updateGraphSegment = useCallback(
    (index: number, updater: (segment: FormGraphSegment) => FormGraphSegment) => {
      setForm((prev) => ({
        ...prev,
        graphSegments: (Array.isArray(prev.graphSegments) ? prev.graphSegments : []).map((segment, segmentIndex) =>
          segmentIndex === index ? updater(segment) : segment
        ),
      }))
    },
    []
  )

  const addGraphSegment = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      graphSegments: [...(Array.isArray(prev.graphSegments) ? prev.graphSegments : []), getEmptyGraphSegment()],
    }))
  }, [])

  const removeGraphSegment = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      graphSegments: (Array.isArray(prev.graphSegments) ? prev.graphSegments : []).filter(
        (_, segmentIndex) => segmentIndex !== index
      ),
    }))
  }, [])

  const chemistryWarnings = useMemo(() => {
    const warnings: string[] = []

    const check = (label: string, value: any) => {
      const s = String(value ?? '')
      if (!s.trim()) return

      if (s.includes('\\ce{')) {
        const hasMathDelim = hasMathDelimiters(s)
        if (!hasMathDelim) {
          warnings.push(
            `${label}: found \\ce{...} but no math delimiters. Wrap like \\(\\ce{...}\\).`
          )
        }
      }

      const dollars = countUnescapedDollars(s)
      if (dollars % 2 === 1) {
        warnings.push(`${label}: unbalanced $ delimiters (odd count).`)
      }
    }

    const checkOptionMath = (label: string, value: any) => {
      const s = String(value ?? '').trim()
      if (!s || s.includes('\\ce{')) return
      if (optionNeedsInlineMathWrapper(s)) {
        warnings.push(
          `${label}: looks like inline math but has no delimiters. It will be auto-wrapped on save.`
        )
      }
    }

    check('Stem', form.stem)

    form.steps.forEach((step, stepIdx) => {
      check(`Step ${stepIdx + 1} prompt`, step.prompt)
      step.options.forEach((opt, optIdx) => {
        checkOptionMath(
          `Step ${stepIdx + 1} option ${String.fromCharCode(65 + optIdx)}`,
          opt
        )
        check(
          `Step ${stepIdx + 1} option ${String.fromCharCode(65 + optIdx)}`,
          opt
        )
      })
      check(`Step ${stepIdx + 1} explanation`, step.explanation)

      ;(step.subSteps ?? []).forEach((sub, subIdx) => {
        check(`Step ${stepIdx + 1} sub-step ${subIdx + 1} prompt`, sub.prompt)
        ;(sub.options ?? []).forEach((opt, optIdx) => {
          checkOptionMath(
            `Step ${stepIdx + 1} sub-step ${subIdx + 1} option ${String.fromCharCode(65 + optIdx)}`,
            opt
          )
          check(
            `Step ${stepIdx + 1} sub-step ${subIdx + 1} option ${String.fromCharCode(65 + optIdx)}`,
            opt
          )
        })
        check(`Step ${stepIdx + 1} sub-step ${subIdx + 1} explanation`, sub.explanation)
      })
    })

    smilesAuthoringWarnings('Main structure SMILES', form.structureSmiles).forEach((msg) =>
      warnings.push(msg)
    )
    form.steps.forEach((step, stepIdx) => {
      smilesAuthoringWarnings(
        `Step ${stepIdx + 1} diagram SMILES`,
        step.diagramSmiles
      ).forEach((msg) => warnings.push(msg))
    })

    return warnings
  }, [form.subject, form.stem, form.steps, form.structureSmiles])

  const filteredQuestions = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return questions.filter((q) => {
      const matchesSearch = term
        ? `${q.title} ${q.chapter} ${q.subject} ${q.level} ${q.difficulty}`
            .toLowerCase()
            .includes(term)
        : true;
      return matchesSearch;
    });
  }, [questions, searchTerm]);

  const selectedCount = selectedIds.size;
  const allShownSelected = useMemo(() => {
    if (filteredQuestions.length === 0) return false;
    return filteredQuestions.every((q) => selectedIds.has(q.id));
  }, [filteredQuestions, selectedIds]);

  const bulkEditHasChanges = useMemo(() => {
    const hasChapter = bulkEdit.chapter.trim().length > 0;
    const hasTimer = bulkEdit.mainQuestionTimerSeconds.trim().length > 0;
    return (
      bulkEdit.subject !== 'keep' ||
      bulkEdit.level !== 'keep' ||
      bulkEdit.difficulty !== 'keep' ||
      hasChapter ||
      hasTimer
    );
  }, [bulkEdit]);

  const bulkEditDisabled = bulkActionLoading || selectedCount === 0;

  // Load questions on mount and filter changes
  useEffect(() => {
    if (isAdmin) {
      fetchQuestions();
    }
  }, [isAdmin, filters]);

  // Safety: clear selection when filter/search context changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters, searchTerm]);

  function getEmptyBulkEdit(): BulkEditState {
    return {
      subject: 'keep',
      chapter: '',
      level: 'keep',
      difficulty: 'keep',
      mainQuestionTimerSeconds: ''
    };
  }

  function getEmptyForm(): QuestionForm {
    return {
      title: '',
      subject: 'math',
      chapter: '',
      level: 'A1',
      difficulty: 'medium',
      rankTier: '',
      isEnabled: true,
      stem: '',
      structureSmiles: '',
      graphEnabled: false,
      graphColor: 'white',
      graphDisplayMode: 'standard',
      graphScaleMode: 'equalUnits',
      graphSeries: [getEmptyGraphSeries('function')],
      graphPolygons: [],
      graphLabels: [],
      graphAngleMarkers: [],
      graphCircles: [],
      graphArcs: [],
      graphSegments: [],
      graphXMin: '',
      graphXMax: '',
      graphYMin: '',
      graphYMax: '',
      mainQuestionTimerSeconds: 180,
      totalMarks: 1,
      topicTags: '',
      steps: [{
        type: 'mcq',
        title: 'Step 1',
        prompt: '',
        diagramSmiles: '',
        diagramImageUrl: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        marks: 1,
        timeLimitSeconds: 15,
        explanation: '',
        subSteps: []
      }],
      imageUrl: ''
    };
  }

  async function fetchQuestions() {
    setLoadingQuestions(true);
    try {
      console.log('[AdminQuestions] Fetching questions with filters:', filters);
      const allRows: any[] = [];
      let pageCount = 0;

      while (pageCount < QUESTIONS_MAX_PAGES) {
        const from = pageCount * QUESTIONS_PAGE_SIZE;
        const to = from + QUESTIONS_PAGE_SIZE - 1;

        let query = supabase
          .from('questions_v2')
          .select('*')
          .order('updated_at', { ascending: false })
          .range(from, to);

        if (filters.subject !== 'all') query = query.eq('subject', filters.subject);
        if (filters.level !== 'all') query = query.eq('level', filters.level);
        if (filters.difficulty !== 'all') query = query.eq('difficulty', filters.difficulty);
        if (filters.rankTier.trim()) query = query.eq('rank_tier', filters.rankTier.trim());
        if (filters.done !== 'all') query = query.eq('is_done', filters.done === 'done');

        const { data, error } = await query;
        console.log('[AdminQuestions] Raw result page:', pageCount + 1, 'count:', data?.length || 0, 'error:', error);

        if (error) throw error;

        const pageRows = data || [];
        allRows.push(...pageRows);
        pageCount += 1;

        if (pageRows.length < QUESTIONS_PAGE_SIZE) break;
      }

      console.log('[AdminQuestions] Raw result count:', allRows.length);

      const mapped: StepBasedQuestion[] = [];
      const rowErrors: string[] = [];
      const issues: MappingIssue[] = [];

      allRows.forEach((row, idx) => {
        try {
          mapped.push(dbRowToQuestion(row));
        } catch (err: any) {
          console.error('[AdminQuestions] Mapping error for row', idx, err, row);
          const message = err?.message || 'Mapping error';
          rowErrors.push(message);
          issues.push({
            idx,
            message,
            rowId: typeof (row as any)?.id === 'string' ? (row as any).id : undefined,
            title: typeof (row as any)?.title === 'string' ? (row as any).title : undefined,
          });
        }
      });

      if (rowErrors.length > 0) {
        setMappingErrors(rowErrors);
        setMappingIssueDetails(issues);
        toast.warning(`Some questions could not be parsed (${rowErrors.length}). Check console logs for details.`);
      } else {
        setMappingErrors([]);
        setMappingIssueDetails([]);
      }

      setQuestions(mapped);
      setLastFetchStats({
        rawCount: allRows.length,
        mappedCount: mapped.length,
        fetchedAtIso: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[AdminQuestions] Error fetching:', error);
      toast.error(error.message || 'Failed to load questions');
      setLastFetchStats({
        rawCount: 0,
        mappedCount: 0,
        fetchedAtIso: new Date().toISOString(),
        errorMessage: error?.message || String(error),
      });
    } finally {
      setLoadingQuestions(false);
    }
  }

  async function runTitleDiagnosticsLookup() {
    const term = String(chemTestQuery ?? '').trim()
    if (!term) return

    setChemTestLookup((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const { data, error } = await supabase
        .from('questions_v2')
        .select('id,title,created_at,updated_at')
        .ilike('title', `%${term}%`)
        .order('created_at', { ascending: false })
        .limit(25)

      if (error) throw error

      setChemTestLookup({
        loading: false,
        rows: (data ?? []) as any,
        error: null,
        checkedAtIso: new Date().toISOString(),
      })
    } catch (err: any) {
      setChemTestLookup((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || String(err),
        checkedAtIso: new Date().toISOString(),
      }))
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard')
    } catch (err: any) {
      console.error('[AdminQuestions] Clipboard copy failed:', err)
      toast.error('Failed to copy')
    }
  }

  function toggleSelected(questionId: string, nextChecked?: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const shouldSelect = typeof nextChecked === 'boolean' ? nextChecked : !next.has(questionId);
      if (shouldSelect) next.add(questionId);
      else next.delete(questionId);
      return next;
    });
  }

  function handleSelectAllShown() {
    if (filteredQuestions.length === 0) return;
    setSelectedIds(new Set(filteredQuestions.map((q) => q.id)));
  }

  function handleClearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBulkSetEnabled(nextEnabled: boolean) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setBulkActionLoading(true);
    try {
      const { error } = await supabase
        .from('questions_v2')
        .update({ is_enabled: nextEnabled } as any)
        .in('id', ids);

      if (error) throw error;

      // Keep editor state consistent if the currently open question is included
      if (selectedQuestionId && ids.includes(selectedQuestionId)) {
        setForm((prev) => ({ ...prev, isEnabled: nextEnabled }));
      }

      toast.success(
        `${nextEnabled ? 'Enabled' : 'Disabled'} ${ids.length} question${ids.length === 1 ? '' : 's'}`
      );

      setSelectedIds(new Set());
      await fetchQuestions();
    } catch (error: any) {
      console.error('[AdminQuestions] Bulk enable/disable error:', error);
      toast.error(error?.message || 'Failed to update selected questions');
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function handleToggleDone(questionId: string, nextDone: boolean) {
    if (doneToggleLoading[questionId]) return;
    setDoneToggleLoading((prev) => ({ ...prev, [questionId]: true }));
    try {
      const { error } = await supabase
        .from('questions_v2')
        .update({ is_done: nextDone } as any)
        .eq('id', questionId);

      if (error) throw error;

      toast.success(`Marked question as ${nextDone ? 'done' : 'pending'}.`);
      await fetchQuestions();
    } catch (error: any) {
      console.error('[AdminQuestions] Toggle done error:', error);
      toast.error(error?.message || 'Failed to update question status');
    } finally {
      setDoneToggleLoading((prev) => ({ ...prev, [questionId]: false }));
    }
  }

  async function handleBulkApply() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!bulkEditHasChanges) return;

    const payload: Record<string, any> = {};
    if (bulkEdit.subject !== 'keep') payload.subject = bulkEdit.subject;
    if (bulkEdit.level !== 'keep') payload.level = bulkEdit.level;
    if (bulkEdit.difficulty !== 'keep') payload.difficulty = bulkEdit.difficulty;

    const nextChapter = bulkEdit.chapter.trim();
    if (nextChapter) payload.chapter = nextChapter;

    const timerRaw = bulkEdit.mainQuestionTimerSeconds.trim();
    if (timerRaw) {
      const parsed = Number(timerRaw);
      if (!Number.isFinite(parsed)) {
        toast.error('Main timer must be a number of seconds.');
        return;
      }
      const clamped = Math.max(5, Math.min(600, Math.floor(parsed)));
      payload.main_question_timer_seconds = clamped;
    }

    if (Object.keys(payload).length === 0) return;

    setBulkActionLoading(true);
    try {
      const { error } = await supabase
        .from('questions_v2')
        .update(payload as any)
        .in('id', ids);

      if (error) throw error;

      if (selectedQuestionId && ids.includes(selectedQuestionId)) {
        setForm((prev) => ({
          ...prev,
          subject: payload.subject ?? prev.subject,
          chapter: payload.chapter ?? prev.chapter,
          level: payload.level ?? prev.level,
          difficulty: payload.difficulty ?? prev.difficulty,
          mainQuestionTimerSeconds:
            payload.main_question_timer_seconds ?? prev.mainQuestionTimerSeconds
        }));
      }

      toast.success(`Updated ${ids.length} question${ids.length === 1 ? '' : 's'}`);
      setSelectedIds(new Set());
      setBulkEdit(getEmptyBulkEdit());
      await fetchQuestions();
    } catch (error: any) {
      console.error('[AdminQuestions] Bulk update error:', error);
      toast.error(error?.message || 'Failed to update selected questions');
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function deleteQuestionCascadeOrManual(questionId: string): Promise<void> {
    // Try using the RPC function first (more reliable, handles everything in a transaction)
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('delete_question_cascade' as any, { p_question_id: questionId });

    if (
      !rpcError &&
      rpcResult &&
      typeof rpcResult === 'object' &&
      rpcResult !== null &&
      'success' in rpcResult &&
      (rpcResult as any).success
    ) {
      return;
    }

    // If RPC function doesn't exist or failed, fall back to manual deletion
    console.log('[AdminQuestions] RPC function not available or failed, using manual deletion');

    // Delete related records first to avoid foreign key constraint violations
    const { error: answersError } = await supabase
      .from('match_answers')
      .delete()
      .eq('question_id', questionId);

    if (answersError && !String((answersError as any).message || '').includes('does not exist')) {
      console.warn('[AdminQuestions] Error deleting match_answers:', answersError);
    }

    const { error: roundsError } = await supabase
      .from('match_rounds')
      .delete()
      .eq('question_id', questionId);

    if (roundsError && !String((roundsError as any).message || '').includes('does not exist')) {
      console.warn('[AdminQuestions] Error deleting match_rounds:', roundsError);
    }

    const { error: matchQuestionsError } = await supabase
      .from('match_questions')
      .delete()
      .eq('question_id', questionId);

    if (matchQuestionsError && !String((matchQuestionsError as any).message || '').includes('does not exist')) {
      console.warn('[AdminQuestions] Error deleting match_questions (table may not exist):', matchQuestionsError);
    }

    // Handle matches table if it has question_id column
    // Try to update to NULL first, then delete if that fails
    const { error: matchesUpdateError } = await (supabase as any)
      .from('matches')
      .update({ question_id: null })
      .eq('question_id', questionId);

    if (
      matchesUpdateError &&
      !String((matchesUpdateError as any).message || '').includes('does not exist') &&
      !String((matchesUpdateError as any).message || '').includes('null value')
    ) {
      // If update to NULL fails (column not nullable), try deleting matches
      const { error: matchesDeleteError } = await (supabase as any)
        .from('matches')
        .delete()
        .eq('question_id', questionId);

      if (matchesDeleteError && !String((matchesDeleteError as any).message || '').includes('does not exist')) {
        console.warn('[AdminQuestions] Error handling matches:', matchesDeleteError);
      }
    }

    // Now delete the question itself
    const { error } = await supabase
      .from('questions_v2')
      .delete()
      .eq('id', questionId);

    if (error) {
      // If we still get a foreign key error, it means CASCADE isn't working
      // Try one more time with the RPC if it was just a timing issue
      const msg = String((error as any).message || '');
      if (msg.includes('foreign key constraint') || msg.includes('violates')) {
        const { data: retryResult, error: retryError } = await supabase
          .rpc('delete_question_cascade' as any, { p_question_id: questionId });

        if (
          !retryError &&
          retryResult &&
          typeof retryResult === 'object' &&
          retryResult !== null &&
          'success' in retryResult &&
          (retryResult as any).success
        ) {
          return;
        }
      }
      throw error;
    }
  }

  async function handleBulkDeleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const ok = confirm(
      ids.length === 1
        ? 'Are you sure you want to delete this selected question? This cannot be undone.'
        : `Are you sure you want to delete ${ids.length} selected questions? This cannot be undone.`
    );
    if (!ok) return;

    setBulkActionLoading(true);
    try {
      const failures: Array<{ id: string; error: any }> = [];

      for (const id of ids) {
        try {
          await deleteQuestionCascadeOrManual(id);
        } catch (err: any) {
          failures.push({ id, error: err });
        }
      }

      // If the currently open question was deleted successfully, clear the editor.
      if (selectedQuestionId && ids.includes(selectedQuestionId)) {
        const failedIds = new Set(failures.map((f) => f.id));
        if (!failedIds.has(selectedQuestionId)) {
          setMode('idle');
          setSelectedQuestionId(null);
          setForm(getEmptyForm());
        }
      }

      if (failures.length === 0) {
        toast.success(`Deleted ${ids.length} question${ids.length === 1 ? '' : 's'} successfully!`);
      } else {
        console.error('[AdminQuestions] Bulk delete failures:', failures);
        toast.warning(
          `Deleted ${ids.length - failures.length}/${ids.length}. ${failures.length} failed (see console).`
        );
      }

      setSelectedIds(new Set());
      await fetchQuestions();
    } catch (error: any) {
      console.error('[AdminQuestions] Bulk delete error:', error);
      toast.error(error?.message || 'Failed to delete selected questions');
    } finally {
      setBulkActionLoading(false);
    }
  }

  function handleNewQuestion() {
    navigate('/admin/questions?create=1');
  }

  function handleSelectQuestion(q: StepBasedQuestion) {
    setMode('editing');
    setSelectedQuestionId(q.id);
    const g = (q as any).graph as GraphConfig | undefined;
    setForm({
      title: q.title,
      subject: q.subject,
      chapter: q.chapter,
      level: q.level,
      difficulty: q.difficulty,
      rankTier: q.rankTier || '',
      isEnabled: q.isEnabled !== false,
      stem: q.stem,
      structureSmiles: q.structureSmiles || '',
      graphEnabled: !!g,
      graphColor: normalizeGraphColor((g as any)?.color),
      graphDisplayMode:
        (g as any)?.displayMode === 'aLevelSketch'
          ? 'aLevelSketch'
          : (g as any)?.displayMode === 'blank'
            ? 'blank'
            : 'standard',
      graphScaleMode: normalizeGraphScaleMode((g as any)?.scaleMode ?? (g as any)?.scale_mode),
      graphSeries: getGraphSeriesFromConfig(g),
      graphPolygons: getGraphPolygonsFromConfig(g),
      graphLabels: getGraphLabelsFromConfig(g),
      graphAngleMarkers: getGraphAngleMarkersFromConfig(g),
      graphCircles: getGraphCirclesFromConfig(g),
      graphArcs: getGraphArcsFromConfig(g),
      graphSegments: getGraphSegmentsFromConfig(g),
      graphXMin: g && typeof (g as any).xMin === 'number' ? String((g as any).xMin) : '',
      graphXMax: g && typeof (g as any).xMax === 'number' ? String((g as any).xMax) : '',
      graphYMin: g && typeof (g as any).yMin === 'number' ? String((g as any).yMin) : '',
      graphYMax: g && typeof (g as any).yMax === 'number' ? String((g as any).yMax) : '',
      mainQuestionTimerSeconds: q.mainQuestionTimerSeconds,
      totalMarks: q.totalMarks,
      topicTags: q.topicTags.join(', '),
      steps: q.steps.map(s => ({
        id: s.id,
        type: s.type || 'mcq',
        title: s.title,
        prompt: s.prompt,
        diagramSmiles: s.diagramSmiles || '',
        diagramImageUrl: s.diagramImageUrl || '',
        options: (() => {
          const t: 'mcq' | 'true_false' = (s.type === 'true_false' ? 'true_false' : 'mcq')
          const raw = Array.isArray(s.options) ? s.options : []
          if (t === 'true_false') {
            return [raw[0] || 'True', raw[1] || 'False']
          }
          // MCQ: keep up to 6; default to 4 slots for easier editing if missing
          return raw.length > 0 ? raw.slice(0, 6) : ['', '', '', '']
        })(),
        correctAnswer: (() => {
          const t: 'mcq' | 'true_false' = (s.type === 'true_false' ? 'true_false' : 'mcq')
          const rawOptions = Array.isArray(s.options) ? s.options : []
          const optionCount = t === 'true_false'
            ? 2
            : Math.max(2, Math.min(6, rawOptions.length || 4))
          const maxIndex = optionCount - 1
          const v = typeof s.correctAnswer === 'number' ? s.correctAnswer : 0
          return Math.max(0, Math.min(maxIndex, Math.floor(v)))
        })(),
        marks: s.marks,
        timeLimitSeconds: s.timeLimitSeconds,
        explanation: s.explanation || '',
        subSteps: (s.subSteps ?? []).map(sub => ({
          type: sub.type || 'true_false',
          prompt: sub.prompt || '',
          options: (() => {
            const t: 'mcq' | 'true_false' = (sub.type === 'true_false' ? 'true_false' : 'mcq')
            const raw = Array.isArray(sub.options) ? sub.options : []
            if (t === 'true_false') {
              return [raw[0] || 'True', raw[1] || 'False']
            }
            return raw.length > 0 ? raw.slice(0, 6) : ['', '', '', '']
          })(),
          correctAnswer: (() => {
            const t: 'mcq' | 'true_false' = (sub.type === 'true_false' ? 'true_false' : 'mcq')
            const rawOptions = Array.isArray(sub.options) ? sub.options : []
            const optionCount = t === 'true_false'
              ? 2
              : Math.max(2, Math.min(6, rawOptions.length || 4))
            const maxIndex = optionCount - 1
            const v = typeof sub.correctAnswer === 'number' ? sub.correctAnswer : 0
            return Math.max(0, Math.min(maxIndex, Math.floor(v)))
          })(),
          timeLimitSeconds: sub.timeLimitSeconds ?? 15,
          explanation: sub.explanation || ''
        }))
      })),
      imageUrl: q.imageUrl || ''
    });
  }

  function formToQuestion(form: QuestionForm): StepBasedQuestion {
    return {
      id: selectedQuestionId || 'preview',
      title: form.title,
      subject: form.subject,
      chapter: form.chapter,
      level: form.level,
      difficulty: form.difficulty,
      rankTier: form.rankTier || undefined,
      stem: form.stem,
      mainQuestionTimerSeconds: form.mainQuestionTimerSeconds,
      structureSmiles: form.structureSmiles || undefined,
      graph: buildGraphConfigFromForm(form) || undefined,
      totalMarks: form.totalMarks,
      topicTags: form.topicTags.split(',').map(t => t.trim()).filter(Boolean),
      steps: form.steps.map((s, idx) => ({
        id: s.id || `step-${idx}`,
        index: idx,
        type: s.type,
        title: s.title,
        prompt: s.prompt,
        diagramSmiles: s.diagramSmiles || undefined,
        diagramImageUrl: s.diagramImageUrl || undefined,
        options: s.options,
        correctAnswer: s.correctAnswer,
        marks: s.marks,
        timeLimitSeconds: s.timeLimitSeconds,
        explanation: s.explanation || null,
      })),
      imageUrl: form.imageUrl || undefined,
    };
  }

  // Handle URL parameters for create/edit mode
  useEffect(() => {
    if (!isAdmin) return;

    if (createParam !== null) {
      if (mode !== 'creating') {
        setMode('creating');
        setSelectedQuestionId(null);
        setForm(getEmptyForm());
      }
      return;
    }

    if (editParam && questions.length > 0) {
      if (selectedQuestionId === editParam && mode === 'editing') return;
      const question = questions.find(q => q.id === editParam);
      if (question) {
        handleSelectQuestion(question);
      }
      return;
    }

    if (mode !== 'idle') {
      setMode('idle');
      setSelectedQuestionId(null);
      setForm(getEmptyForm());
    }
  }, [isAdmin, createParam, editParam, questions, mode, selectedQuestionId]);

  function handleAddStep() {
    setForm({
      ...form,
      steps: [
        ...form.steps,
        {
          type: 'mcq',
          title: `Step ${form.steps.length + 1}`,
          prompt: '',
          diagramSmiles: '',
          diagramImageUrl: '',
          options: ['', '', '', ''],
          correctAnswer: 0,
          marks: 1,
          timeLimitSeconds: 15,
          explanation: '',
          subSteps: []
        }
      ]
    });
  }

  function handleDeleteStep(index: number) {
    if (form.steps.length <= 1) {
      toast.error('Must have at least 1 step');
      return;
    }
    const newSteps = form.steps.filter((_, i) => i !== index);
    setForm({ ...form, steps: newSteps });
  }

  function handleMoveStepUp(index: number) {
    if (index === 0) return;
    const newSteps = [...form.steps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    setForm({ ...form, steps: newSteps });
  }

  function handleMoveStepDown(index: number) {
    if (index === form.steps.length - 1) return;
    const newSteps = [...form.steps];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    setForm({ ...form, steps: newSteps });
  }

  const moveCorrectOption = (
    options: string[],
    correctIndex: number,
    targetIndex: number
  ) => {
    if (!Array.isArray(options) || options.length === 0) {
      return { options, correctIndex };
    }
    const clampedTarget = Math.max(0, Math.min(targetIndex, options.length - 1));
    const clampedCorrect = Math.max(0, Math.min(correctIndex, options.length - 1));
    if (clampedTarget === clampedCorrect) {
      return { options, correctIndex: clampedCorrect };
    }
    const nextOptions = [...options];
    const [correctOption] = nextOptions.splice(clampedCorrect, 1);
    nextOptions.splice(clampedTarget, 0, correctOption);
    return { options: nextOptions, correctIndex: clampedTarget };
  };

  function updateStepField(index: number, field: keyof FormStep, value: any) {
    const newSteps = [...form.steps];
    const updatedStep = { ...newSteps[index], [field]: value };
    
    // When changing type to true_false, set default options and limit correctAnswer
    if (field === 'type' && value === 'true_false') {
      updatedStep.options = ['True', 'False'];
      if (updatedStep.correctAnswer > 1) {
        updatedStep.correctAnswer = 0;
      }
    } else if (field === 'type' && value === 'mcq') {
      // When changing to MCQ, ensure option count is 2–6
      const next = Array.isArray(updatedStep.options) ? [...updatedStep.options] : []
      while (next.length < 2) next.push('')
      if (next.length > 6) next.splice(6)
      updatedStep.options = next
      if (updatedStep.correctAnswer < 0 || updatedStep.correctAnswer >= next.length) {
        updatedStep.correctAnswer = 0
      }
    }
    
    newSteps[index] = updatedStep;
    
    // Auto-calculate total marks when step marks change
    const totalMarks = newSteps.reduce((sum, s) => sum + (s.marks || 0), 0);
    
    setForm({ ...form, steps: newSteps, totalMarks });
  }

  async function handleMainImageUpload(file: File | null) {
    if (!file) return;
    setUploadingMainImage(true);
    try {
      const { publicUrl } = await uploadQuestionImage(file, { prefix: 'questions' });
      setForm((prev) => ({ ...prev, imageUrl: publicUrl }));
      toast.success('Question image uploaded.');
    } catch (error: any) {
      console.error('[AdminQuestions] Main image upload error:', error);
      toast.error(error?.message || 'Failed to upload image');
    } finally {
      setUploadingMainImage(false);
    }
  }

  async function handleStepImageUpload(index: number, file: File | null) {
    if (!file) return;
    setUploadingStepImages((prev) => ({ ...prev, [index]: true }));
    try {
      const { publicUrl } = await uploadQuestionImage(file, { prefix: 'steps' });
      setForm((prev) => {
        if (!prev.steps[index]) return prev;
        const steps = [...prev.steps];
        steps[index] = { ...steps[index], diagramImageUrl: publicUrl };
        return { ...prev, steps };
      });
      toast.success(`Step ${index + 1} image uploaded.`);
    } catch (error: any) {
      console.error('[AdminQuestions] Step image upload error:', error);
      toast.error(error?.message || 'Failed to upload step image');
    } finally {
      setUploadingStepImages((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  }

  function updateStepOption(stepIndex: number, optionIndex: number, value: string) {
    const newSteps = [...form.steps];
    const options = [...newSteps[stepIndex].options];
    options[optionIndex] = value;
    newSteps[stepIndex] = { ...newSteps[stepIndex], options };
    setForm({ ...form, steps: newSteps });
  }

  function handleMoveCorrectStepOption(stepIndex: number, targetIndex: number) {
    const newSteps = [...form.steps];
    const step = newSteps[stepIndex];
    if (!step) return;
    const { options, correctIndex } = moveCorrectOption(
      step.options,
      step.correctAnswer,
      targetIndex
    );
    newSteps[stepIndex] = { ...step, options, correctAnswer: correctIndex };
    setForm({ ...form, steps: newSteps });
  }

  function handleAddStepOption(stepIndex: number) {
    const newSteps = [...form.steps]
    const step = newSteps[stepIndex]
    if (!step || step.type !== 'mcq') return
    if (step.options.length >= 6) return

    const nextOptions = [...step.options, '']
    newSteps[stepIndex] = {
      ...step,
      options: nextOptions,
      correctAnswer: Math.max(0, Math.min(step.correctAnswer, nextOptions.length - 1))
    }
    setForm({ ...form, steps: newSteps })
  }

  function handleRemoveStepOption(stepIndex: number) {
    const newSteps = [...form.steps]
    const step = newSteps[stepIndex]
    if (!step || step.type !== 'mcq') return
    if (step.options.length <= 2) return

    const nextOptions = step.options.slice(0, -1)
    const nextCorrect = Math.max(0, Math.min(step.correctAnswer, nextOptions.length - 1))
    newSteps[stepIndex] = { ...step, options: nextOptions, correctAnswer: nextCorrect }
    setForm({ ...form, steps: newSteps })
  }

  function handleAddSubStepOption(stepIndex: number, subStepIndex: number) {
    const newSteps = [...form.steps]
    const step = newSteps[stepIndex]
    const subs = Array.isArray(step?.subSteps) ? [...step.subSteps] : []
    const sub = subs[subStepIndex]
    if (!step || !sub || sub.type !== 'mcq') return
    if (sub.options.length >= 6) return

    const nextOptions = [...sub.options, '']
    const nextCorrect = Math.max(0, Math.min(sub.correctAnswer, nextOptions.length - 1))
    subs[subStepIndex] = { ...sub, options: nextOptions, correctAnswer: nextCorrect }
    newSteps[stepIndex] = { ...step, subSteps: subs }
    setForm({ ...form, steps: newSteps })
  }

  function handleRemoveSubStepOption(stepIndex: number, subStepIndex: number) {
    const newSteps = [...form.steps]
    const step = newSteps[stepIndex]
    const subs = Array.isArray(step?.subSteps) ? [...step.subSteps] : []
    const sub = subs[subStepIndex]
    if (!step || !sub || sub.type !== 'mcq') return
    if (sub.options.length <= 2) return

    const nextOptions = sub.options.slice(0, -1)
    const nextCorrect = Math.max(0, Math.min(sub.correctAnswer, nextOptions.length - 1))
    subs[subStepIndex] = { ...sub, options: nextOptions, correctAnswer: nextCorrect }
    newSteps[stepIndex] = { ...step, subSteps: subs }
    setForm({ ...form, steps: newSteps })
  }

  function handleAddSubStep(stepIndex: number) {
    // Sub-steps are only supported for multi-step questions in-game (2+ steps)
    if (form.steps.length < 2) {
      toast.error('Sub-steps require at least 2 steps. Add a second step to enable sub-steps.');
      return;
    }

    const newSteps = [...form.steps];
    const step = newSteps[stepIndex];
    const current = Array.isArray(step.subSteps) ? step.subSteps : [];

    const next: FormSubStep[] = [
      ...current,
      {
        type: 'true_false',
        prompt: '',
        options: ['True', 'False'],
        correctAnswer: 0,
        timeLimitSeconds: 15,
        explanation: ''
      }
    ];

    newSteps[stepIndex] = { ...step, subSteps: next };
    setForm({ ...form, steps: newSteps });
  }

  function handleDeleteSubStep(stepIndex: number, subStepIndex: number) {
    const newSteps = [...form.steps];
    const step = newSteps[stepIndex];
    const current = Array.isArray(step.subSteps) ? step.subSteps : [];
    const next = current.filter((_, i) => i !== subStepIndex);
    newSteps[stepIndex] = { ...step, subSteps: next };
    setForm({ ...form, steps: newSteps });
  }

  function handleMoveSubStepUp(stepIndex: number, subStepIndex: number) {
    if (subStepIndex === 0) return;
    const newSteps = [...form.steps];
    const step = newSteps[stepIndex];
    const current = Array.isArray(step.subSteps) ? [...step.subSteps] : [];
    [current[subStepIndex - 1], current[subStepIndex]] = [current[subStepIndex], current[subStepIndex - 1]];
    newSteps[stepIndex] = { ...step, subSteps: current };
    setForm({ ...form, steps: newSteps });
  }

  function handleMoveSubStepDown(stepIndex: number, subStepIndex: number) {
    const newSteps = [...form.steps];
    const step = newSteps[stepIndex];
    const current = Array.isArray(step.subSteps) ? [...step.subSteps] : [];
    if (subStepIndex >= current.length - 1) return;
    [current[subStepIndex], current[subStepIndex + 1]] = [current[subStepIndex + 1], current[subStepIndex]];
    newSteps[stepIndex] = { ...step, subSteps: current };
    setForm({ ...form, steps: newSteps });
  }

  function updateSubStepField(stepIndex: number, subStepIndex: number, field: keyof FormSubStep, value: any) {
    const newSteps = [...form.steps];
    const step = newSteps[stepIndex];
    const current = Array.isArray(step.subSteps) ? [...step.subSteps] : [];
    const updated = { ...current[subStepIndex], [field]: value };

    // When changing type to true_false, set default options and limit correctAnswer
    if (field === 'type' && value === 'true_false') {
      updated.options = ['True', 'False'];
      if (updated.correctAnswer > 1) updated.correctAnswer = 0;
    } else if (field === 'type' && value === 'mcq') {
      const next = Array.isArray(updated.options) ? [...updated.options] : []
      while (next.length < 2) next.push('')
      if (next.length > 6) next.splice(6)
      updated.options = next
      if (updated.correctAnswer < 0 || updated.correctAnswer >= next.length) updated.correctAnswer = 0;
    }

    current[subStepIndex] = updated;
    newSteps[stepIndex] = { ...step, subSteps: current };
    setForm({ ...form, steps: newSteps });
  }

  function updateSubStepOption(stepIndex: number, subStepIndex: number, optionIndex: number, value: string) {
    const newSteps = [...form.steps];
    const step = newSteps[stepIndex];
    const current = Array.isArray(step.subSteps) ? [...step.subSteps] : [];
    const sub = current[subStepIndex];
    const options = [...sub.options];
    options[optionIndex] = value;
    current[subStepIndex] = { ...sub, options };
    newSteps[stepIndex] = { ...step, subSteps: current };
    setForm({ ...form, steps: newSteps });
  }

  function handleMoveCorrectSubStepOption(stepIndex: number, subStepIndex: number, targetIndex: number) {
    const newSteps = [...form.steps];
    const step = newSteps[stepIndex];
    const current = Array.isArray(step.subSteps) ? [...step.subSteps] : [];
    const sub = current[subStepIndex];
    if (!sub) return;
    const { options, correctIndex } = moveCorrectOption(
      sub.options,
      sub.correctAnswer,
      targetIndex
    );
    current[subStepIndex] = { ...sub, options, correctAnswer: correctIndex };
    newSteps[stepIndex] = { ...step, subSteps: current };
    setForm({ ...form, steps: newSteps });
  }

  function validateForm(): boolean {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return false;
    }
    if (!form.chapter.trim()) {
      toast.error('Chapter is required');
      return false;
    }
    if (!form.stem.trim()) {
      toast.error('Stem (main question text) is required');
      return false;
    }
    if (form.steps.length < 1) {
      toast.error('At least 1 step is required');
      return false;
    }

    for (let i = 0; i < form.steps.length; i++) {
      const step = form.steps[i];
      if (!step.title.trim() || !step.prompt.trim()) {
        toast.error(`Step ${i + 1}: title and prompt are required`);
        return false;
      }
      
      if (step.type === 'true_false') {
        // True/False: need exactly 2 non-empty options
        const o0 = (step.options[0] || '').trim()
        const o1 = (step.options[1] || '').trim()
        if (!o0 || !o1) {
          toast.error(`Step ${i + 1}: True/False questions need exactly 2 options (True and False)`);
          return false;
        }
        if (step.correctAnswer < 0 || step.correctAnswer > 1) {
          toast.error(`Step ${i + 1}: True/False correct answer must be 0 (True) or 1 (False)`);
          return false;
        }
      } else {
        const raw = Array.isArray(step.options) ? step.options : []
        const trimmed = raw.map((o) => String(o ?? '').trim()).slice(0, 6)

        // MCQ: require at least A + B
        if (!trimmed[0] || !trimmed[1]) {
          toast.error(`Step ${i + 1}: MCQ needs at least 2 options (A and B)`);
          return false;
        }

        // No gaps: once an option is empty, all following must be empty
        const lastNonEmpty = (() => {
          for (let k = trimmed.length - 1; k >= 0; k--) {
            if (trimmed[k]) return k
          }
          return -1
        })()
        const effective = trimmed.slice(0, lastNonEmpty + 1)
        if (effective.length < 2) {
          toast.error(`Step ${i + 1}: MCQ needs at least 2 options (A and B)`);
          return false;
        }
        if (effective.some((o) => !o)) {
          toast.error(`Step ${i + 1}: MCQ options cannot have gaps (fill A..last option with no empty in between)`);
          return false;
        }

        const maxIndex = effective.length - 1;
        if (step.correctAnswer < 0 || step.correctAnswer > maxIndex) {
          toast.error(`Step ${i + 1}: correct answer must be between 0 and ${maxIndex}`);
          return false;
        }
        if (!effective[step.correctAnswer]) {
          toast.error(`Step ${i + 1}: correct answer cannot point to an empty option`);
          return false;
        }
      }

      // Validate sub-steps (optional)
      const subSteps = Array.isArray(step.subSteps) ? step.subSteps : [];
      for (let j = 0; j < subSteps.length; j++) {
        const sub = subSteps[j];
        if (!sub.prompt.trim()) {
          toast.error(`Step ${i + 1} Sub-step ${j + 1}: prompt is required`);
          return false;
        }

        if (sub.type === 'true_false') {
          const o0 = (sub.options[0] || '').trim()
          const o1 = (sub.options[1] || '').trim()
          if (!o0 || !o1) {
            toast.error(`Step ${i + 1} Sub-step ${j + 1}: True/False needs exactly 2 options (True and False)`);
            return false;
          }
          if (sub.correctAnswer < 0 || sub.correctAnswer > 1) {
            toast.error(`Step ${i + 1} Sub-step ${j + 1}: True/False correct answer must be 0 (True) or 1 (False)`);
            return false;
          }
        } else {
          const raw = Array.isArray(sub.options) ? sub.options : []
          const trimmed = raw.map((o) => String(o ?? '').trim()).slice(0, 6)

          // MCQ: require at least A + B
          if (!trimmed[0] || !trimmed[1]) {
            toast.error(`Step ${i + 1} Sub-step ${j + 1}: MCQ needs at least 2 options (A and B)`);
            return false;
          }

          const lastNonEmpty = (() => {
            for (let k = trimmed.length - 1; k >= 0; k--) {
              if (trimmed[k]) return k
            }
            return -1
          })()
          const effective = trimmed.slice(0, lastNonEmpty + 1)
          if (effective.length < 2) {
            toast.error(`Step ${i + 1} Sub-step ${j + 1}: MCQ needs at least 2 options (A and B)`);
            return false;
          }
          if (effective.some((o) => !o)) {
            toast.error(`Step ${i + 1} Sub-step ${j + 1}: MCQ options cannot have gaps (fill A..last option with no empty in between)`);
            return false;
          }

          const maxIndex = effective.length - 1;
          if (sub.correctAnswer < 0 || sub.correctAnswer > maxIndex) {
            toast.error(`Step ${i + 1} Sub-step ${j + 1}: correct answer must be between 0 and ${maxIndex}`);
            return false;
          }
          if (!effective[sub.correctAnswer]) {
            toast.error(`Step ${i + 1} Sub-step ${j + 1}: correct answer cannot point to an empty option`);
            return false;
          }
        }
      }
    }

    return true;
  }

  async function handleSave() {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const rawTopicTags = form.topicTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
      // Collapse any duplicate/manual archetype entries to a single canonical tag.
      const topicTagsArray = setArchetypeTag(rawTopicTags, getArchetypeValue(rawTopicTags));

      const stepsPayload: QuestionStep[] = form.steps.map((s, i) => {
        const raw = Array.isArray(s.options) ? s.options : []
        const trimmed = raw.map((o) => String(o ?? '').trim()).slice(0, 6)

        const correct = Number(s.correctAnswer)
        if (!Number.isInteger(correct)) {
          throw new Error(`Step ${i + 1}: correctAnswer must be an integer`)
        }

        let optionsToSave: string[] = []

        if (s.type === 'true_false') {
          const o0 = trimmed[0] || ''
          const o1 = trimmed[1] || ''
          if (!o0 || !o1) {
            throw new Error(`Step ${i + 1}: True/False questions must have 2 options (True and False)`)
          }
          if (correct < 0 || correct > 1) {
            throw new Error(`Step ${i + 1}: True/False correct answer must be 0 or 1`)
          }
          optionsToSave = [o0, o1].map(normalizeInlineMathOption)
        } else {
          if (!trimmed[0] || !trimmed[1]) {
            throw new Error(`Step ${i + 1}: MCQ questions must have at least 2 options (A and B)`)
          }

          const lastNonEmpty = (() => {
            for (let k = trimmed.length - 1; k >= 0; k--) {
              if (trimmed[k]) return k
            }
            return -1
          })()

          const effective = trimmed.slice(0, lastNonEmpty + 1)
          if (effective.length < 2) {
            throw new Error(`Step ${i + 1}: MCQ questions must have at least 2 options (A and B)`)
          }
          if (effective.some((o) => !o)) {
            throw new Error(`Step ${i + 1}: MCQ options cannot have gaps (fill A..last option with no empty in between)`)
          }
          if (effective.length > 6) {
            throw new Error(`Step ${i + 1}: MCQ cannot exceed 6 options`)
          }

          const maxIndex = effective.length - 1
          if (correct < 0 || correct > maxIndex) {
            throw new Error(`Step ${i + 1}: correctAnswer out of range (must be 0-${maxIndex})`)
          }
          optionsToSave = effective.map(normalizeInlineMathOption)
        }

        const subStepsPayload = (Array.isArray(s.subSteps) ? s.subSteps : [])
          .filter((sub) => sub.prompt.trim().length > 0)
          .map((sub, j) => {
            const rawSub = Array.isArray(sub.options) ? sub.options : []
            const subTrimmed = rawSub.map((o) => String(o ?? '').trim()).slice(0, 6)

            const subCorrect = Number(sub.correctAnswer)
            if (!Number.isInteger(subCorrect)) {
              throw new Error(`Step ${i + 1} Sub-step ${j + 1}: correctAnswer must be an integer`)
            }

            let subOptionsToSave: string[] = []

            if (sub.type === 'true_false') {
              const o0 = subTrimmed[0] || ''
              const o1 = subTrimmed[1] || ''
              if (!o0 || !o1) {
                throw new Error(`Step ${i + 1} Sub-step ${j + 1}: True/False must have 2 options (True and False)`)
              }
              if (subCorrect < 0 || subCorrect > 1) {
                throw new Error(`Step ${i + 1} Sub-step ${j + 1}: True/False correct answer must be 0 or 1`)
              }
              subOptionsToSave = [o0, o1].map(normalizeInlineMathOption)
            } else {
              if (!subTrimmed[0] || !subTrimmed[1]) {
                throw new Error(`Step ${i + 1} Sub-step ${j + 1}: MCQ must have at least 2 options (A and B)`)
              }

              const lastNonEmpty = (() => {
                for (let k = subTrimmed.length - 1; k >= 0; k--) {
                  if (subTrimmed[k]) return k
                }
                return -1
              })()

              const effective = subTrimmed.slice(0, lastNonEmpty + 1)
              if (effective.length < 2) {
                throw new Error(`Step ${i + 1} Sub-step ${j + 1}: MCQ must have at least 2 options (A and B)`)
              }
              if (effective.some((o) => !o)) {
                throw new Error(`Step ${i + 1} Sub-step ${j + 1}: MCQ options cannot have gaps (fill A..last option with no empty in between)`)
              }
              if (effective.length > 6) {
                throw new Error(`Step ${i + 1} Sub-step ${j + 1}: MCQ cannot exceed 6 options`)
              }

              const maxIndex = effective.length - 1
              if (subCorrect < 0 || subCorrect > maxIndex) {
                throw new Error(`Step ${i + 1} Sub-step ${j + 1}: correctAnswer out of range (must be 0-${maxIndex})`)
              }

              subOptionsToSave = effective.map(normalizeInlineMathOption)
            }

            return {
              type: sub.type,
              prompt: sub.prompt,
              options: subOptionsToSave,
              correctAnswer: subCorrect,
              timeLimitSeconds: sub.timeLimitSeconds ?? 15,
              explanation: sub.explanation || null
            };
          });
        
        return {
          id: s.id || `step-${i + 1}`,
          index: i,
          type: s.type,
          title: s.title,
          prompt: s.prompt,
          diagramSmiles: s.diagramSmiles?.trim() ? s.diagramSmiles.trim() : undefined,
          diagramImageUrl: s.diagramImageUrl?.trim() ? s.diagramImageUrl.trim() : undefined,
          options: optionsToSave,
          correctAnswer: correct,
          timeLimitSeconds: s.timeLimitSeconds ?? null,
          marks: s.marks,
          explanation: s.explanation || null,
          subSteps: subStepsPayload.length > 0 ? subStepsPayload : undefined
        }
      });

      const hasSubSteps = stepsPayload.some((s: any) => Array.isArray((s as any).subSteps) && (s as any).subSteps.length > 0);
      if (hasSubSteps && stepsPayload.length < 2) {
        toast.error('Sub-steps require at least 2 steps for in-game multi-step flow. Add Step 2 or remove sub-steps.');
        return;
      }

      if (form.graphEnabled) {
        const graphSeriesError = (Array.isArray(form.graphSeries) ? form.graphSeries : [])
          .map((series, index) => validateGraphSeriesForm(series, index))
          .find(Boolean)

        if (graphSeriesError) {
          toast.error(graphSeriesError)
          return
        }

        const graphPolygonError = (Array.isArray(form.graphPolygons) ? form.graphPolygons : [])
          .map((polygon, index) => validateGraphPolygonForm(polygon, index))
          .find(Boolean)

        if (graphPolygonError) {
          toast.error(graphPolygonError)
          return
        }

        const graphLabelError = (Array.isArray(form.graphLabels) ? form.graphLabels : [])
          .map((label, index) => validateGraphLabelForm(label, index))
          .find(Boolean)

        if (graphLabelError) {
          toast.error(graphLabelError)
          return
        }

        const graphAngleMarkerError = (Array.isArray(form.graphAngleMarkers) ? form.graphAngleMarkers : [])
          .map((marker, index) => validateGraphAngleMarkerForm(marker, index))
          .find(Boolean)

        if (graphAngleMarkerError) {
          toast.error(graphAngleMarkerError)
          return
        }

        const graphCircleError = (Array.isArray(form.graphCircles) ? form.graphCircles : [])
          .map((circle, index) => validateGraphCircleForm(circle, index))
          .find(Boolean)

        if (graphCircleError) {
          toast.error(graphCircleError)
          return
        }

        const graphArcError = (Array.isArray(form.graphArcs) ? form.graphArcs : [])
          .map((arc, index) => validateGraphArcForm(arc, index))
          .find(Boolean)

        if (graphArcError) {
          toast.error(graphArcError)
          return
        }

        const graphSegmentError = (Array.isArray(form.graphSegments) ? form.graphSegments : [])
          .map((segment, index) => validateGraphSegmentForm(segment, index))
          .find(Boolean)

        if (graphSegmentError) {
          toast.error(graphSegmentError)
          return
        }
      }

      const graphConfig = buildGraphConfigFromForm(form)
      if (form.graphEnabled && !graphConfig) {
        toast.error('Graph enabled: please add at least one valid graph series or geometry overlay.')
        return
      }

      // Validate explicit domains (if provided)
      const xMin = parseNumberOrUndefined(form.graphXMin)
      const xMax = parseNumberOrUndefined(form.graphXMax)
      const yMin = parseNumberOrUndefined(form.graphYMin)
      const yMax = parseNumberOrUndefined(form.graphYMax)
      if (xMin != null && xMax != null && xMin >= xMax) {
        toast.error('Graph X domain invalid: xMin must be less than xMax')
        return
      }
      if (yMin != null && yMax != null && yMin >= yMax) {
        toast.error('Graph Y domain invalid: yMin must be less than yMax')
        return
      }

      const payload = {
        title: form.title,
        is_enabled: form.isEnabled,
        subject: form.subject,
        chapter: form.chapter,
        level: form.level,
        difficulty: form.difficulty,
        rank_tier: form.rankTier || null,
        stem: form.stem,
        structure_smiles: form.structureSmiles || null,
        graph: graphConfig,
        main_question_timer_seconds: form.mainQuestionTimerSeconds,
        total_marks: form.totalMarks,
        topic_tags: topicTagsArray,
        steps: stepsPayload,
        image_url: form.imageUrl || null,
      };

      if (mode === 'creating') {
        const { data, error } = await supabase
          .from('questions_v2')
          .insert([payload] as any)
          .select()
          .single();

        if (error) throw error;

        toast.success('Question created successfully!');
        fetchQuestions();
        const newQuestion = dbRowToQuestion(data);
        setMode('editing');
        setSelectedQuestionId(newQuestion.id);
      } else if (mode === 'editing' && selectedQuestionId) {
        const { data, error } = await supabase
          .from('questions_v2')
          .update(payload as any)
          .eq('id', selectedQuestionId)
          .select()
          .single();

        if (error) throw error;

        toast.success('Question updated successfully!');
        fetchQuestions();
      }
    } catch (error: any) {
      console.error('[AdminQuestions] Save error:', error);
      toast.error(error.message || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedQuestionId) return;
    if (!confirm('Are you sure you want to delete this question? This cannot be undone.')) return;

    try {
      const id = selectedQuestionId;
      await deleteQuestionCascadeOrManual(id);
      toast.success('Question deleted successfully!');
      setMode('idle');
      setSelectedQuestionId(null);
      setForm(getEmptyForm());
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      fetchQuestions();
    } catch (error: any) {
      console.error('[AdminQuestions] Delete error:', error);
      toast.error(error.message || 'Failed to delete question');
    }
  }

  async function handleDeleteFromList(questionId: string, event: React.MouseEvent) {
    event.stopPropagation(); // Prevent selecting the question when clicking delete
    
    if (!confirm('Are you sure you want to delete this question? This cannot be undone.')) {
      return;
    }

    try {
      await deleteQuestionCascadeOrManual(questionId);
      toast.success('Question deleted successfully!');

      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });

      // If deleted question was selected, clear selection
      if (selectedQuestionId === questionId) {
        setMode('idle');
        setSelectedQuestionId(null);
        setForm(getEmptyForm());
      }
      
      fetchQuestions();
    } catch (error: any) {
      console.error('[AdminQuestions] Delete error:', error);
      toast.error(error.message || 'Failed to delete question');
    }
  }

  // Common styles
  const glassPanel = "bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden shadow-xl";
  const fullscreenListPanel = "bg-white/[0.06] backdrop-blur-xl overflow-hidden";
  const glassInput = "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary/50 focus:ring-primary/20";
  const compactInput = `${glassInput} h-9 text-sm`;
  const compactLabelStyle = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55";
  const fileInput = `${glassInput} file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white`;
  const labelStyle = "text-white/70 font-medium mb-1.5 block text-sm";

  // Loading state
  if (authLoading || checkingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
        <SpaceBackground />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-white/70 font-medium animate-pulse">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Not logged in / Not admin
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
        <SpaceBackground />
        <div className={`relative z-10 max-w-md w-full p-8 ${glassPanel} text-center`}>
          <Shield className={`w-16 h-16 mx-auto mb-6 ${!user ? 'text-white/50' : 'text-red-500'}`} />
          <h2 className="text-2xl font-black text-white mb-2">
            {!user ? 'Authentication Required' : 'Access Denied'}
          </h2>
          <p className="text-white/60 mb-8">
            {!user ? 'Please login to access the admin panel.' : 'You do not have permission to view this page.'}
          </p>
          <Button
            onClick={() => navigate(!user ? '/auth' : '/')}
            className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/10 h-12 text-lg font-bold"
          >
            {!user ? 'Go to Login' : 'Return Home'}
          </Button>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className="min-h-screen text-foreground relative overflow-hidden font-sans">
      <SpaceBackground />

      <div className="relative z-10 flex h-screen w-full flex-col">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-black/10 px-4 py-2.5 backdrop-blur-md sm:px-5 lg:px-6">
          <div>
            <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl" style={{ fontFamily: 'Roboto, sans-serif' }}>
              ADMIN <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">DASHBOARD</span>
            </h1>
            <p className="text-[11px] font-medium text-white/55 sm:text-xs">Manage battle questions and content</p>
          </div>
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            Exit to App
          </Button>
        </div>

        {/* Content */}
        <div className={`flex-1 min-h-0 ${isEditorView ? 'px-4 py-4 sm:px-5 lg:px-6' : ''}`}>
          {!isEditorView ? (
            <div className={`${fullscreenListPanel} flex h-full min-h-0 flex-col overflow-hidden lg:flex-row`}>
              {/* Filters */}
              <aside className="border-b border-white/10 bg-white/[0.035] p-3 sm:p-4 lg:w-[250px] lg:shrink-0 lg:border-b-0 lg:border-r xl:w-[270px] 2xl:w-[285px]">
                <div className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-white/85">
                  <Filter className="h-4 w-4 text-primary" />
                  Filters
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
                  <div>
                    <label className={compactLabelStyle}>Subject</label>
                    <Select value={filters.subject} onValueChange={(v: any) => setFilters({ ...filters, subject: v })}>
                      <SelectTrigger className={compactInput}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-white/10 text-white">
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="math">Math</SelectItem>
                        <SelectItem value="physics">Physics</SelectItem>
                        <SelectItem value="chemistry">Chemistry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={compactLabelStyle}>Level</label>
                    <Select value={filters.level} onValueChange={(v: any) => setFilters({ ...filters, level: v })}>
                      <SelectTrigger className={compactInput}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-white/10 text-white">
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="A1">A1</SelectItem>
                        <SelectItem value="A2">A2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className={compactLabelStyle}>Done Status</label>
                    <Select value={filters.done} onValueChange={(v: any) => setFilters({ ...filters, done: v })}>
                      <SelectTrigger className={compactInput}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-white/10 text-white">
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className={compactLabelStyle}>Quick Search</label>
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search title, chapter, subject..."
                      className={compactInput}
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFilters({ subject: 'all', level: 'all', difficulty: 'all', rankTier: '', done: 'all' });
                      setSearchTerm('');
                    }}
                    className="h-9 bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                  >
                    Reset Filters
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleNewQuestion}
                    className="h-9 bg-gradient-to-r from-amber-400 to-orange-500 text-sm font-semibold text-gray-900 shadow-lg shadow-orange-500/20 hover:from-amber-500 hover:to-orange-600"
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Create New Question
                  </Button>
                </div>
              </aside>

              {/* Question List */}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="border-b border-white/10 bg-white/[0.045] px-3 py-2.5 backdrop-blur-md sm:px-4">
                  <div className="flex flex-col gap-1.5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                      <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white sm:text-xs">
                        <Search className="h-4 w-4 text-primary" />
                        Questions
                      </h3>
                      <span className="text-[11px] font-medium text-white/65 sm:text-xs">
                        {filteredQuestions.length} shown / {questions.length} total
                      </span>
                      {mappingErrors.length > 0 && (
                        <Badge variant="outline" className="border-amber-300/40 bg-amber-500/10 text-[11px] text-amber-300">
                          {mappingErrors.length} parsing issues
                        </Badge>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-2 text-[10px] text-white/50 sm:text-[11px]">
                      <span className="max-w-full truncate">{searchTerm ? `Searching "${searchTerm}"` : 'Use filters or search to refine'}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setDiagnosticsOpen((v) => !v)}
                        className="bg-white/5 border-white/15 text-white/70 hover:bg-white/10"
                        title="Show diagnostics to debug missing SQL-inserted questions"
                      >
                        Diagnostics
                      </Button>
                    </div>
                  </div>
                </div>

              {diagnosticsOpen && (
                <div className="space-y-2.5 border-b border-white/10 bg-white/[0.035] px-3 py-2.5 backdrop-blur-md sm:px-4">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="text-xs text-white/60">
                      <span className="font-semibold text-white/80">Supabase:</span>{' '}
                      <span className="font-mono">{SUPABASE_URL}</span>
                    </div>
                    <div className="text-xs text-white/60">
                      {lastFetchStats ? (
                        <>
                          <span className="font-semibold text-white/80">Last fetch:</span>{' '}
                          <span className="font-mono">
                            raw={lastFetchStats.rawCount} mapped={lastFetchStats.mappedCount}
                          </span>
                          {lastFetchStats.errorMessage ? (
                            <span className="ml-2 text-red-200/80">
                              error: {lastFetchStats.errorMessage}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="font-mono">No fetch stats yet</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 items-end gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <div>
                      <Label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">Find rows by title (diagnostic)</Label>
                      <div className="mt-1 flex gap-2">
                        <Input
                          value={chemTestQuery}
                          onChange={(e) => setChemTestQuery(e.target.value)}
                          className={compactInput}
                          placeholder='e.g. "Chem Test"'
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void runTitleDiagnosticsLookup()}
                          disabled={chemTestLookup.loading}
                          className="h-9 border border-white/10 bg-white/10 text-white hover:bg-white/15"
                        >
                          {chemTestLookup.loading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking…
                            </>
                          ) : (
                            'Check'
                          )}
                        </Button>
                      </div>
                      <div className="mt-1 text-[11px] text-white/45">
                        This runs a direct DB query. If this returns 0 rows, your SQL likely didn’t insert into this project.
                      </div>
                    </div>

                    <div className="text-[11px] text-white/50">
                      {chemTestLookup.checkedAtIso ? (
                        <span className="font-mono">checked {new Date(chemTestLookup.checkedAtIso).toLocaleString()}</span>
                      ) : (
                        <span className="font-mono">not checked yet</span>
                      )}
                    </div>
                  </div>

                  {chemTestLookup.error && (
                    <div className="text-xs text-red-200/80">
                      Lookup error: <span className="font-mono">{chemTestLookup.error}</span>
                    </div>
                  )}

                  {chemTestLookup.rows.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
                      <div className="px-3 py-2 text-xs text-white/70 border-b border-white/10 flex items-center justify-between">
                        <span>
                          Found <span className="font-semibold text-white/90">{chemTestLookup.rows.length}</span> row(s)
                        </span>
                        <span className="font-mono text-white/50">title ILIKE %{chemTestQuery}%</span>
                      </div>
                      <div className="max-h-48 overflow-auto">
                        {chemTestLookup.rows.map((r) => (
                          <div key={r.id} className="px-3 py-2 text-xs border-b border-white/5">
                            <div className="text-white/90 font-semibold">{r.title}</div>
                            <div className="font-mono text-white/45">
                              id={r.id} created={r.created_at} updated={r.updated_at}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {mappingIssueDetails.length > 0 && (
                    <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-3">
                      <div className="text-xs font-semibold text-amber-200 mb-2">
                        Mapping issues ({mappingIssueDetails.length})
                      </div>
                      <div className="space-y-2 max-h-40 overflow-auto">
                        {mappingIssueDetails.slice(0, 20).map((m) => (
                          <div key={`${m.idx}-${m.rowId || ''}`} className="text-[11px] text-amber-100/80">
                            <span className="font-mono text-amber-100/60">row[{m.idx}]</span>{' '}
                            {m.title ? <span className="font-semibold">{m.title}</span> : null}{' '}
                            {m.rowId ? <span className="font-mono text-amber-100/50">({m.rowId})</span> : null}
                            <div className="font-mono text-amber-100/70">{m.message}</div>
                          </div>
                        ))}
                        {mappingIssueDetails.length > 20 && (
                          <div className="text-[11px] text-amber-100/60">
                            Showing first 20 issues.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bulk selection controls */}
              <div className="border-b border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur-md sm:px-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="text-[11px] font-medium text-white/60 sm:text-xs">
                    {selectedCount > 0 ? (
                      <span>
                        <span className="text-emerald-300 font-bold">{selectedCount}</span> selected
                      </span>
                    ) : (
                      <span>Select questions to enable bulk actions</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedCount > 0 && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleBulkSetEnabled(false)}
                          disabled={bulkActionLoading}
                          className="bg-red-500/10 border-red-500/20 text-red-200 hover:bg-red-500/20"
                          title="Disable selected questions (exclude from online battles)"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Disable
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleBulkSetEnabled(true)}
                          disabled={bulkActionLoading}
                          className="bg-emerald-500/10 border-emerald-500/20 text-emerald-200 hover:bg-emerald-500/20"
                          title="Enable selected questions (available in online battles)"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Enable
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleBulkDeleteSelected}
                          disabled={bulkActionLoading}
                          className="bg-red-500/10 border-red-500/20 text-red-200 hover:bg-red-500/20"
                          title="Delete selected questions (irreversible)"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleSelectAllShown}
                      disabled={bulkActionLoading || filteredQuestions.length === 0 || allShownSelected}
                      className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                      title="Select all questions currently shown by filters/search"
                    >
                      Select all shown
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleClearSelection}
                      disabled={bulkActionLoading || selectedCount === 0}
                      className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                    >
                      Clear selection
                    </Button>
                  </div>
                </div>

                <div className="mt-2.5 w-full">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">Bulk edit</div>
                  <div className="grid grid-cols-1 items-end gap-2.5 sm:grid-cols-2 xl:grid-cols-5 2xl:grid-cols-6">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/60">Subject</label>
                      <Select
                        value={bulkEdit.subject}
                        onValueChange={(v: any) => setBulkEdit({ ...bulkEdit, subject: v })}
                        disabled={bulkEditDisabled}
                      >
                        <SelectTrigger className={compactInput}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-white/10 text-white">
                          <SelectItem value="keep">No change</SelectItem>
                          <SelectItem value="math">Math</SelectItem>
                          <SelectItem value="physics">Physics</SelectItem>
                          <SelectItem value="chemistry">Chemistry</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/60">Grade/Level</label>
                      <Select
                        value={bulkEdit.level}
                        onValueChange={(v: any) => setBulkEdit({ ...bulkEdit, level: v })}
                        disabled={bulkEditDisabled}
                      >
                        <SelectTrigger className={compactInput}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-white/10 text-white">
                          <SelectItem value="keep">No change</SelectItem>
                          <SelectItem value="A1">A1</SelectItem>
                          <SelectItem value="A2">A2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/60">Difficulty</label>
                      <Select
                        value={bulkEdit.difficulty}
                        onValueChange={(v: any) => setBulkEdit({ ...bulkEdit, difficulty: v })}
                        disabled={bulkEditDisabled}
                      >
                        <SelectTrigger className={compactInput}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-white/10 text-white">
                          <SelectItem value="keep">No change</SelectItem>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="xl:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium text-white/60">Chapter</label>
                      <Input
                        value={bulkEdit.chapter}
                        onChange={(e) => setBulkEdit({ ...bulkEdit, chapter: e.target.value })}
                        className={compactInput}
                        placeholder="Leave blank to keep"
                        disabled={bulkEditDisabled}
                        list={
                          bulkEdit.subject === 'math'
                            ? bulkEdit.level === 'A2'
                              ? 'bulk-math-a2-chapters'
                              : 'bulk-math-a1-chapters'
                            : bulkEdit.subject === 'physics' && bulkEdit.level === 'A1'
                              ? 'bulk-physics-a1-chapters'
                              : bulkEdit.subject === 'chemistry'
                                ? 'bulk-chemistry-chapters'
                                : undefined
                        }
                      />
                      {bulkEdit.subject === 'math' && bulkEdit.level !== 'A2' && (
                        <datalist id="bulk-math-a1-chapters">
                          {MATH_A1_CHAPTER_TITLES.map((t) => (
                            <option key={t} value={t} />
                          ))}
                        </datalist>
                      )}
                      {bulkEdit.subject === 'math' && bulkEdit.level === 'A2' && (
                        <datalist id="bulk-math-a2-chapters">
                          {MATH_A2_CHAPTER_TITLES.map((t) => (
                            <option key={t} value={t} />
                          ))}
                        </datalist>
                      )}
                      {bulkEdit.subject === 'physics' && bulkEdit.level === 'A1' && (
                        <datalist id="bulk-physics-a1-chapters">
                          {PHYSICS_A1_CHAPTER_TITLES.map((t) => (
                            <option key={t} value={t} />
                          ))}
                        </datalist>
                      )}
                      {bulkEdit.subject === 'chemistry' && (
                        <datalist id="bulk-chemistry-chapters">
                          {CHEMISTRY_CHAPTER_TITLES.map((t) => (
                            <option key={t} value={t} />
                          ))}
                        </datalist>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-white/60">Main timer (sec)</label>
                      <Input
                        type="number"
                        min={5}
                        max={600}
                        step={1}
                        value={bulkEdit.mainQuestionTimerSeconds}
                        onChange={(e) => setBulkEdit({ ...bulkEdit, mainQuestionTimerSeconds: e.target.value })}
                        className={compactInput}
                        placeholder="Leave blank to keep"
                        disabled={bulkEditDisabled}
                      />
                    </div>

                    <div className="flex items-end sm:col-span-2 xl:col-span-1 2xl:col-span-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleBulkApply}
                        disabled={bulkEditDisabled || !bulkEditHasChanges}
                        className="h-9 w-full bg-emerald-500/10 border-emerald-500/20 text-emerald-200 hover:bg-emerald-500/20"
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="custom-scrollbar flex-1 overflow-y-auto px-2 py-2.5 sm:px-3 lg:px-4">
                {loadingQuestions ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : filteredQuestions.length === 0 ? (
                  <div className="text-center py-12 text-white/40">
                    <p>No questions match the current filters/search.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
                    {filteredQuestions.map((q) => {
                      const isBulkSelected = selectedIds.has(q.id);
                      const mainQuestionText = String(q.stem || q.steps?.[0]?.prompt || '').trim();
                      return (
                        <div
                          key={q.id}
                          onClick={() => navigate(`/admin/questions?edit=${q.id}`)}
                          className={`relative group flex h-full cursor-pointer flex-col rounded-lg border border-transparent bg-white/5 px-3.5 pb-3.5 pl-9 pr-3.5 pt-3.5 transition-all duration-200 hover:bg-white/10 hover:border-white/10 sm:pl-10 xl:min-h-[158px] ${isBulkSelected ? 'ring-2 ring-emerald-400/25 border-emerald-400/40' : ''} ${q.isEnabled === false ? 'opacity-60' : ''} ${q.isDone ? 'bg-emerald-500/5 border-emerald-400/30' : ''}`}
                        >
                        {/* Bulk select checkbox */}
                        <input
                          type="checkbox"
                          checked={isBulkSelected}
                          disabled={bulkActionLoading}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => toggleSelected(q.id, e.target.checked)}
                          className="absolute left-2.5 top-2.5 h-4 w-4 cursor-pointer accent-emerald-400"
                          aria-label={`Select question ${q.title}`}
                          title="Select for bulk actions"
                        />

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleDone(q.id, !q.isDone);
                          }}
                          disabled={!!doneToggleLoading[q.id]}
                          className={`absolute right-9 top-2.5 rounded-md border p-1 transition-colors z-10 ${
                            q.isDone
                              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/30'
                              : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                          }`}
                          title={q.isDone ? 'Mark as pending' : 'Mark as done'}
                          aria-label={q.isDone ? 'Mark as pending' : 'Mark as done'}
                        >
                          {doneToggleLoading[q.id]
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <CheckCircle2 className="w-4 h-4" />}
                        </button>

                      {/* Delete button - appears on hover */}
                      <button
                        onClick={(e) => handleDeleteFromList(q.id, e)}
                        className="absolute right-2.5 top-2.5 rounded-md border border-red-500/20 bg-red-500/10 p-1 text-red-400 opacity-0 transition-opacity group-hover:opacity-100 z-10 hover:bg-red-500/20"
                        title="Delete question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="mb-1 flex items-start justify-between gap-2">
                        <div className="line-clamp-2 pr-3 text-sm font-semibold leading-5 text-white sm:text-[15px]">{q.title}</div>
                        <span className="shrink-0 font-mono text-[10px] text-white/35">#{q.id.slice(0, 6)}</span>
                      </div>

                      {mainQuestionText && (
                        <p className="mb-1 line-clamp-2 text-[11px] leading-5 text-white/78 sm:text-xs">
                          {mainQuestionText}
                        </p>
                      )}

                      <p className="mb-1.5 line-clamp-1 text-[11px] text-white/60">{q.chapter}</p>

                      {q.isDone && (
                        <Badge
                          variant="outline"
                          className="mb-1 inline-flex items-center gap-1 border-0 bg-emerald-500/20 text-[10px] uppercase tracking-wider text-emerald-200"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Done
                        </Badge>
                      )}

                      {q.isEnabled === false && (
                        <Badge
                          variant="outline"
                          className="mb-1 inline-flex items-center gap-1 border-0 bg-red-500/20 text-[10px] uppercase tracking-wider text-red-300"
                        >
                          <XCircle className="w-3 h-3" />
                          Disabled
                        </Badge>
                      )}

                      <div className="mb-2 grid grid-cols-2 gap-1.5 text-[11px] font-semibold 2xl:grid-cols-4">
                        <Badge variant="outline" className={`uppercase tracking-wider border-0 ${q.subject === 'math' ? 'bg-blue-500/20 text-blue-300' :
                            q.subject === 'physics' ? 'bg-purple-500/20 text-purple-300' : 'bg-green-500/20 text-green-300'
                          }`}>
                          {q.subject}
                        </Badge>
                        <Badge variant="outline" className="border-white/10 bg-white/5 text-white/70">{q.level}</Badge>
                        <Badge variant="outline" className={`border-0 ${q.difficulty === 'hard' ? 'bg-red-500/20 text-red-300' :
                            q.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'
                          }`}>
                          {q.difficulty}
                        </Badge>
                        <Badge variant="outline" className="border-white/10 bg-white/5 text-white/70">{q.rankTier || 'No tier'}</Badge>
                      </div>

                      <div className="mt-auto flex justify-between text-[11px] font-medium text-white/70">
                        <span>{q.steps.length} step{q.steps.length === 1 ? '' : 's'}</span>
                        <span>{q.totalMarks} mark{q.totalMarks === 1 ? '' : 's'}</span>
                      </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          ) : (
            <div className={`${glassPanel} flex flex-col h-full overflow-hidden relative`}>
            {mode === 'idle' ? (
              <div className="flex-1 flex flex-col items-center justify-center text-white/30">
                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                  <Shield className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-white/50 mb-2">Ready to Edit</h3>
                <p>Select a question or create a new one</p>
              </div>
            ) : (
              <>
                {/* Editor Header */}
                <div className="p-6 border-b border-white/10 bg-white/5 flex flex-wrap gap-4 justify-between items-center sticky top-0 z-20 backdrop-blur-xl">
                  <div className="flex items-start gap-4">
                    <Button
                      onClick={() => navigate('/admin/questions')}
                      variant="ghost"
                      className="text-white/70 hover:text-white hover:bg-white/10"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to list
                    </Button>
                    <div>
                      <h2 className="text-xl font-black text-white tracking-wide">
                        {mode === 'creating' ? 'NEW QUESTION' : 'EDIT QUESTION'}
                      </h2>
                      <p className="text-xs text-white/50 font-mono mt-1 uppercase tracking-widest">
                        {mode === 'creating' ? 'DRAFTING MODE' : `ID: ${selectedQuestionId?.slice(0, 8)}...`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        setShowPreview(false);
                        navigate('/admin/preview/endgame', {
                          state: { question: formToQuestion(form) },
                        });
                      }}
                      variant="outline"
                      className="bg-white/5 hover:bg-white/10 text-white border-white/10"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Preview Endgame
                    </Button>
                    {mode === 'editing' && (
                      <Button
                        onClick={handleDelete}
                        variant="destructive"
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    )}
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/20 border-0"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Save Changes
                    </Button>
                  </div>
                </div>

                {/* Editor Content */}
                <div className="flex-1 overflow-hidden flex">
                  {/* Main Editor */}
                  <div className={`flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar transition-all ${showPreview ? 'w-1/2 pr-4' : 'w-full'}`}>

                  {subStepsRequireTwoSteps && (
                    <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-100">
                      <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                        <div>
                          <div className="font-bold text-sm">Sub-steps require at least 2 steps</div>
                          <div className="text-xs text-yellow-100/80 mt-1">
                            This question currently has sub-steps but only 1 step. In-game, that plays as a single-step question and shows options immediately.
                            Add a Step 2 (multi-step) or remove sub-steps.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section: Meta */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-white/90 border-b border-white/10 pb-2 flex items-center gap-2">
                      <div className="w-1 h-5 bg-primary rounded-full"></div>
                      Meta Information
                    </h3>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2">
                        <label className={labelStyle}>Title *</label>
                        <Input
                          value={form.title}
                          onChange={e => setForm({ ...form, title: e.target.value })}
                          className={glassInput}
                          placeholder="e.g. Integration by Parts: ln(x)/x³"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className={labelStyle}>Matchmaking</label>
                        <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                          <label className="flex items-center gap-3 text-sm text-white/80 select-none">
                            <input
                              type="checkbox"
                              checked={form.isEnabled}
                              onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
                              className="h-4 w-4 accent-emerald-400"
                            />
                            Enabled (available in online battles)
                          </label>
                          <p className="text-xs text-white/40">
                            If disabled, this question will not be selected in online battles. Practice remains unchanged.
                          </p>
                          {!form.isEnabled && (
                            <p className="text-xs text-red-200/70">
                              Disabled: this question is excluded from matchmaking selection.
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className={labelStyle}>Subject *</label>
                        <Select value={form.subject} onValueChange={(v: any) => setForm({ ...form, subject: v })}>
                          <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-gray-900 border-white/10 text-white">
                            <SelectItem value="math">Math</SelectItem>
                            <SelectItem value="physics">Physics</SelectItem>
                            <SelectItem value="chemistry">Chemistry</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className={labelStyle}>Chapter *</label>
                        <Input
                          value={form.chapter}
                          onChange={e => setForm({ ...form, chapter: e.target.value })}
                          className={glassInput}
                          placeholder="e.g. Integration"
                          list={
                            form.subject === 'math'
                              ? form.level === 'A2'
                                ? 'math-a2-chapters'
                                : 'math-a1-chapters'
                              : form.subject === 'physics' && form.level === 'A1'
                                ? 'physics-a1-chapters'
                                : form.subject === 'chemistry'
                                  ? 'chemistry-chapters'
                                  : undefined
                          }
                        />
                        {form.subject === 'math' && form.level !== 'A2' && (
                          <datalist id="math-a1-chapters">
                            {MATH_A1_CHAPTER_TITLES.map((t) => (
                              <option key={t} value={t} />
                            ))}
                          </datalist>
                        )}
                        {form.subject === 'math' && form.level === 'A2' && (
                          <datalist id="math-a2-chapters">
                            {MATH_A2_CHAPTER_TITLES.map((t) => (
                              <option key={t} value={t} />
                            ))}
                          </datalist>
                        )}
                        {form.subject === 'physics' && form.level === 'A1' && (
                          <datalist id="physics-a1-chapters">
                            {PHYSICS_A1_CHAPTER_TITLES.map((t) => (
                              <option key={t} value={t} />
                            ))}
                          </datalist>
                        )}
                        {form.subject === 'chemistry' && (
                          <datalist id="chemistry-chapters">
                            {CHEMISTRY_CHAPTER_TITLES.map((t) => (
                              <option key={t} value={t} />
                            ))}
                          </datalist>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelStyle}>Level *</label>
                          <Select value={form.level} onValueChange={(v: any) => setForm({ ...form, level: v })}>
                            <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-gray-900 border-white/10 text-white">
                              <SelectItem value="A1">A1</SelectItem>
                              <SelectItem value="A2">A2</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className={labelStyle}>Difficulty *</label>
                          <Select value={form.difficulty} onValueChange={(v: any) => setForm({ ...form, difficulty: v })}>
                            <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-gray-900 border-white/10 text-white">
                              <SelectItem value="easy">Easy</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="hard">Hard</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <label className={labelStyle}>Total Marks</label>
                        <Input
                          type="number"
                          value={form.totalMarks}
                          onChange={e => {
                            const marks = parseInt(e.target.value) || 1;
                            setForm({ ...form, totalMarks: marks });
                          }}
                          className={glassInput}
                        />
                        <p className="text-xs text-white/40 mt-1">
                          Auto-calculated: {form.steps.reduce((sum, s) => sum + s.marks, 0)} marks
                        </p>
                      </div>

                      <div className="col-span-2">
                        <label className={labelStyle}>Main Question Timer (mm:ss)</label>
                        <div className="mt-2 flex items-center gap-4">
                          <Slider
                            min={5}
                            max={600}
                            step={1}
                            value={[form.mainQuestionTimerSeconds]}
                            onValueChange={(v) => {
                              const raw = Array.isArray(v) ? v[0] : 180;
                              const next = Math.max(5, Math.min(600, Number.isFinite(raw) ? Math.floor(raw) : 180));
                              setForm({ ...form, mainQuestionTimerSeconds: next });
                            }}
                            className="flex-1"
                          />
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={10}
                              value={Math.floor(form.mainQuestionTimerSeconds / 60)}
                              onChange={(e) => {
                                const min = e.target.value ? parseInt(e.target.value) : 0;
                                const minutes = Number.isFinite(min) ? Math.max(0, min) : 0;
                                const seconds = form.mainQuestionTimerSeconds % 60;
                                const next = Math.max(5, Math.min(600, minutes * 60 + seconds));
                                setForm({ ...form, mainQuestionTimerSeconds: next });
                              }}
                              className={`${glassInput} w-16 text-center tabular-nums`}
                              aria-label="Main question minutes"
                            />
                            <span className="text-sm text-white/60 font-mono">:</span>
                            <Input
                              type="number"
                              min={0}
                              max={59}
                              value={form.mainQuestionTimerSeconds % 60}
                              onChange={(e) => {
                                const sec = e.target.value ? parseInt(e.target.value) : 0;
                                const seconds = Number.isFinite(sec) ? Math.max(0, Math.min(59, sec)) : 0;
                                const minutes = Math.floor(form.mainQuestionTimerSeconds / 60);
                                const next = Math.max(5, Math.min(600, minutes * 60 + seconds));
                                setForm({ ...form, mainQuestionTimerSeconds: next });
                              }}
                              className={`${glassInput} w-16 text-center tabular-nums`}
                              aria-label="Main question seconds"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-white/40 mt-1">
                          Main question phase before steps. Range 0:05–10:00 (default 1:30).
                        </p>
                      </div>

                      <div className="col-span-2">
                        <label className={labelStyle}>Stem (Main Question) *</label>
                        <Textarea
                          value={form.stem}
                          onChange={e => setForm({ ...form, stem: e.target.value })}
                          className={`${glassInput} min-h-[120px]`}
                          placeholder="Enter the main question text/context here. This appears before all steps..."
                        />
                        <p className="text-xs text-white/40 mt-1">
                          This is the main question context that appears before all steps
                        </p>
                      </div>

                      <div className="col-span-2">
                        <label className={labelStyle}>Topic Tags (Comma-separated)</label>
                        <Input
                          value={form.topicTags}
                          onChange={e => setForm({ ...form, topicTags: e.target.value })}
                          className={glassInput}
                          placeholder="e.g. integration, by-parts, calculus"
                        />
                        <p className="text-xs text-white/40 mt-1">
                          Separate tags with commas for better searchability
                        </p>
                      </div>

                      <div className="col-span-2">
                        <label className={labelStyle}>Archetype (Anti-Clumping)</label>
                        <select
                          value={getArchetypeValue(form.topicTags.split(',').map(t => t.trim()).filter(Boolean))}
                          onChange={e => {
                            const tags = form.topicTags.split(',').map(t => t.trim()).filter(Boolean)
                            const next = setArchetypeTag(tags, e.target.value)
                            setForm({ ...form, topicTags: next.join(', ') })
                          }}
                          className={glassInput}
                        >
                          <option value="">— Unclassified —</option>
                          {getSuggestedFamilies(form.chapter).map(family => (
                            <optgroup key={family.label} label={family.label}>
                              {family.archetypes.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <p className="text-xs text-white/40 mt-1">
                          The specific operation this question asks for. Stored as an
                          <code className="mx-1">archetype_*</code> tag and used to avoid back-to-back identical question types.
                        </p>
                      </div>

                      <div className="col-span-2">
                        <label className={labelStyle}>Image URL (Optional)</label>
                        <Input
                          value={form.imageUrl}
                          onChange={e => setForm({ ...form, imageUrl: e.target.value })}
                          className={glassInput}
                          placeholder="https://..."
                        />
                        <div className="mt-2 grid gap-2">
                          <Input
                            type="file"
                            accept="image/*"
                            className={fileInput}
                            disabled={uploadingMainImage}
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null;
                              e.currentTarget.value = '';
                              void handleMainImageUpload(file);
                            }}
                          />
                          <div className="text-xs text-white/40 flex items-center gap-2">
                            {uploadingMainImage && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>Uploads to storage (max 5 MB).</span>
                          </div>
                        </div>
                        {form.imageUrl && (
                          <img src={form.imageUrl} alt="Preview" className="mt-2 rounded-lg max-w-xs border border-white/10" onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }} />
                        )}
                      </div>

                      <div className="col-span-2">
                        <label className={labelStyle}>Structure SMILES (Optional)</label>
                        {form.subject === 'chemistry' && (
                          <div className="flex flex-wrap items-center gap-2 mt-1 mb-2">
                            <span className="text-xs text-white/45">Insert preset:</span>
                            <SmilesPresetSelect
                              key={structurePresetNonce}
                              onPick={(smiles) => {
                                setForm((prev) => ({ ...prev, structureSmiles: smiles }));
                                setStructurePresetNonce((n) => n + 1);
                              }}
                            />
                          </div>
                        )}
                        <Input
                          value={form.structureSmiles}
                          onChange={e => setForm({ ...form, structureSmiles: e.target.value })}
                          className={glassInput}
                          placeholder="e.g. c1ccccc1 (benzene) or CCO"
                        />
                        <p className="text-xs text-white/40 mt-1">
                          Renders a skeletal diagram under the main question in-game. You can also embed inline tokens like
                          {' '}
                          <span className="font-mono text-white/60">[[smiles:CCO]]</span>
                          {' '}
                          inside any text/options.
                        </p>
                        {form.structureSmiles && (
                          <div className="mt-3 max-w-xl">
                            <SmilesDiagram smiles={form.structureSmiles} size="lg" />
                          </div>
                        )}
                      </div>

                      {form.subject === 'chemistry' && (
                        <div className="col-span-2">
                          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-5 space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-black tracking-wider text-emerald-200 uppercase">
                                  Chemistry helper
                                </div>
                                <div className="text-xs text-white/55 mt-1">
                                  Use <span className="font-mono text-white/70">{'\\(\\ce{...}\\)'}</span> for equations and SMILES for skeletal structures.
                                  (See <span className="font-mono text-white/60">docs/chemistry-authoring.md</span>)
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void copyToClipboard('\\(\\ce{...}\\)')}
                                  className="bg-white/5 border-white/15 text-white/75 hover:bg-white/10"
                                  title="Copy inline mhchem template"
                                >
                                  Copy inline template
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void copyToClipboard('$$\\ce{...}$$')}
                                  className="bg-white/5 border-white/15 text-white/75 hover:bg-white/10"
                                  title="Copy block mhchem template"
                                >
                                  Copy block template
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2">
                                  Inline example (best for options)
                                </div>
                                <div className="text-white/85 text-sm">
                                  <ScienceText text={'\\(\\ce{N2(g) + 3H2(g) <=> 2NH3(g)}\\)'} />
                                </div>
                                <div className="mt-2 font-mono text-[11px] text-white/50">
                                  {'\\(\\ce{N2(g) + 3H2(g) <=> 2NH3(g)}\\)'}
                                </div>
                              </div>
                              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2">
                                  Net ionic example
                                </div>
                                <div className="text-white/85 text-sm">
                                  <ScienceText text={'\\(\\ce{Ba^2+(aq) + SO4^2-(aq) -> BaSO4(s)}\\)'} />
                                </div>
                                <div className="mt-2 font-mono text-[11px] text-white/50">
                                  {'\\(\\ce{Ba^2+(aq) + SO4^2-(aq) -> BaSO4(s)}\\)'}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 items-center">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  setForm((prev) => ({
                                    ...prev,
                                    stem: `${prev.stem || ''}${prev.stem ? '\n\n' : ''}$$\\ce{ }$$`,
                                  }))
                                }
                                className="bg-white/10 text-white border border-white/10 hover:bg-white/15"
                                title="Appends a block equation placeholder to the stem"
                              >
                                Append equation block to stem
                              </Button>
                              <span className="text-[11px] text-white/45">
                                Structures: use the preset dropdown above Structure SMILES or next to each step’s Diagram SMILES.
                              </span>
                            </div>

                            {chemistryWarnings.length > 0 && (
                              <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-3">
                                <div className="text-xs font-semibold text-amber-200 mb-2">
                                  Authoring warnings ({chemistryWarnings.length})
                                </div>
                                <ul className="list-disc pl-5 space-y-1">
                                  {chemistryWarnings.slice(0, 8).map((w, i) => (
                                    <li key={i} className="text-[11px] text-amber-100/80">
                                      {w}
                                    </li>
                                  ))}
                                </ul>
                                {chemistryWarnings.length > 8 && (
                                  <div className="mt-2 text-[11px] text-amber-100/60">
                                    Showing first 8 warnings.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Graph (one per question) */}
                      <div className="col-span-2">
                        <label className={labelStyle}>Graph (Optional)</label>

                        <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
                          <label className="flex items-center gap-3 text-sm text-white/80 select-none">
                            <input
                              type="checkbox"
                              checked={form.graphEnabled}
                              onChange={(e) => {
                                const enabled = e.target.checked
                                setForm((prev) => ({
                                  ...prev,
                                  graphEnabled: enabled,
                                  graphColor: enabled ? (prev.graphColor || 'white') : prev.graphColor,
                                  graphScaleMode: enabled ? (prev.graphScaleMode || 'equalUnits') : prev.graphScaleMode,
                                  graphSeries:
                                    enabled && (!Array.isArray(prev.graphSeries) || prev.graphSeries.length === 0)
                                      ? [getEmptyGraphSeries('function')]
                                      : prev.graphSeries,
                                }))
                              }}
                              className="h-4 w-4 accent-yellow-400"
                            />
                            Enable graph for this question (one graph per question)
                          </label>

                          {form.graphEnabled && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div>
                                  <label className={labelStyle}>Graph Color</label>
                                  <div className="flex gap-2 flex-wrap mt-2">
                                    {([
                                      { value: 'white', label: 'White' },
                                      { value: 'black', label: 'Black' },
                                    ] as Array<{ value: GraphColor; label: string }>).map((c) => (
                                      <button
                                        key={c.value}
                                        type="button"
                                        onClick={() => setForm({ ...form, graphColor: c.value })}
                                        className={`px-4 py-2 rounded-lg border-2 transition-all ${
                                          form.graphColor === c.value
                                            ? 'border-yellow-400 bg-yellow-400/10'
                                            : 'border-white/20 hover:border-white/40'
                                        }`}
                                      >
                                        <span className="text-sm">{c.label}</span>
                                      </button>
                                    ))}
                                  </div>
                                  <p className="text-xs text-white/40 mt-2">
                                    Graph background is transparent; all plotted series use the shared graph color.
                                  </p>
                                </div>

                                <div>
                                  <label className={labelStyle}>Display Mode</label>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {([
                                      { value: 'standard', label: 'Standard' },
                                      { value: 'aLevelSketch', label: 'A-Level Sketch' },
                                      { value: 'blank', label: 'Blank (no lines)' },
                                    ] as Array<{ value: GraphDisplayMode; label: string }>).map((mode) => (
                                      <button
                                        key={mode.value}
                                        type="button"
                                        onClick={() => setForm({ ...form, graphDisplayMode: mode.value })}
                                        className={`px-4 py-2 rounded-lg border-2 transition-all ${
                                          form.graphDisplayMode === mode.value
                                            ? 'border-yellow-400 bg-yellow-400/10'
                                            : 'border-white/20 hover:border-white/40'
                                        }`}
                                      >
                                        <span className="text-sm">{mode.label}</span>
                                      </button>
                                    ))}
                                  </div>
                                  <p className="text-xs text-white/40 mt-2">
                                    A-Level Sketch hides the grid and border. Blank also removes the x/y axis lines, leaving a clean geometry diagram (best for circles, arcs, and shaded figures).
                                  </p>
                                </div>

                                <div>
                                  <label className={labelStyle}>Scale Mode</label>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {([
                                      { value: 'equalUnits', label: 'Equal Units' },
                                      { value: 'fill', label: 'Fill Box' },
                                    ] as Array<{ value: GraphScaleMode; label: string }>).map((mode) => (
                                      <button
                                        key={mode.value}
                                        type="button"
                                        onClick={() => setForm({ ...form, graphScaleMode: mode.value })}
                                        className={`px-4 py-2 rounded-lg border-2 transition-all ${
                                          form.graphScaleMode === mode.value
                                            ? 'border-yellow-400 bg-yellow-400/10'
                                            : 'border-white/20 hover:border-white/40'
                                        }`}
                                      >
                                        <span className="text-sm">{mode.label}</span>
                                      </button>
                                    ))}
                                  </div>
                                  <p className="text-xs text-white/40 mt-2">
                                    Equal Units keeps circles, slopes, and geometry true to the equation. Fill Box stretches the plot to use the full card.
                                  </p>
                                </div>

                                <div className="flex flex-col justify-end">
                                  <label className={labelStyle}>Graph Series</label>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                                      onClick={() => addGraphSeries('function')}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add Function
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                                      onClick={() => addGraphSeries('points')}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add Points Line
                                    </Button>
                                  </div>
                                  <p className="mt-2 text-xs text-white/40">
                                    Add multiple equations or line/segment series to the same graph.
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-4">
                                {(Array.isArray(form.graphSeries) ? form.graphSeries : []).map((series, index) => (
                                  <div
                                    key={series.id}
                                    className="rounded-xl border border-white/10 bg-black/10 p-4 space-y-4"
                                  >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                      <div>
                                        <div className="text-sm font-semibold text-white/90">
                                          Series {index + 1}
                                        </div>
                                        <p className="text-xs text-white/45">
                                          {series.type === 'function'
                                            ? 'Equation series. Use xStart/xEnd to cap the visible line segment.'
                                            : 'Point series. Points are connected in the order listed.'}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="outline"
                                          className="h-8 w-8 border-white/20 bg-white/5 text-white hover:bg-white/10"
                                          onClick={() => moveGraphSeries(index, -1)}
                                          disabled={index === 0}
                                        >
                                          <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="outline"
                                          className="h-8 w-8 border-white/20 bg-white/5 text-white hover:bg-white/10"
                                          onClick={() => moveGraphSeries(index, 1)}
                                          disabled={index === form.graphSeries.length - 1}
                                        >
                                          <ArrowDown className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="outline"
                                          className="h-8 w-8 border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                                          onClick={() => removeGraphSeries(index)}
                                          disabled={form.graphSeries.length <= 1}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                      <div>
                                        <label className={labelStyle}>Series Type</label>
                                        <Select
                                          value={series.type}
                                          onValueChange={(value: any) =>
                                            updateGraphSeries(index, (current) => ({
                                              ...current,
                                              type: value === 'points' ? 'points' : 'function',
                                            }))
                                          }
                                        >
                                          <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                                          <SelectContent className="bg-gray-900 border-white/10 text-white">
                                            <SelectItem value="function">Function (y = f(x))</SelectItem>
                                            <SelectItem value="points">Points / Line</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 select-none">
                                        <input
                                          type="checkbox"
                                          checked={series.showEndpoints}
                                          onChange={(e) =>
                                            updateGraphSeries(index, (current) => ({
                                              ...current,
                                              showEndpoints: e.target.checked,
                                              showEndpointLabels: e.target.checked ? current.showEndpointLabels : false,
                                            }))
                                          }
                                          className="h-4 w-4 accent-yellow-400"
                                        />
                                        Show endpoint markers
                                      </label>

                                      <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 select-none">
                                        <input
                                          type="checkbox"
                                          checked={series.showEndpointLabels}
                                          onChange={(e) =>
                                            updateGraphSeries(index, (current) => ({
                                              ...current,
                                              showEndpoints: e.target.checked ? true : current.showEndpoints,
                                              showEndpointLabels: e.target.checked,
                                            }))
                                          }
                                          className="h-4 w-4 accent-yellow-400"
                                        />
                                        Show endpoint coordinates
                                      </label>
                                    </div>

                                    {series.type === 'function' ? (
                                      <div className="space-y-4">
                                        <div>
                                          <label className={labelStyle}>Equation</label>
                                          <Input
                                            value={series.equation}
                                            onChange={(e) =>
                                              updateGraphSeries(index, (current) => ({
                                                ...current,
                                                equation: e.target.value,
                                              }))
                                            }
                                            className={glassInput}
                                            placeholder="e.g. x^2 - 4*x + 3, sin(x), 2*x + 5"
                                          />
                                          <p className="text-xs text-white/40 mt-1">
                                            Use x as the variable. Supported: + - * / ^, sin/cos/tan, sqrt, log/ln, exp.
                                          </p>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                          <div>
                                            <label className={labelStyle}>xStart (opt)</label>
                                            <Input
                                              value={series.xStart}
                                              onChange={(e) =>
                                                updateGraphSeries(index, (current) => ({
                                                  ...current,
                                                  xStart: e.target.value,
                                                }))
                                              }
                                              className={glassInput}
                                              placeholder="-4"
                                            />
                                          </div>
                                          <div>
                                            <label className={labelStyle}>xEnd (opt)</label>
                                            <Input
                                              value={series.xEnd}
                                              onChange={(e) =>
                                                updateGraphSeries(index, (current) => ({
                                                  ...current,
                                                  xEnd: e.target.value,
                                                }))
                                              }
                                              className={glassInput}
                                              placeholder="4"
                                            />
                                          </div>
                                        </div>
                                        <p className="text-xs text-white/40">
                                          Set xStart/xEnd to cap this function to a shorter visible segment. Endpoint
                                          markers and labels only appear when the function has a capped range.
                                        </p>
                                      </div>
                                    ) : (
                                      <div>
                                        <label className={labelStyle}>Points (CSV or JSON)</label>
                                        <Textarea
                                          value={series.pointsText}
                                          onChange={(e) =>
                                            updateGraphSeries(index, (current) => ({
                                              ...current,
                                              pointsText: e.target.value,
                                            }))
                                          }
                                          className={`${glassInput} min-h-[120px] font-mono text-xs`}
                                          placeholder={`CSV example:\n0,0\n5,10\n\nJSON example:\n[{\"x\":0,\"y\":0},{\"x\":5,\"y\":10}]`}
                                        />
                                        <p className="text-xs text-white/40 mt-1">
                                          Provide at least 2 points. Two points make a capped straight line segment.
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>

                              <div className="space-y-4">
                                <div className="rounded-xl border border-white/10 bg-black/10 p-4 space-y-4">
                                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                      <div className="text-sm font-semibold text-white/90">Polygons</div>
                                      <p className="text-xs text-white/45">
                                        Closed shapes for triangles or other coordinate-geometry outlines.
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                                      onClick={addGraphPolygon}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add Polygon
                                    </Button>
                                  </div>

                                  {(Array.isArray(form.graphPolygons) ? form.graphPolygons : []).length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/45">
                                      No polygons yet.
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {(Array.isArray(form.graphPolygons) ? form.graphPolygons : []).map((polygon, index) => (
                                        <div
                                          key={polygon.id}
                                          className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
                                        >
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-semibold text-white/85">
                                              Polygon {index + 1}
                                            </div>
                                            <Button
                                              type="button"
                                              size="icon"
                                              variant="outline"
                                              className="h-8 w-8 border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                                              onClick={() => removeGraphPolygon(index)}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                          <div>
                                            <label className={labelStyle}>Points (CSV or JSON)</label>
                                            <Textarea
                                              value={polygon.pointsText}
                                              onChange={(e) =>
                                                updateGraphPolygon(index, (current) => ({
                                                  ...current,
                                                  pointsText: e.target.value,
                                                }))
                                              }
                                              className={`${glassInput} min-h-[110px] font-mono text-xs`}
                                              placeholder={`Triangle example:\n1,3\n5,3\n5,0\n\nJSON example:\n[{\"x\":1,\"y\":3},{\"x\":5,\"y\":3},{\"x\":5,\"y\":0}]`}
                                            />
                                          </div>
                                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                            <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 select-none">
                                              <input
                                                type="checkbox"
                                                checked={polygon.stroke}
                                                onChange={(e) =>
                                                  updateGraphPolygon(index, (current) => ({
                                                    ...current,
                                                    stroke: e.target.checked,
                                                  }))
                                                }
                                                className="h-4 w-4 accent-yellow-400"
                                              />
                                              Stroke outline
                                            </label>
                                            <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 select-none">
                                              <input
                                                type="checkbox"
                                                checked={polygon.fill}
                                                onChange={(e) =>
                                                  updateGraphPolygon(index, (current) => ({
                                                    ...current,
                                                    fill: e.target.checked,
                                                  }))
                                                }
                                                className="h-4 w-4 accent-yellow-400"
                                              />
                                              Light fill
                                            </label>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-xl border border-white/10 bg-black/10 p-4 space-y-4">
                                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                      <div className="text-sm font-semibold text-white/90">Labels</div>
                                      <p className="text-xs text-white/45">
                                        Custom text such as A, B, C, or A(1, 3) anchored to graph coordinates.
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                                      onClick={addGraphLabel}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add Label
                                    </Button>
                                  </div>

                                  {(Array.isArray(form.graphLabels) ? form.graphLabels : []).length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/45">
                                      No custom labels yet.
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {(Array.isArray(form.graphLabels) ? form.graphLabels : []).map((label, index) => (
                                        <div
                                          key={label.id}
                                          className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
                                        >
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-semibold text-white/85">
                                              Label {index + 1}
                                            </div>
                                            <Button
                                              type="button"
                                              size="icon"
                                              variant="outline"
                                              className="h-8 w-8 border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                                              onClick={() => removeGraphLabel(index)}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                                            <div>
                                              <label className={labelStyle}>x</label>
                                              <Input
                                                value={label.x}
                                                onChange={(e) =>
                                                  updateGraphLabel(index, (current) => ({ ...current, x: e.target.value }))
                                                }
                                                className={glassInput}
                                                placeholder="1"
                                              />
                                            </div>
                                            <div>
                                              <label className={labelStyle}>y</label>
                                              <Input
                                                value={label.y}
                                                onChange={(e) =>
                                                  updateGraphLabel(index, (current) => ({ ...current, y: e.target.value }))
                                                }
                                                className={glassInput}
                                                placeholder="3"
                                              />
                                            </div>
                                            <div className="md:col-span-3">
                                              <label className={labelStyle}>Text</label>
                                              <Input
                                                value={label.text}
                                                onChange={(e) =>
                                                  updateGraphLabel(index, (current) => ({
                                                    ...current,
                                                    text: e.target.value,
                                                  }))
                                                }
                                                className={glassInput}
                                                placeholder="A(1, 3)"
                                              />
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                            <div>
                                              <label className={labelStyle}>offsetX (px)</label>
                                              <Input
                                                value={label.offsetX}
                                                onChange={(e) =>
                                                  updateGraphLabel(index, (current) => ({
                                                    ...current,
                                                    offsetX: e.target.value,
                                                  }))
                                                }
                                                className={glassInput}
                                                placeholder="8"
                                              />
                                            </div>
                                            <div>
                                              <label className={labelStyle}>offsetY (px)</label>
                                              <Input
                                                value={label.offsetY}
                                                onChange={(e) =>
                                                  updateGraphLabel(index, (current) => ({
                                                    ...current,
                                                    offsetY: e.target.value,
                                                  }))
                                                }
                                                className={glassInput}
                                                placeholder="-8"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-xl border border-white/10 bg-black/10 p-4 space-y-4">
                                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                      <div className="text-sm font-semibold text-white/90">Angle Markers</div>
                                      <p className="text-xs text-white/45">
                                        Right-angle markers defined by a vertex plus one point on each leg.
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                                      onClick={addGraphAngleMarker}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add Right Angle
                                    </Button>
                                  </div>

                                  {(Array.isArray(form.graphAngleMarkers) ? form.graphAngleMarkers : []).length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/45">
                                      No angle markers yet.
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {(Array.isArray(form.graphAngleMarkers) ? form.graphAngleMarkers : []).map((marker, index) => (
                                        <div
                                          key={marker.id}
                                          className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
                                        >
                                          <div className="flex items-center justify-between gap-3">
                                            <div>
                                              <div className="text-sm font-semibold text-white/85">
                                                Angle Marker {index + 1}
                                              </div>
                                              <div className="text-xs text-white/45">Type: right</div>
                                            </div>
                                            <Button
                                              type="button"
                                              size="icon"
                                              variant="outline"
                                              className="h-8 w-8 border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                                              onClick={() => removeGraphAngleMarker(index)}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                            <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-3">
                                              <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
                                                Vertex
                                              </div>
                                              <div className="grid grid-cols-2 gap-3">
                                                <Input
                                                  value={marker.vertexX}
                                                  onChange={(e) =>
                                                    updateGraphAngleMarker(index, (current) => ({
                                                      ...current,
                                                      vertexX: e.target.value,
                                                    }))
                                                  }
                                                  className={glassInput}
                                                  placeholder="x"
                                                />
                                                <Input
                                                  value={marker.vertexY}
                                                  onChange={(e) =>
                                                    updateGraphAngleMarker(index, (current) => ({
                                                      ...current,
                                                      vertexY: e.target.value,
                                                    }))
                                                  }
                                                  className={glassInput}
                                                  placeholder="y"
                                                />
                                              </div>
                                            </div>
                                            <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-3">
                                              <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
                                                Point On Leg 1
                                              </div>
                                              <div className="grid grid-cols-2 gap-3">
                                                <Input
                                                  value={marker.p1X}
                                                  onChange={(e) =>
                                                    updateGraphAngleMarker(index, (current) => ({
                                                      ...current,
                                                      p1X: e.target.value,
                                                    }))
                                                  }
                                                  className={glassInput}
                                                  placeholder="x"
                                                />
                                                <Input
                                                  value={marker.p1Y}
                                                  onChange={(e) =>
                                                    updateGraphAngleMarker(index, (current) => ({
                                                      ...current,
                                                      p1Y: e.target.value,
                                                    }))
                                                  }
                                                  className={glassInput}
                                                  placeholder="y"
                                                />
                                              </div>
                                            </div>
                                            <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-3">
                                              <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
                                                Point On Leg 2
                                              </div>
                                              <div className="grid grid-cols-2 gap-3">
                                                <Input
                                                  value={marker.p2X}
                                                  onChange={(e) =>
                                                    updateGraphAngleMarker(index, (current) => ({
                                                      ...current,
                                                      p2X: e.target.value,
                                                    }))
                                                  }
                                                  className={glassInput}
                                                  placeholder="x"
                                                />
                                                <Input
                                                  value={marker.p2Y}
                                                  onChange={(e) =>
                                                    updateGraphAngleMarker(index, (current) => ({
                                                      ...current,
                                                      p2Y: e.target.value,
                                                    }))
                                                  }
                                                  className={glassInput}
                                                  placeholder="y"
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-xl border border-white/10 bg-black/10 p-4 space-y-4">
                                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                      <div className="text-sm font-semibold text-white/90">Circles</div>
                                      <p className="text-xs text-white/45">
                                        Full circles by center and radius. Use the Blank display mode to drop the axes.
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                                      onClick={addGraphCircle}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add Circle
                                    </Button>
                                  </div>

                                  {(Array.isArray(form.graphCircles) ? form.graphCircles : []).length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/45">
                                      No circles yet.
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {(Array.isArray(form.graphCircles) ? form.graphCircles : []).map((circle, index) => (
                                        <div
                                          key={circle.id}
                                          className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
                                        >
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-semibold text-white/85">
                                              Circle {index + 1}
                                            </div>
                                            <Button
                                              type="button"
                                              size="icon"
                                              variant="outline"
                                              className="h-8 w-8 border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                                              onClick={() => removeGraphCircle(index)}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                            <div>
                                              <label className={labelStyle}>Center X</label>
                                              <Input
                                                value={circle.centerX}
                                                onChange={(e) =>
                                                  updateGraphCircle(index, (current) => ({
                                                    ...current,
                                                    centerX: e.target.value,
                                                  }))
                                                }
                                                className={glassInput}
                                                placeholder="0"
                                              />
                                            </div>
                                            <div>
                                              <label className={labelStyle}>Center Y</label>
                                              <Input
                                                value={circle.centerY}
                                                onChange={(e) =>
                                                  updateGraphCircle(index, (current) => ({
                                                    ...current,
                                                    centerY: e.target.value,
                                                  }))
                                                }
                                                className={glassInput}
                                                placeholder="0"
                                              />
                                            </div>
                                            <div>
                                              <label className={labelStyle}>Radius</label>
                                              <Input
                                                value={circle.radius}
                                                onChange={(e) =>
                                                  updateGraphCircle(index, (current) => ({
                                                    ...current,
                                                    radius: e.target.value,
                                                  }))
                                                }
                                                className={glassInput}
                                                placeholder="5"
                                              />
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                            <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 select-none">
                                              <input
                                                type="checkbox"
                                                checked={circle.stroke}
                                                onChange={(e) =>
                                                  updateGraphCircle(index, (current) => ({
                                                    ...current,
                                                    stroke: e.target.checked,
                                                  }))
                                                }
                                                className="h-4 w-4 accent-yellow-400"
                                              />
                                              Stroke outline
                                            </label>
                                            <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 select-none">
                                              <input
                                                type="checkbox"
                                                checked={circle.fill}
                                                onChange={(e) =>
                                                  updateGraphCircle(index, (current) => ({
                                                    ...current,
                                                    fill: e.target.checked,
                                                  }))
                                                }
                                                className="h-4 w-4 accent-yellow-400"
                                              />
                                              Light fill
                                            </label>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-xl border border-white/10 bg-black/10 p-4 space-y-4">
                                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                      <div className="text-sm font-semibold text-white/90">Arcs &amp; Shaded Areas</div>
                                      <p className="text-xs text-white/45">
                                        Arc by center, radius, and start/end angles (degrees, counter-clockwise). Fill a segment (chord) or sector (pie slice) for shaded areas.
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                                      onClick={addGraphArc}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add Arc
                                    </Button>
                                  </div>

                                  {(Array.isArray(form.graphArcs) ? form.graphArcs : []).length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/45">
                                      No arcs yet.
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {(Array.isArray(form.graphArcs) ? form.graphArcs : []).map((arc, index) => (
                                        <div
                                          key={arc.id}
                                          className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
                                        >
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-semibold text-white/85">
                                              Arc {index + 1}
                                            </div>
                                            <Button
                                              type="button"
                                              size="icon"
                                              variant="outline"
                                              className="h-8 w-8 border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                                              onClick={() => removeGraphArc(index)}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                            <div>
                                              <label className={labelStyle}>Center X</label>
                                              <Input
                                                value={arc.centerX}
                                                onChange={(e) =>
                                                  updateGraphArc(index, (current) => ({
                                                    ...current,
                                                    centerX: e.target.value,
                                                  }))
                                                }
                                                className={glassInput}
                                                placeholder="0"
                                              />
                                            </div>
                                            <div>
                                              <label className={labelStyle}>Center Y</label>
                                              <Input
                                                value={arc.centerY}
                                                onChange={(e) =>
                                                  updateGraphArc(index, (current) => ({
                                                    ...current,
                                                    centerY: e.target.value,
                                                  }))
                                                }
                                                className={glassInput}
                                                placeholder="0"
                                              />
                                            </div>
                                            <div>
                                              <label className={labelStyle}>Radius</label>
                                              <Input
                                                value={arc.radius}
                                                onChange={(e) =>
                                                  updateGraphArc(index, (current) => ({
                                                    ...current,
                                                    radius: e.target.value,
                                                  }))
                                                }
                                                className={glassInput}
                                                placeholder="5"
                                              />
                                            </div>
                                            <div>
                                              <label className={labelStyle}>Start Angle (deg)</label>
                                              <Input
                                                value={arc.startAngle}
                                                onChange={(e) =>
                                                  updateGraphArc(index, (current) => ({
                                                    ...current,
                                                    startAngle: e.target.value,
                                                  }))
                                                }
                                                className={glassInput}
                                                placeholder="0"
                                              />
                                            </div>
                                            <div>
                                              <label className={labelStyle}>End Angle (deg)</label>
                                              <Input
                                                value={arc.endAngle}
                                                onChange={(e) =>
                                                  updateGraphArc(index, (current) => ({
                                                    ...current,
                                                    endAngle: e.target.value,
                                                  }))
                                                }
                                                className={glassInput}
                                                placeholder="180"
                                              />
                                            </div>
                                          </div>
                                          <div>
                                            <label className={labelStyle}>Fill</label>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                              {([
                                                { value: 'none', label: 'None' },
                                                { value: 'segment', label: 'Segment (chord)' },
                                                { value: 'sector', label: 'Sector (pie)' },
                                              ] as Array<{ value: GraphArcFill; label: string }>).map((option) => (
                                                <button
                                                  key={option.value}
                                                  type="button"
                                                  onClick={() =>
                                                    updateGraphArc(index, (current) => ({
                                                      ...current,
                                                      fill: option.value,
                                                    }))
                                                  }
                                                  className={`px-3 py-1.5 rounded-lg border-2 text-sm transition-all ${
                                                    arc.fill === option.value
                                                      ? 'border-yellow-400 bg-yellow-400/10'
                                                      : 'border-white/20 hover:border-white/40'
                                                  }`}
                                                >
                                                  {option.label}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                          <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 select-none">
                                            <input
                                              type="checkbox"
                                              checked={arc.stroke}
                                              onChange={(e) =>
                                                updateGraphArc(index, (current) => ({
                                                  ...current,
                                                  stroke: e.target.checked,
                                                }))
                                              }
                                              className="h-4 w-4 accent-yellow-400"
                                            />
                                            Stroke outline
                                          </label>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-xl border border-white/10 bg-black/10 p-4 space-y-4">
                                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                      <div className="text-sm font-semibold text-white/90">Line Segments</div>
                                      <p className="text-xs text-white/45">
                                        Straight lines such as radii or chords, from one point to another.
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                                      onClick={addGraphSegment}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add Segment
                                    </Button>
                                  </div>

                                  {(Array.isArray(form.graphSegments) ? form.graphSegments : []).length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/45">
                                      No segments yet.
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {(Array.isArray(form.graphSegments) ? form.graphSegments : []).map((segment, index) => (
                                        <div
                                          key={segment.id}
                                          className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
                                        >
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-semibold text-white/85">
                                              Segment {index + 1}
                                            </div>
                                            <Button
                                              type="button"
                                              size="icon"
                                              variant="outline"
                                              className="h-8 w-8 border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                                              onClick={() => removeGraphSegment(index)}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                            <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-3">
                                              <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
                                                From
                                              </div>
                                              <div className="grid grid-cols-2 gap-3">
                                                <Input
                                                  value={segment.fromX}
                                                  onChange={(e) =>
                                                    updateGraphSegment(index, (current) => ({
                                                      ...current,
                                                      fromX: e.target.value,
                                                    }))
                                                  }
                                                  className={glassInput}
                                                  placeholder="x"
                                                />
                                                <Input
                                                  value={segment.fromY}
                                                  onChange={(e) =>
                                                    updateGraphSegment(index, (current) => ({
                                                      ...current,
                                                      fromY: e.target.value,
                                                    }))
                                                  }
                                                  className={glassInput}
                                                  placeholder="y"
                                                />
                                              </div>
                                            </div>
                                            <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-3">
                                              <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
                                                To
                                              </div>
                                              <div className="grid grid-cols-2 gap-3">
                                                <Input
                                                  value={segment.toX}
                                                  onChange={(e) =>
                                                    updateGraphSegment(index, (current) => ({
                                                      ...current,
                                                      toX: e.target.value,
                                                    }))
                                                  }
                                                  className={glassInput}
                                                  placeholder="x"
                                                />
                                                <Input
                                                  value={segment.toY}
                                                  onChange={(e) =>
                                                    updateGraphSegment(index, (current) => ({
                                                      ...current,
                                                      toY: e.target.value,
                                                    }))
                                                  }
                                                  className={glassInput}
                                                  placeholder="y"
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                  <label className={labelStyle}>xMin (opt)</label>
                                  <Input
                                    value={form.graphXMin}
                                    onChange={(e) => setForm({ ...form, graphXMin: e.target.value })}
                                    className={glassInput}
                                    placeholder="-10"
                                  />
                                </div>
                                <div>
                                  <label className={labelStyle}>xMax (opt)</label>
                                  <Input
                                    value={form.graphXMax}
                                    onChange={(e) => setForm({ ...form, graphXMax: e.target.value })}
                                    className={glassInput}
                                    placeholder="10"
                                  />
                                </div>
                                <div>
                                  <label className={labelStyle}>yMin (opt)</label>
                                  <Input
                                    value={form.graphYMin}
                                    onChange={(e) => setForm({ ...form, graphYMin: e.target.value })}
                                    className={glassInput}
                                    placeholder=""
                                  />
                                </div>
                                <div>
                                  <label className={labelStyle}>yMax (opt)</label>
                                  <Input
                                    value={form.graphYMax}
                                    onChange={(e) => setForm({ ...form, graphYMax: e.target.value })}
                                    className={glassInput}
                                    placeholder=""
                                  />
                                </div>
                              </div>

                              <div>
                                <label className={labelStyle}>Preview</label>
                                <div className="mt-2">
                                  <QuestionGraph graph={buildGraphConfigFromForm(form)} />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Steps */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b-2 border-white/20 pb-3">
                      <div>
                        <h3 className="text-xl font-bold text-white/90 flex items-center gap-3 mb-1">
                          <div className="w-2 h-6 bg-gradient-to-b from-primary to-secondary rounded-full"></div>
                          Question Steps
                        </h3>
                        <p className="text-sm text-white/50 ml-5">Create multi-step questions with different types</p>
                      </div>
                      <Button
                        onClick={handleAddStep}
                        size="sm"
                        className="bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-white font-semibold shadow-lg"
                      >
                        <Plus className="w-4 h-4 mr-2" /> Add Step
                      </Button>
                    </div>

                    <div className="space-y-6">
                      {form.steps.map((step, index) => (
                        <div key={index} className="bg-gradient-to-br from-white/5 to-white/[0.02] border-2 border-white/10 rounded-2xl p-6 relative group hover:border-primary/30 transition-all shadow-lg">
                          {/* Step Header with Controls */}
                          <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/50">
                                <span className="text-primary font-bold text-lg">{index + 1}</span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-0 font-semibold">STEP {index + 1}</Badge>
                                  <Badge className={step.type === 'true_false' 
                                    ? 'bg-green-500/20 text-green-400 border-green-500/50' 
                                    : 'bg-blue-500/20 text-blue-400 border-blue-500/50'}>
                                    {step.type === 'true_false' ? '✓ True/False' : '✓ MCQ'}
                                  </Badge>
                                  {step.marks > 0 && (
                                    <Badge className="bg-amber-500/20 text-amber-300 border-0">
                                      {step.marks} mark{step.marks !== 1 ? 's' : ''}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Select 
                                value={step.type} 
                                onValueChange={(v: 'mcq' | 'true_false') => updateStepField(index, 'type', v)}
                              >
                                <SelectTrigger className="w-32 h-8 bg-white/5 border-white/10 text-white text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-900 border-white/10 text-white">
                                  <SelectItem value="mcq">MCQ</SelectItem>
                                  <SelectItem value="true_false">True/False</SelectItem>
                                </SelectContent>
                              </Select>
                              <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-white/70 hover:bg-white/10" onClick={() => handleMoveStepUp(index)} disabled={index === 0} title="Move up"><ArrowUp className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-white/70 hover:bg-white/10" onClick={() => handleMoveStepDown(index)} disabled={index === form.steps.length - 1} title="Move down"><ArrowDown className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:bg-red-500/20" onClick={() => handleDeleteStep(index)} disabled={form.steps.length <= 1} title="Delete step"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className={labelStyle}>Step Title</label>
                              <Input
                                value={step.title}
                                onChange={e => updateStepField(index, 'title', e.target.value)}
                                className={glassInput}
                              />
                            </div>
                            <div>
                              <label className={labelStyle}>Prompt</label>
                              <Textarea
                                value={step.prompt}
                                onChange={e => updateStepField(index, 'prompt', e.target.value)}
                                className={`${glassInput} min-h-[80px]`}
                              />
                              {needsSciencePreview(step.prompt) && (
                                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                                  <div className="text-[10px] uppercase tracking-wider text-white/45 mb-1">
                                    Preview
                                  </div>
                                  <div className="text-white/85 text-sm">
                                    <ScienceText text={step.prompt} />
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className={labelStyle}>Diagram SMILES (Optional)</label>
                                {form.subject === 'chemistry' && (
                                  <div className="flex flex-wrap items-center gap-2 mt-1 mb-2">
                                    <span className="text-xs text-white/45">Preset:</span>
                                    <SmilesPresetSelect
                                      key={`step-${index}-${stepDiagramPresetNonce[index] ?? 0}`}
                                      onPick={(smiles) => {
                                        updateStepField(index, 'diagramSmiles', smiles);
                                        setStepDiagramPresetNonce((prev) => ({
                                          ...prev,
                                          [index]: (prev[index] ?? 0) + 1,
                                        }));
                                      }}
                                    />
                                  </div>
                                )}
                                <Input
                                  value={step.diagramSmiles}
                                  onChange={e => updateStepField(index, 'diagramSmiles', e.target.value)}
                                  className={glassInput}
                                  placeholder="e.g. c1ccccc1 or CCO"
                                />
                                {step.diagramSmiles && (
                                  <div className="mt-3">
                                    <SmilesDiagram smiles={step.diagramSmiles} size="md" />
                                  </div>
                                )}
                              </div>

                              <div>
                                <label className={labelStyle}>Diagram Image URL (Optional)</label>
                                <Input
                                  value={step.diagramImageUrl}
                                  onChange={e => updateStepField(index, 'diagramImageUrl', e.target.value)}
                                  className={glassInput}
                                  placeholder="https://..."
                                />
                                <div className="mt-2 grid gap-2">
                                  <Input
                                    type="file"
                                    accept="image/*"
                                    className={fileInput}
                                    disabled={!!uploadingStepImages[index]}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] ?? null;
                                      e.currentTarget.value = '';
                                      void handleStepImageUpload(index, file);
                                    }}
                                  />
                                  <div className="text-xs text-white/40 flex items-center gap-2">
                                    {uploadingStepImages[index] && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    <span>Uploads to storage (max 5 MB).</span>
                                  </div>
                                </div>
                                {step.diagramImageUrl && (
                                  <img
                                    src={step.diagramImageUrl}
                                    alt="Diagram preview"
                                    className="mt-3 rounded-lg max-w-full border border-white/10"
                                    loading="lazy"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none'
                                    }}
                                  />
                                )}
                              </div>
                            </div>

                            <div className={`grid gap-4 bg-gradient-to-br from-black/30 to-black/10 p-5 rounded-xl border-2 ${step.type === 'true_false' ? 'grid-cols-2 border-green-500/20' : 'grid-cols-2 border-blue-500/20'}`}>
                              {(step.type === 'true_false'
                                ? [0, 1]
                                : Array.from({ length: step.options.length }, (_, i) => i)
                              ).map((optIdx) => (
                                <div key={optIdx} className={`p-3 rounded-lg border-2 transition-all ${
                                  step.correctAnswer === optIdx
                                    ? 'bg-green-500/20 border-green-500/50'
                                    : 'bg-white/5 border-white/10 hover:border-white/20'
                                }`}>
                                  <label className="text-xs text-white/70 mb-2 block uppercase tracking-wider font-semibold">
                                    Option {String.fromCharCode(65 + optIdx)}
                                    {step.type === 'true_false' && optIdx === 0 && ' (True)'}
                                    {step.type === 'true_false' && optIdx === 1 && ' (False)'}
                                    {step.correctAnswer === optIdx && (
                                      <span className="ml-2 text-green-400">✓ Correct</span>
                                    )}
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                                      step.correctAnswer === optIdx 
                                        ? 'bg-green-500 text-black shadow-lg shadow-green-500/50' 
                                        : 'bg-white/10 text-white/70'
                                    }`}>
                                      {String.fromCharCode(65 + optIdx)}
                                    </div>
                                    <Input
                                      value={step.options[optIdx] || ''}
                                      onChange={e => updateStepOption(index, optIdx, e.target.value)}
                                      className={`${glassInput} h-10 text-sm flex-1`}
                                      placeholder={step.type === 'true_false' && optIdx === 0 ? 'True' : step.type === 'true_false' && optIdx === 1 ? 'False' : `Option ${String.fromCharCode(65 + optIdx)}`}
                                    />
                                  </div>
                                  {needsSciencePreview(step.options[optIdx] || '') && (
                                    <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-2">
                                      <div className="text-[10px] uppercase tracking-wider text-white/45 mb-1">
                                        Preview
                                      </div>
                                      <div className="text-white/85 text-sm">
                                        <ScienceText text={step.options[optIdx] || ''} smilesSize="sm" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {step.type === 'mcq' && (
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-xs text-white/50 font-mono">
                                  Options: {step.options.length} (min 2, max 6)
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="bg-white/10 text-white border border-white/10 hover:bg-white/15"
                                    onClick={() => handleRemoveStepOption(index)}
                                    disabled={step.options.length <= 2}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" /> Remove Option
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="bg-white/10 text-white border border-white/10 hover:bg-white/15"
                                    onClick={() => handleAddStepOption(index)}
                                    disabled={step.options.length >= 6}
                                  >
                                    <Plus className="w-4 h-4 mr-2" /> Add Option
                                  </Button>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <label className={labelStyle}>Correct Answer</label>
                                <Select value={step.correctAnswer.toString()} onValueChange={(v) => updateStepField(index, 'correctAnswer', parseInt(v))}>
                                  <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                                  <SelectContent className="bg-gray-900 border-white/10 text-white">
                                    {(step.type === 'true_false'
                                      ? [0, 1]
                                      : Array.from({ length: step.options.length }, (_, i) => i)
                                    ).map((optIdx) => (
                                      <SelectItem key={optIdx} value={optIdx.toString()}>
                                        Option {String.fromCharCode(65 + optIdx)}
                                        {step.type === 'true_false' && optIdx === 0 ? ' (True)' : ''}
                                        {step.type === 'true_false' && optIdx === 1 ? ' (False)' : ''}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label className={labelStyle}>Move correct to</label>
                                <Select
                                  value={step.correctAnswer.toString()}
                                  onValueChange={(v) => handleMoveCorrectStepOption(index, parseInt(v))}
                                >
                                  <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                                  <SelectContent className="bg-gray-900 border-white/10 text-white">
                                    {(step.type === 'true_false'
                                      ? [0, 1]
                                      : Array.from({ length: step.options.length }, (_, i) => i)
                                    ).map((optIdx) => (
                                      <SelectItem key={optIdx} value={optIdx.toString()}>
                                        Option {String.fromCharCode(65 + optIdx)}
                                        {step.type === 'true_false' && optIdx === 0 ? ' (True)' : ''}
                                        {step.type === 'true_false' && optIdx === 1 ? ' (False)' : ''}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label className={labelStyle}>Marks</label>
                                <Input type="number" value={step.marks} onChange={e => updateStepField(index, 'marks', parseInt(e.target.value) || 1)} className={glassInput} />
                              </div>
                              <div>
                                <label className={labelStyle}>Time (s)</label>
                                <Input type="number" value={step.timeLimitSeconds ?? ''} onChange={e => updateStepField(index, 'timeLimitSeconds', e.target.value ? parseInt(e.target.value) : null)} className={glassInput} placeholder="15" />
                              </div>
                            </div>

                            <div>
                              <label className={labelStyle}>Explanation</label>
                              <Textarea
                                value={step.explanation}
                                onChange={e => updateStepField(index, 'explanation', e.target.value)}
                                className={`${glassInput} h-20 text-sm`}
                                placeholder="Explain why the answer is correct..."
                              />
                              {needsSciencePreview(step.explanation) && (
                                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                                  <div className="text-[10px] uppercase tracking-wider text-white/45 mb-1">
                                    Preview
                                  </div>
                                  <div className="text-white/85 text-sm">
                                    <ScienceText text={step.explanation} />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Sub-steps */}
                            <div className="mt-2 rounded-xl border-2 border-purple-500/20 bg-purple-500/5 p-5 space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-purple-500/20 text-purple-300 border-0 font-semibold">SUB-STEPS</Badge>
                                  <Badge className="bg-white/10 text-white/70 border-0">
                                    {step.subSteps?.length || 0}
                                  </Badge>
                                  <span className="text-xs text-white/50 hidden md:inline">
                                    All sub-steps must be correct to earn this step&apos;s marks.
                                  </span>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  className={`bg-white/10 text-white border border-white/10 ${form.steps.length < 2 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/15'}`}
                                  onClick={() => handleAddSubStep(index)}
                                  disabled={form.steps.length < 2}
                                >
                                  <Plus className="w-4 h-4 mr-2" /> Add Sub-step
                                </Button>
                              </div>

                              {form.steps.length < 2 && (
                                <p className="text-xs text-yellow-100/70">
                                  Add a second step to enable sub-steps (multi-step questions only).
                                </p>
                              )}

                              {(!step.subSteps || step.subSteps.length === 0) ? (
                                <p className="text-xs text-white/50">
                                  No sub-steps yet. Add quick mini-questions that must be answered after the main step.
                                </p>
                              ) : (
                                <div className="space-y-4">
                                  {step.subSteps.map((sub, subIdx) => (
                                    <div
                                      key={subIdx}
                                      className="bg-black/30 border border-white/10 rounded-xl p-4 hover:border-purple-500/30 transition-colors"
                                    >
                                      <div className="flex items-center justify-between gap-3 mb-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Badge className="bg-purple-500/20 text-purple-300 border-0 font-semibold">
                                            Sub-step {subIdx + 1}
                                          </Badge>
                                          <Badge className={sub.type === 'true_false'
                                            ? 'bg-green-500/20 text-green-400 border-green-500/50'
                                            : 'bg-blue-500/20 text-blue-400 border-blue-500/50'}>
                                            {sub.type === 'true_false' ? '✓ True/False' : '✓ MCQ'}
                                          </Badge>
                                          <Badge className="bg-white/10 text-white/70 border-0">
                                            {(sub.timeLimitSeconds ?? 15)}s
                                          </Badge>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <Select
                                            value={sub.type}
                                            onValueChange={(v: 'mcq' | 'true_false') => updateSubStepField(index, subIdx, 'type', v)}
                                          >
                                            <SelectTrigger className="w-32 h-8 bg-white/5 border-white/10 text-white text-xs">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-gray-900 border-white/10 text-white">
                                              <SelectItem value="mcq">MCQ</SelectItem>
                                              <SelectItem value="true_false">True/False</SelectItem>
                                            </SelectContent>
                                          </Select>

                                          <div className="flex gap-1">
                                            <Button
                                              type="button"
                                              size="icon"
                                              variant="ghost"
                                              className="h-8 w-8 text-white/70 hover:bg-white/10"
                                              onClick={() => handleMoveSubStepUp(index, subIdx)}
                                              disabled={subIdx === 0}
                                              title="Move up"
                                            >
                                              <ArrowUp className="w-4 h-4" />
                                            </Button>
                                            <Button
                                              type="button"
                                              size="icon"
                                              variant="ghost"
                                              className="h-8 w-8 text-white/70 hover:bg-white/10"
                                              onClick={() => handleMoveSubStepDown(index, subIdx)}
                                              disabled={subIdx === (step.subSteps.length - 1)}
                                              title="Move down"
                                            >
                                              <ArrowDown className="w-4 h-4" />
                                            </Button>
                                            <Button
                                              type="button"
                                              size="icon"
                                              variant="ghost"
                                              className="h-8 w-8 text-red-400 hover:bg-red-500/20"
                                              onClick={() => handleDeleteSubStep(index, subIdx)}
                                              title="Delete sub-step"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 gap-4">
                                        <div>
                                          <label className={labelStyle}>Prompt</label>
                                          <Textarea
                                            value={sub.prompt}
                                            onChange={(e) => updateSubStepField(index, subIdx, 'prompt', e.target.value)}
                                            className={`${glassInput} min-h-[70px]`}
                                            placeholder="Mini question prompt..."
                                          />
                                          {needsSciencePreview(sub.prompt) && (
                                            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                                              <div className="text-[10px] uppercase tracking-wider text-white/45 mb-1">
                                                Preview
                                              </div>
                                              <div className="text-white/85 text-sm">
                                                <ScienceText text={sub.prompt} />
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        <div className={`grid gap-4 bg-gradient-to-br from-black/30 to-black/10 p-4 rounded-xl border-2 ${sub.type === 'true_false' ? 'grid-cols-2 border-green-500/20' : 'grid-cols-2 border-blue-500/20'}`}>
                                          {(sub.type === 'true_false'
                                            ? [0, 1]
                                            : Array.from({ length: sub.options.length }, (_, i) => i)
                                          ).map((optIdx) => (
                                            <div key={optIdx} className={`p-3 rounded-lg border-2 transition-all ${
                                              sub.correctAnswer === optIdx
                                                ? 'bg-green-500/20 border-green-500/50'
                                                : 'bg-white/5 border-white/10 hover:border-white/20'
                                            }`}>
                                              <label className="text-xs text-white/70 mb-2 block uppercase tracking-wider font-semibold">
                                                Option {String.fromCharCode(65 + optIdx)}
                                                {sub.type === 'true_false' && optIdx === 0 && ' (True)'}
                                                {sub.type === 'true_false' && optIdx === 1 && ' (False)'}
                                                {sub.correctAnswer === optIdx && (
                                                  <span className="ml-2 text-green-400">✓ Correct</span>
                                                )}
                                              </label>
                                              <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                                                  sub.correctAnswer === optIdx
                                                    ? 'bg-green-500 text-black shadow-lg shadow-green-500/50'
                                                    : 'bg-white/10 text-white/70'
                                                }`}>
                                                  {String.fromCharCode(65 + optIdx)}
                                                </div>
                                                <Input
                                                  value={sub.options[optIdx] || ''}
                                                  onChange={e => updateSubStepOption(index, subIdx, optIdx, e.target.value)}
                                                  className={`${glassInput} h-10 text-sm flex-1`}
                                                  placeholder={sub.type === 'true_false' && optIdx === 0 ? 'True' : sub.type === 'true_false' && optIdx === 1 ? 'False' : `Option ${String.fromCharCode(65 + optIdx)}`}
                                                />
                                              </div>
                                              {needsSciencePreview(sub.options[optIdx] || '') && (
                                                <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-2">
                                                  <div className="text-[10px] uppercase tracking-wider text-white/45 mb-1">
                                                    Preview
                                                  </div>
                                                  <div className="text-white/85 text-sm">
                                                    <ScienceText text={sub.options[optIdx] || ''} smilesSize="sm" />
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>

                                        {sub.type === 'mcq' && (
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="text-xs text-white/50 font-mono">
                                              Options: {sub.options.length} (min 2, max 6)
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="secondary"
                                                className="bg-white/10 text-white border border-white/10 hover:bg-white/15"
                                                onClick={() => handleRemoveSubStepOption(index, subIdx)}
                                                disabled={sub.options.length <= 2}
                                              >
                                                <Trash2 className="w-4 h-4 mr-2" /> Remove Option
                                              </Button>
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="secondary"
                                                className="bg-white/10 text-white border border-white/10 hover:bg-white/15"
                                                onClick={() => handleAddSubStepOption(index, subIdx)}
                                                disabled={sub.options.length >= 6}
                                              >
                                                <Plus className="w-4 h-4 mr-2" /> Add Option
                                              </Button>
                                            </div>
                                          </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                          <div>
                                            <label className={labelStyle}>Correct Answer</label>
                                            <Select
                                              value={sub.correctAnswer.toString()}
                                              onValueChange={(v) => updateSubStepField(index, subIdx, 'correctAnswer', parseInt(v))}
                                            >
                                              <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                                              <SelectContent className="bg-gray-900 border-white/10 text-white">
                                                {(sub.type === 'true_false'
                                                  ? [0, 1]
                                                  : Array.from({ length: sub.options.length }, (_, i) => i)
                                                ).map((optIdx) => (
                                                  <SelectItem key={optIdx} value={optIdx.toString()}>
                                                    Option {String.fromCharCode(65 + optIdx)}
                                                    {sub.type === 'true_false' && optIdx === 0 ? ' (True)' : ''}
                                                    {sub.type === 'true_false' && optIdx === 1 ? ' (False)' : ''}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div>
                                            <label className={labelStyle}>Move correct to</label>
                                            <Select
                                              value={sub.correctAnswer.toString()}
                                              onValueChange={(v) => handleMoveCorrectSubStepOption(index, subIdx, parseInt(v))}
                                            >
                                              <SelectTrigger className={glassInput}><SelectValue /></SelectTrigger>
                                              <SelectContent className="bg-gray-900 border-white/10 text-white">
                                                {(sub.type === 'true_false'
                                                  ? [0, 1]
                                                  : Array.from({ length: sub.options.length }, (_, i) => i)
                                                ).map((optIdx) => (
                                                  <SelectItem key={optIdx} value={optIdx.toString()}>
                                                    Option {String.fromCharCode(65 + optIdx)}
                                                    {sub.type === 'true_false' && optIdx === 0 ? ' (True)' : ''}
                                                    {sub.type === 'true_false' && optIdx === 1 ? ' (False)' : ''}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div>
                                            <label className={labelStyle}>Time (s)</label>
                                            <Input
                                              type="number"
                                              value={sub.timeLimitSeconds ?? ''}
                                              onChange={e => updateSubStepField(index, subIdx, 'timeLimitSeconds', e.target.value ? parseInt(e.target.value) : null)}
                                              className={glassInput}
                                              placeholder="5"
                                            />
                                          </div>
                                        </div>

                                        <div>
                                          <label className={labelStyle}>Explanation</label>
                                          <Textarea
                                            value={sub.explanation}
                                            onChange={(e) => updateSubStepField(index, subIdx, 'explanation', e.target.value)}
                                            className={`${glassInput} h-20 text-sm`}
                                            placeholder="Explain why the answer is correct..."
                                          />
                                          {needsSciencePreview(sub.explanation) && (
                                            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                                              <div className="text-[10px] uppercase tracking-wider text-white/45 mb-1">
                                                Preview
                                              </div>
                                              <div className="text-white/85 text-sm">
                                                <ScienceText text={sub.explanation} />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  </div>

                  {/* Preview Panel */}
                  {showPreview && (
                    <div className="w-1/2 border-l border-slate-200 bg-white text-slate-900 overflow-y-auto p-6 custom-scrollbar">
                      <div className="sticky top-0 bg-white pb-4 mb-4 border-b border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <Eye className="w-5 h-5 text-primary" />
                          Question Preview
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">How this question will appear to students</p>
                      </div>

                      <Tabs defaultValue="quick" className="space-y-4">
                        <TabsList className="bg-slate-100 border border-slate-200">
                          <TabsTrigger value="quick">Quick Preview</TabsTrigger>
                          <TabsTrigger value="game">In-game Preview</TabsTrigger>
                        </TabsList>

                        <TabsContent value="quick" className="space-y-6">
                          {/* Question Header */}
                          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={`${form.subject === 'math' ? 'bg-blue-100 text-blue-700' :
                                  form.subject === 'physics' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                                } border-0`}>
                                {form.subject}
                              </Badge>
                              <Badge className="bg-slate-100 text-slate-700 border-0">{form.level}</Badge>
                              <Badge className={`border-0 ${form.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                                  form.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                                }`}>
                                {form.difficulty}
                              </Badge>
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 mb-2">{form.title || 'Untitled Question'}</h2>
                            <p className="text-sm text-slate-500">{form.chapter}</p>
                          </div>

                          {/* Stem */}
                          {form.stem && (
                            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                              {form.imageUrl && (
                                <div className="mb-4 flex justify-center">
                                  <img src={form.imageUrl} alt="Question" className="rounded-lg max-w-full border border-slate-200" />
                                </div>
                              )}
                              <p className="text-slate-800">
                                <ScienceText text={form.stem} />
                              </p>
                              {form.structureSmiles && (
                                <div className="mt-4 flex justify-center max-w-xl">
                                  <SmilesDiagram smiles={form.structureSmiles} size="lg" />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Steps Preview */}
                          <div className="space-y-4">
                            {form.steps.map((step, idx) => (
                              <div key={idx} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                  <Badge className="bg-primary/10 text-primary border-0">Step {idx + 1}</Badge>
                                  <Badge className={step.type === 'true_false' 
                                    ? 'bg-green-100 text-green-700 border-green-200' 
                                    : 'bg-blue-100 text-blue-700 border-blue-200'}>
                                    {step.type === 'true_false' ? 'True/False' : 'MCQ'}
                                  </Badge>
                                  {step.marks > 0 && (
                                    <Badge className="bg-amber-100 text-amber-700 border-0">{step.marks} mark{step.marks !== 1 ? 's' : ''}</Badge>
                                  )}
                                </div>

                                {(step.diagramSmiles || step.diagramImageUrl) && (
                                  <div className="mb-4 flex flex-col items-center gap-3">
                                    {step.diagramSmiles && (
                                      <SmilesDiagram smiles={step.diagramSmiles} size="md" />
                                    )}
                                    {step.diagramImageUrl && (
                                      <img
                                        src={step.diagramImageUrl}
                                        alt="Diagram"
                                        className="rounded-lg max-w-full border border-slate-200"
                                        loading="lazy"
                                      />
                                    )}
                                  </div>
                                )}

                                <h3 className="text-slate-900 font-semibold mb-2">{step.title || `Step ${idx + 1}`}</h3>
                                <p className="text-slate-700 mb-4">
                                  <ScienceText text={step.prompt || 'No prompt provided'} />
                                </p>
                                
                                <div className="space-y-2">
                                  {(step.type === 'true_false'
                                    ? [0, 1]
                                    : step.options
                                        .map((opt, i) => (String(opt ?? '').trim() ? i : null))
                                        .filter((i): i is number => i !== null)
                                  ).map((optIdx) => (
                                    <div
                                      key={optIdx}
                                      className={`p-3 rounded-lg border-2 transition-all ${
                                        step.correctAnswer === optIdx
                                          ? 'bg-green-100 border-green-200'
                                          : 'bg-slate-50 border-slate-200'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                          step.correctAnswer === optIdx
                                            ? 'bg-green-600 text-white'
                                            : 'bg-slate-100 text-slate-600'
                                        }`}>
                                          {String.fromCharCode(65 + optIdx)}
                                        </div>
                                        <ScienceText text={step.options[optIdx] || 'Empty option'} className="text-slate-800 flex-1" smilesSize="sm" />
                                        {step.correctAnswer === optIdx && (
                                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {step.explanation && (
                                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-xs text-blue-700 font-semibold mb-1">Explanation:</p>
                                    <p className="text-sm text-slate-700">
                                      <ScienceText text={step.explanation} />
                                    </p>
                                  </div>
                                )}

                                {step.timeLimitSeconds && (
                                  <div className="mt-2 text-xs text-slate-500">
                                    ⏱️ Time limit: {step.timeLimitSeconds}s
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Summary */}
                          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-slate-500">Total Steps:</span>
                                <span className="text-slate-900 ml-2 font-semibold">{form.steps.length}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Total Marks:</span>
                                <span className="text-slate-900 ml-2 font-semibold">{form.totalMarks}</span>
                              </div>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="game" className="pt-2">
                          <InGamePreview 
                            question={formToQuestion(form)}
                            className="preview-light"
                            key={JSON.stringify(form)} // Force re-render on form change
                          />
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
