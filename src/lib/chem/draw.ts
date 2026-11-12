import { ChemParseError, adjacency, expandHydrogens, toSmiles, type Mol } from './graph'
import { layoutGrid, layoutZigzag, type Pt, type RingInfo } from './layout'
import { parseCondensed } from './parseCondensed'
import { parseSmiles } from './parseSmiles'

export type MolStyle = 'skeletal' | 'displayed' | 'structural'
export type MolInputKind = 'auto' | 'smiles' | 'formula'

export interface MolOptions {
  style?: MolStyle
  kind?: MolInputKind
  /** Degrees, anticlockwise. Applies to skeletal-type drawings only. */
  rotate?: number
  flip?: boolean
}

export interface DrawLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface DrawText {
  x: number
  y: number
  text: string
  size: number
}

export interface MolDrawing {
  width: number
  height: number
  lines: DrawLine[]
  texts: DrawText[]
  circles: { cx: number; cy: number; r: number }[]
  strokeWidth: number
}

export interface MolResult {
  drawing?: MolDrawing
  /** Set when our own layout cannot place the molecule; draw this with the fallback library. */
  fallbackSmiles?: string
  error?: string
  note?: string
}

export const MOL_FONT_FAMILY = 'Arial, Helvetica, sans-serif'

export function parseMolInput(input: string, kind: MolInputKind = 'auto'): Mol {
  const text = input.trim()
  if (!text) throw new ChemParseError('Nothing to draw.')
  if (kind === 'smiles') return parseSmiles(text)
  if (kind === 'formula') return parseCondensed(text)
  // Outside square brackets, SMILES never contains H; a structural formula nearly always does.
  if (/H/.test(text.replace(/\[[^\]]*\]/g, ''))) return parseCondensed(text)
  try {
    return parseSmiles(text)
  } catch (smilesError) {
    try {
      return parseCondensed(text)
    } catch {
      throw smilesError
    }
  }
}

const CHAR_WIDTH: Record<string, number> = {
  C: 0.72,
  H: 0.72,
  O: 0.78,
  N: 0.72,
  S: 0.67,
  P: 0.67,
  F: 0.61,
  I: 0.28,
  B: 0.67,
  l: 0.22,
  r: 0.33,
  i: 0.22,
  '+': 0.58,
  '−': 0.58,
}
const textWidth = (s: string, size: number) =>
  [...s].reduce((sum, ch) => sum + (CHAR_WIDTH[ch] ?? 0.56), 0) * size

interface Label {
  texts: DrawText[]
  box: { x0: number; y0: number; x1: number; y1: number }
}

/** Build an atom label such as CH3, H3C, OH or NH2 with the element letter centred on (cx, cy). */
function buildLabel(
  cx: number,
  cy: number,
  el: string,
  h: number,
  charge: number,
  hOnLeft: boolean,
  size: number,
): Label {
  const texts: DrawText[] = []
  const baseline = cy + size * 0.36
  const subSize = size * 0.72
  const elW = textWidth(el, size)
  let x0 = cx - elW / 2
  let x1 = cx + elW / 2
  texts.push({ x: x0, y: baseline, text: el, size })

  const hW = textWidth('H', size)
  const count = h > 1 ? String(h) : ''
  const countW = count ? textWidth(count, subSize) : 0

  if (charge !== 0) {
    const mag = Math.abs(charge)
    const mark = `${mag > 1 ? mag : ''}${charge > 0 ? '+' : '−'}`
    texts.push({ x: x1 + 0.5, y: baseline - size * 0.42, text: mark, size: subSize })
    if (!(h > 0 && !hOnLeft)) x1 += textWidth(mark, subSize) + 0.5
  }
  if (h > 0 && hOnLeft) {
    x0 -= hW + countW
    texts.push({ x: x0, y: baseline, text: 'H', size })
    if (count) texts.push({ x: x0 + hW, y: baseline + size * 0.24, text: count, size: subSize })
  } else if (h > 0) {
    const shift = charge !== 0 ? textWidth('+', subSize) + 1 : 0
    texts.push({ x: x1 + shift, y: baseline, text: 'H', size })
    if (count) texts.push({ x: x1 + shift + hW, y: baseline + size * 0.24, text: count, size: subSize })
    x1 += shift + hW + countW
  }

  const pad = 2
  return {
    texts,
    box: { x0: x0 - pad, y0: cy - size * 0.56 - pad, x1: x1 + pad, y1: cy + size * 0.56 + pad },
  }
}

/** Point where the segment from p (inside the box) towards q leaves the box. */
function exitBox(p: Pt, q: Pt, box: Label['box']): Pt {
  const dx = q.x - p.x
  const dy = q.y - p.y
  let t = 1
  if (dx > 1e-9) t = Math.min(t, (box.x1 - p.x) / dx)
  if (dx < -1e-9) t = Math.min(t, (box.x0 - p.x) / dx)
  if (dy > 1e-9) t = Math.min(t, (box.y1 - p.y) / dy)
  if (dy < -1e-9) t = Math.min(t, (box.y0 - p.y) / dy)
  t = Math.max(0, Math.min(1, t))
  return { x: p.x + dx * t, y: p.y + dy * t }
}

export function buildMolDrawing(input: string, options: MolOptions = {}): MolResult {
  let mol: Mol
  try {
    mol = parseMolInput(input, options.kind)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not read this molecule.' }
  }

  let style: MolStyle = options.style ?? 'skeletal'
  let note: string | undefined
  let graph = mol
  let pts: Pt[] | null = null
  let rings: RingInfo[] = []
  let onGrid = false

  if (style === 'displayed') {
    const expanded = expandHydrogens(mol)
    const grid = layoutGrid(expanded)
    if (grid) {
      graph = expanded
      pts = grid
      onGrid = true
    } else {
      style = 'structural'
      note = 'Displayed style is not available for ring molecules yet; showing the structural style.'
    }
  }
  if (style === 'structural' && !pts) {
    const grid = layoutGrid(mol)
    if (grid) {
      pts = grid
      onGrid = true
    }
  }
  if (!pts) {
    const zig = layoutZigzag(mol)
    if (!zig || zig.overlap) {
      return { fallbackSmiles: options.kind === 'smiles' ? input.trim() : toSmiles(mol), note }
    }
    pts = zig.pos
    rings = zig.rings
    const angle = ((options.rotate ?? 0) * Math.PI) / 180
    const mirror = options.flip ? -1 : 1
    if (angle !== 0 || mirror === -1) {
      const turn = (p: Pt): Pt => ({
        x: mirror * (p.x * Math.cos(angle) - p.y * Math.sin(angle)),
        y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
      })
      pts = pts.map(turn)
      rings = rings.map((r) => ({ ...r, center: turn(r.center) }))
    }
  }

  const bondLength = style === 'skeletal' ? 30 : style === 'displayed' ? 36 : onGrid ? 50 : 40
  const fontSize = 15
  const strokeWidth = 1.5
  const gap = 4.4

  const adj = adjacency(graph)
  const px: Pt[] = pts.map((p) => ({ x: p.x * bondLength, y: -p.y * bondLength }))
  const ringCenters = rings.map((r) => ({ x: r.center.x * bondLength, y: -r.center.y * bondLength }))
  const inRing = graph.atoms.map(() => false)
  rings.forEach((r) => r.atoms.forEach((a) => (inRing[a] = true)))

  const labels: (Label | null)[] = graph.atoms.map((atom, i) => {
    const degree = adj[i].length
    let show: boolean
    if (style === 'displayed') show = true
    else if (style === 'structural') show = !(atom.el === 'C' && inRing[i] && atom.charge === 0)
    else show = atom.el !== 'C' || degree === 0 || atom.charge !== 0
    if (!show) return null

    const h = style === 'displayed' ? 0 : atom.h
    // Put the hydrogens on whichever side has no bond coming in.
    let east = 0
    let west = 0
    for (const e of adj[i]) {
      const d = Math.hypot(px[e.to].x - px[i].x, px[e.to].y - px[i].y) || 1
      const cos = (px[e.to].x - px[i].x) / d
      east = Math.max(east, cos)
      west = Math.max(west, -cos)
    }
    const hOnLeft = h > 0 && east > 0.45 && east > west + 0.2
    return buildLabel(px[i].x, px[i].y, atom.el, h, atom.charge, hOnLeft, fontSize)
  })

  const lines: DrawLine[] = []
  graph.bonds.forEach((bond) => {
    const pa = px[bond.a]
    const pb = px[bond.b]
    const la = labels[bond.a]
    const lb = labels[bond.b]
    const a = la ? exitBox(pa, pb, la.box) : pa
    const b = lb ? exitBox(pb, pa, lb.box) : pb
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len < 0.5) return
    const nx = -(b.y - a.y) / len
    const ny = (b.x - a.x) / len
    const shifted = (off: number, trimA = 0, trimB = 0): DrawLine => {
      const ux = (b.x - a.x) / len
      const uy = (b.y - a.y) / len
      return {
        x1: a.x + nx * off + ux * trimA,
        y1: a.y + ny * off + uy * trimA,
        x2: b.x + nx * off - ux * trimB,
        y2: b.y + ny * off - uy * trimB,
      }
    }

    if (bond.order === 1 || bond.aromatic) {
      lines.push(shifted(0))
      return
    }
    if (bond.order === 3) {
      lines.push(shifted(0), shifted(gap), shifted(-gap))
      return
    }
    const terminal = adj[bond.a].length === 1 || adj[bond.b].length === 1
    if (onGrid || terminal) {
      lines.push(shifted(gap / 2), shifted(-gap / 2))
      return
    }
    // Chain or ring double bond: second line goes on the inside.
    let side = 0
    const ringIdx = rings.findIndex((r) => r.atoms.includes(bond.a) && r.atoms.includes(bond.b))
    const cross = (p: Pt) => (pb.x - pa.x) * (p.y - pa.y) - (pb.y - pa.y) * (p.x - pa.x)
    if (ringIdx >= 0) {
      side = cross(ringCenters[ringIdx])
    } else {
      for (const end of [bond.a, bond.b]) {
        for (const e of adj[end]) {
          if (e.to !== bond.a && e.to !== bond.b) side += cross(px[e.to])
        }
      }
    }
    const dir = side >= 0 ? 1 : -1
    lines.push(shifted(0))
    lines.push(shifted(dir * gap, la ? 0 : len * 0.14, lb ? 0 : len * 0.14))
  })

  const circles = rings
    .map((r, ri) => ({ r, c: ringCenters[ri] }))
    .filter(({ r }) => r.aromatic)
    .map(({ r, c }) => ({
      cx: c.x,
      cy: c.y,
      r: (bondLength / (2 * Math.tan(Math.PI / r.atoms.length))) * 0.64,
    }))

  const texts = labels.flatMap((l) => (l ? l.texts : []))

  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const grow = (x: number, y: number) => {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  px.forEach((p) => grow(p.x, p.y))
  lines.forEach((l) => {
    grow(l.x1, l.y1)
    grow(l.x2, l.y2)
  })
  labels.forEach((l) => {
    if (!l) return
    grow(l.box.x0, l.box.y0)
    grow(l.box.x1, l.box.y1 + 3)
  })
  const pad = 8
  const dx = pad - x0
  const dy = pad - y0

  return {
    note,
    drawing: {
      width: x1 - x0 + pad * 2,
      height: y1 - y0 + pad * 2,
      strokeWidth,
      lines: lines.map((l) => ({ x1: l.x1 + dx, y1: l.y1 + dy, x2: l.x2 + dx, y2: l.y2 + dy })),
      texts: texts.map((t) => ({ ...t, x: t.x + dx, y: t.y + dy })),
      circles: circles.map((c) => ({ ...c, cx: c.cx + dx, cy: c.cy + dy })),
    },
  }
}

export interface MolTag {
  input: string
  style: MolStyle
  kind: MolInputKind
  label?: string
  rotate?: number
  flip?: boolean
}

/**
 * Reads the inside of a [[mol:...]] tag:
 *   CH3CH(OH)CH3 | style=displayed | label=S | rotate=30 | flip | as=smiles
 */
export const MOL_TAG_RE = /\[\[mol:([\s\S]*?)\]\](?!\])/g

/** Every [[mol:...]] tag in a piece of question text, with where it sits. */
export function findMolTags(text: string): { start: number; end: number; tag: MolTag }[] {
  const found: { start: number; end: number; tag: MolTag }[] = []
  for (const m of text.matchAll(MOL_TAG_RE)) {
    const start = m.index ?? 0
    found.push({ start, end: start + m[0].length, tag: parseMolTag(m[1]) })
  }
  return found
}

/** Write a tag back out as text; the reverse of parseMolTag. */
export function formatMolTag(tag: MolTag): string {
  const clean = (s: string) => s.replace(/[|\]]/g, '').trim()
  const parts = [tag.input.replace(/\|/g, '').trim()]
  if (tag.style !== 'skeletal') parts.push(`style=${tag.style}`)
  if (tag.kind !== 'auto') parts.push(`as=${tag.kind}`)
  if (tag.label && clean(tag.label)) parts.push(`label=${clean(tag.label)}`)
  if (tag.rotate) parts.push(`rotate=${tag.rotate}`)
  if (tag.flip) parts.push('flip')
  return `[[mol:${parts.join('|')}]]`
}

export function parseMolTag(payload: string): MolTag {
  const [first, ...rest] = payload.split('|')
  const tag: MolTag = { input: first.trim(), style: 'skeletal', kind: 'auto' }
  for (const part of rest) {
    const eq = part.indexOf('=')
    const key = (eq < 0 ? part : part.slice(0, eq)).trim().toLowerCase()
    const value = eq < 0 ? '' : part.slice(eq + 1).trim()
    if (key === 'style' && (value === 'skeletal' || value === 'displayed' || value === 'structural')) {
      tag.style = value
    } else if (key === 'label') {
      tag.label = value
    } else if (key === 'rotate' && Number.isFinite(Number(value))) {
      tag.rotate = Number(value)
    } else if (key === 'flip') {
      tag.flip = value !== 'false'
    } else if (key === 'as' && (value === 'smiles' || value === 'formula')) {
      tag.kind = value
    }
  }
  return tag
}
