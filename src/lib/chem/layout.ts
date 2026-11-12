import { adjacency, type Edge, type Mol } from './graph'

/** Coordinates are in bond lengths, y pointing up. */
export interface Pt {
  x: number
  y: number
}

export interface RingInfo {
  atoms: number[]
  center: Pt
  aromatic: boolean
}

export interface ZigzagLayout {
  pos: Pt[]
  rings: RingInfo[]
  /** True when two atoms ended up on top of each other. */
  overlap: boolean
}

const TAU = Math.PI * 2
const deg = (d: number) => (d * Math.PI) / 180
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const step = (p: Pt, angle: number, len = 1): Pt => ({ x: p.x + Math.cos(angle) * len, y: p.y + Math.sin(angle) * len })

/** Smallest ring through each ring bond, as ordered atom cycles. */
export function findRings(mol: Mol, adj: Edge[][] = adjacency(mol)): number[][] {
  const seen = new Set<string>()
  const rings: number[][] = []
  mol.bonds.forEach((bond, bi) => {
    const prev = new Array<number>(mol.atoms.length).fill(-2)
    prev[bond.a] = -1
    const queue = [bond.a]
    while (queue.length > 0 && prev[bond.b] === -2) {
      const u = queue.shift() as number
      for (const e of adj[u]) {
        if (e.bi === bi || prev[e.to] !== -2) continue
        prev[e.to] = u
        queue.push(e.to)
      }
    }
    if (prev[bond.b] === -2) return
    const cycle: number[] = []
    for (let v = bond.b; v !== -1; v = prev[v]) cycle.push(v)
    const key = [...cycle].sort((x, y) => x - y).join(',')
    if (seen.has(key)) return
    seen.add(key)
    rings.push(cycle)
  })
  return rings
}

function farthest(adj: Edge[][], from: number, allowed: (i: number) => boolean): number {
  const d = new Array<number>(adj.length).fill(-1)
  d[from] = 0
  const queue = [from]
  let best = from
  while (queue.length > 0) {
    const u = queue.shift() as number
    if (d[u] > d[best] || (d[u] === d[best] && u < best)) best = u
    for (const e of adj[u]) {
      if (d[e.to] >= 0 || !allowed(e.to)) continue
      d[e.to] = d[u] + 1
      queue.push(e.to)
    }
  }
  return best
}

/** One end of the longest chain, preferring the end written first. */
function chainStart(adj: Edge[][], allowed: (i: number) => boolean): number {
  const first = adj.findIndex((_, i) => allowed(i))
  if (first < 0) return 0
  const a = farthest(adj, first, allowed)
  const b = farthest(adj, a, allowed)
  return Math.min(a, b)
}

function isLinear(mol: Mol, adj: Edge[][], i: number): boolean {
  const orders = adj[i].map((e) => mol.bonds[e.bi].order)
  return orders.includes(3) || orders.filter((o) => o === 2).length >= 2
}

/**
 * Skeletal-style layout: 120-degree zig-zag chains, regular-polygon rings,
 * fused rings sharing a bond. Returns null for shapes it cannot place
 * (spiro or bridged rings, disconnected atoms).
 */
export function layoutZigzag(mol: Mol): ZigzagLayout | null {
  const n = mol.atoms.length
  if (n === 0) return null
  const adj = adjacency(mol)
  const rings = findRings(mol, adj)
  const ringsOf: number[][] = mol.atoms.map(() => [])
  rings.forEach((ring, ri) => ring.forEach((a) => ringsOf[a].push(ri)))
  const pos: (Pt | null)[] = new Array(n).fill(null)
  const centers: (Pt | null)[] = rings.map(() => null)
  let failed = false

  const radius = (m: number) => 1 / (2 * Math.sin(Math.PI / m))

  const placeRingAt = (ri: number, anchor: number, anchorPos: Pt, towardCenter: number): boolean => {
    const ring = rings[ri]
    const m = ring.length
    const r = radius(m)
    const c = step(anchorPos, towardCenter, r)
    const k0 = ring.indexOf(anchor)
    for (let j = 0; j < m; j += 1) {
      const atom = ring[(k0 + j) % m]
      const p = step(c, towardCenter + Math.PI + (j * TAU) / m, r)
      const existing = pos[atom]
      if (existing && dist(existing, p) > 0.01) return false
      pos[atom] = p
    }
    centers[ri] = c
    return true
  }

  const placeFused = (ri: number): boolean => {
    const ring = rings[ri]
    const m = ring.length
    const placedIdx = ring.map((a, j) => (pos[a] ? j : -1)).filter((j) => j >= 0)
    if (placedIdx.length !== 2) return false
    let j = placedIdx[0]
    if ((j + 1) % m !== placedIdx[1]) {
      if ((placedIdx[1] + 1) % m !== j) return false
      j = placedIdx[1]
    }
    const u = ring[j]
    const v = ring[(j + 1) % m]
    const pu = pos[u] as Pt
    const pv = pos[v] as Pt
    const mid = { x: (pu.x + pv.x) / 2, y: (pu.y + pv.y) / 2 }
    const normal = Math.atan2(pv.y - pu.y, pv.x - pu.x) + Math.PI / 2
    const r = radius(m)
    const apothem = r * Math.cos(Math.PI / m)
    const neighbour = rings.findIndex((other, oi) => centers[oi] && other.includes(u) && other.includes(v))
    const c1 = step(mid, normal, apothem)
    const c2 = step(mid, normal + Math.PI, apothem)
    const ref = neighbour >= 0 ? (centers[neighbour] as Pt) : mid
    const c = dist(c1, ref) >= dist(c2, ref) ? c1 : c2
    const au = Math.atan2(pu.y - c.y, pu.x - c.x)
    const av = Math.atan2(pv.y - c.y, pv.x - c.x)
    let turn = av - au
    while (turn > Math.PI) turn -= TAU
    while (turn < -Math.PI) turn += TAU
    const sign = turn > 0 ? 1 : -1
    for (let t = 0; t < m; t += 1) {
      const atom = ring[(j + t) % m]
      const p = step(c, au + (sign * t * TAU) / m, r)
      const existing = pos[atom]
      if (existing && dist(existing, p) > 0.01) return false
      pos[atom] = p
    }
    centers[ri] = c
    return true
  }

  /** Place a ring and every ring fused to it. Returns the atoms newly placed. */
  const placeRingSystem = (ri: number, anchor: number, anchorPos: Pt, towardCenter: number): number[] | null => {
    const before = pos.map((p) => p !== null)
    if (!placeRingAt(ri, anchor, anchorPos, towardCenter)) return null
    let progress = true
    while (progress) {
      progress = false
      for (let other = 0; other < rings.length; other += 1) {
        if (centers[other] || !rings[other].some((a) => pos[a])) continue
        if (!placeFused(other)) return null
        progress = true
      }
    }
    return pos.map((p, i) => (p !== null && !before[i] ? i : -1)).filter((i) => i >= 0)
  }

  const subtreeSize = (v: number, blocked: number): number => {
    const seen = new Set<number>([blocked, v])
    const queue = [v]
    while (queue.length > 0) {
      const u = queue.shift() as number
      for (const e of adj[u]) {
        if (seen.has(e.to)) continue
        seen.add(e.to)
        queue.push(e.to)
      }
    }
    return seen.size - 1
  }

  const grow = (u: number, s: number) => {
    const pu = pos[u] as Pt
    const placed = adj[u].filter((e) => pos[e.to])
    const open = adj[u].filter((e) => !pos[e.to])
    if (open.length === 0) return
    open.sort((x, y) => subtreeSize(y.to, u) - subtreeSize(x.to, u) || x.to - y.to)
    const k = open.length
    let angles: number[]

    if (placed.length === 0) {
      const first = isLinear(mol, adj, u) ? 0 : deg(30)
      angles = open.map((_, j) => first + (j * TAU) / k)
    } else if (placed.length === 1 && ringsOf[u].length === 0) {
      const back = Math.atan2((pos[placed[0].to] as Pt).y - pu.y, (pos[placed[0].to] as Pt).x - pu.x)
      if (isLinear(mol, adj, u)) {
        angles = open.map((_, j) => back + Math.PI + j * deg(90))
      } else if (k === 1) {
        angles = [back + s * deg(120)]
      } else if (k === 2) {
        angles = [back + s * deg(120), back - s * deg(120)]
      } else if (k === 3) {
        angles = [back + s * deg(120), back - s * deg(90), back - s * deg(150)]
      } else {
        angles = open.map((_, j) => back + ((j + 1) * TAU) / (k + 1))
      }
    } else {
      // Ring atom, or an atom reached from two sides: point away from what is already there.
      let sx = 0
      let sy = 0
      for (const e of placed) {
        const q = pos[e.to] as Pt
        const d = dist(pu, q) || 1
        sx += (q.x - pu.x) / d
        sy += (q.y - pu.y) / d
      }
      const out = Math.hypot(sx, sy) < 1e-6 ? Math.PI / 2 : Math.atan2(-sy, -sx)
      const spread = k === 1 ? 0 : k === 2 ? deg(80) : deg(120)
      angles = open.map((_, j) => out + (k === 1 ? 0 : (j / (k - 1) - 0.5) * spread))
    }

    open.forEach((e, j) => {
      if (pos[e.to]) return
      const p = step(pu, angles[j])
      if (ringsOf[e.to].length > 0) {
        const added = placeRingSystem(ringsOf[e.to][0], e.to, p, angles[j])
        if (!added) {
          failed = true
          return
        }
        added.forEach((a) => grow(a, 1))
      } else {
        pos[e.to] = p
        grow(e.to, placed.length === 0 ? 1 : -s)
      }
    })
  }

  if (rings.length > 0) {
    let start = 0
    rings.forEach((ring, ri) => {
      if (ring.length > rings[start].length) start = ri
    })
    const r = radius(rings[start].length)
    const added = placeRingSystem(start, rings[start][0], { x: 0, y: r }, -Math.PI / 2)
    if (!added) return null
    added.forEach((a) => grow(a, 1))
  } else {
    const start = chainStart(adj, () => true)
    pos[start] = { x: 0, y: 0 }
    grow(start, 1)
  }

  if (failed || pos.some((p) => p === null)) return null
  const pts = pos as Pt[]

  // A ring with a chain on it comes out at an angle; turn the whole drawing in
  // 30-degree steps so its long side is horizontal, keeping bond angles tidy.
  if (rings.length > 0 && n > rings[0].length) {
    const extent = (angle: number) => {
      const ys = pts.map((p) => p.x * Math.sin(angle) + p.y * Math.cos(angle))
      return Math.max(...ys) - Math.min(...ys)
    }
    let best = 0
    for (let turn = 1; turn < 6; turn += 1) {
      if (extent(deg(30 * turn)) < extent(deg(30 * best)) * 0.88) best = turn
    }
    if (best !== 0) {
      const a = deg(30 * best)
      const rot = (p: Pt): Pt => ({
        x: p.x * Math.cos(a) - p.y * Math.sin(a),
        y: p.x * Math.sin(a) + p.y * Math.cos(a),
      })
      pts.forEach((p, i) => {
        pts[i] = rot(p)
      })
      centers.forEach((c, i) => {
        if (c) centers[i] = rot(c)
      })
    }
    // Keep the atom written first on the left.
    const cx = pts.reduce((sum, p) => sum + p.x, 0) / n
    if (pts[0].x > cx + 0.1) {
      pts.forEach((p, i) => {
        pts[i] = { x: -p.x, y: p.y }
      })
      centers.forEach((c, i) => {
        if (c) centers[i] = { x: -c.x, y: c.y }
      })
    }
  }

  let overlap = false
  for (let i = 0; i < n && !overlap; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (dist(pts[i], pts[j]) < 0.45) {
        overlap = true
        break
      }
    }
  }

  const bondBetween = (a: number, b: number) =>
    mol.bonds.find((bond) => (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a))

  return {
    pos: pts,
    rings: rings.map((ring, ri) => ({
      atoms: ring,
      center: centers[ri] as Pt,
      aromatic: ring.every((a, j) => Boolean(bondBetween(a, ring[(j + 1) % ring.length])?.aromatic)),
    })),
    overlap,
  }
}

/**
 * Right-angle layout used for displayed and structural formulae: the longest
 * chain runs left to right and substituents go straight up or down. Works on
 * molecules without rings; returns null otherwise.
 */
export function layoutGrid(mol: Mol): Pt[] | null {
  const n = mol.atoms.length
  if (n === 0 || mol.bonds.length !== n - 1) return null
  const adj = adjacency(mol)
  const isHeavy = (i: number) => mol.atoms[i].el !== 'H'
  const pos: (Pt | null)[] = new Array(n).fill(null)
  const placedOrder: number[] = []

  const heavySize = (v: number, parent: number): number => {
    let size = isHeavy(v) ? 1 : 0
    for (const e of adj[v]) if (e.to !== parent) size += heavySize(e.to, v)
    return size
  }
  const childrenOf = (v: number, parent: number): Edge[] =>
    adj[v]
      .filter((e) => e.to !== parent)
      .sort(
        (x, y) =>
          heavySize(y.to, v) - heavySize(x.to, v) ||
          Number(mol.atoms[y.to].el === 'C') - Number(mol.atoms[x.to].el === 'C') ||
          // Keep a C=C in the main chain, but send a C=O off to the side.
          (mol.atoms[x.to].el === 'C' ? -1 : 1) * (mol.bonds[x.bi].order - mol.bonds[y.bi].order) ||
          x.to - y.to,
      )
  const isLeaf = (v: number) => adj[v].length === 1
  const collides = (p: Pt) => placedOrder.some((i) => dist(pos[i] as Pt, p) < 0.7)
  const put = (i: number, p: Pt) => {
    pos[i] = p
    placedOrder.push(i)
  }
  const rollback = (mark: number) => {
    while (placedOrder.length > mark) pos[placedOrder.pop() as number] = null
  }

  const place = (v: number, parent: number, travel: number): boolean => {
    const kids = childrenOf(v, parent)
    const k = kids.length
    if (k === 0) return true
    let angles: number[]
    if (parent < 0) {
      if (k === 1) angles = [0]
      else if (k === 2) angles = [0, Math.PI]
      else if (k === 3) angles = [0, deg(120), deg(-120)]
      else if (k === 4) angles = [0, deg(90), deg(-90), Math.PI]
      else return false
    } else if (k === 1) {
      angles = [travel]
    } else if (k === 2) {
      // Two end atoms that are not carbon (the O and OH of an acid, the H and O of an
      // aldehyde) fan out; anything with a carbon keeps the chain straight.
      const fan = isLeaf(kids[0].to) && mol.atoms[kids[0].to].el !== 'C'
      angles = fan ? [travel + deg(60), travel - deg(60)] : [travel, travel + deg(90)]
    } else if (k === 3) {
      angles = [travel, travel + deg(90), travel - deg(90)]
    } else {
      return false
    }

    const pv = pos[v] as Pt
    // Single atoms first, so longer branches can see them and move out of the way.
    for (let j = 0; j < k; j += 1) {
      if (!isLeaf(kids[j].to)) continue
      const p = step(pv, angles[j])
      if (collides(p)) return false
      put(kids[j].to, p)
    }
    const tryAt = (child: number, angle: number, len: number): boolean => {
      for (let t = 1; t <= len; t += 1) {
        if (collides(step(pv, angle, t))) return false
      }
      const mark = placedOrder.length
      put(child, step(pv, angle, len))
      if (place(child, v, angle)) return true
      rollback(mark)
      return false
    }
    for (let j = 0; j < k; j += 1) {
      const child = kids[j].to
      if (isLeaf(child)) continue
      const sideways = Math.abs(Math.cos(angles[j] - travel)) < 0.5 && parent >= 0
      const minLen = sideways && adj[child].length - 1 >= 2 ? 2 : 1
      // A branch that is blocked on one side may swap with the single atom on the other side.
      const across = sideways
        ? kids.findIndex((e, s) => s !== j && isLeaf(e.to) && Math.cos(angles[s] - angles[j]) < -0.99)
        : -1
      let done = false
      for (let len = minLen; len < minLen + 4 && !done; len += 1) {
        done = tryAt(child, angles[j], len)
        if (done || across < 0) continue
        const leaf = kids[across].to
        const leafHome = pos[leaf] as Pt
        placedOrder.splice(placedOrder.indexOf(leaf), 1)
        pos[leaf] = null
        const leafMoved = step(pv, angles[j])
        if (!collides(leafMoved)) {
          put(leaf, leafMoved)
          done = tryAt(child, angles[across], len)
          if (done) {
            const swap = angles[j]
            angles[j] = angles[across]
            angles[across] = swap
          } else {
            placedOrder.pop()
            pos[leaf] = null
          }
        }
        if (!done) put(leaf, leafHome)
      }
      if (!done) return false
    }
    return true
  }

  const start = chainStart(adj, isHeavy)
  put(start, { x: 0, y: 0 })
  if (!place(start, -1, 0)) return null
  if (pos.some((p) => p === null)) return null
  return pos as Pt[]
}
