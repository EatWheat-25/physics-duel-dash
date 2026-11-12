/**
 * Molecule graph shared by the formula reader, SMILES reader, layout and renderer.
 * Hydrogens are implicit (a count on each heavy atom) unless expandHydrogens() is used.
 */

export interface Atom {
  el: string
  /** Hydrogens attached to this atom that are not separate atoms in the graph. */
  h: number
  charge: number
  aromatic?: boolean
}

export interface Bond {
  a: number
  b: number
  order: 1 | 2 | 3
  aromatic?: boolean
}

export interface Mol {
  atoms: Atom[]
  bonds: Bond[]
}

export class ChemParseError extends Error {}

export const VALENCE: Record<string, number> = {
  H: 1,
  B: 3,
  C: 4,
  N: 3,
  O: 2,
  F: 1,
  Si: 4,
  P: 3,
  S: 2,
  Cl: 1,
  Br: 1,
  I: 1,
}

export interface Edge {
  to: number
  bi: number
}

export function adjacency(mol: Mol): Edge[][] {
  const adj: Edge[][] = mol.atoms.map(() => [])
  mol.bonds.forEach((b, bi) => {
    adj[b.a].push({ to: b.b, bi })
    adj[b.b].push({ to: b.a, bi })
  })
  return adj
}

/** Sum of bond orders at an atom; an aromatic bond counts as 1.5. */
export function bondSum(mol: Mol, i: number): number {
  let sum = 0
  for (const b of mol.bonds) {
    if (b.a === i || b.b === i) sum += b.aromatic ? 1.5 : b.order
  }
  return sum
}

export function freeValence(mol: Mol, i: number): number {
  const atom = mol.atoms[i]
  return (VALENCE[atom.el] ?? 0) - atom.h - bondSum(mol, i)
}

/** Copy of the molecule in which every implicit hydrogen is a real atom. */
export function expandHydrogens(mol: Mol): Mol {
  const atoms: Atom[] = mol.atoms.map((a) => ({ ...a, h: 0 }))
  const bonds: Bond[] = mol.bonds.map((b) => ({ ...b }))
  mol.atoms.forEach((a, i) => {
    for (let k = 0; k < a.h; k += 1) {
      atoms.push({ el: 'H', h: 0, charge: 0 })
      bonds.push({ a: i, b: atoms.length - 1, order: 1 })
    }
  })
  return { atoms, bonds }
}

const ORGANIC_SUBSET = new Set(['B', 'C', 'N', 'O', 'P', 'S', 'F', 'Cl', 'Br', 'I'])

/** Write the graph back out as SMILES (used to hand awkward molecules to the fallback drawer). */
export function toSmiles(mol: Mol): string {
  if (mol.atoms.length === 0) return ''
  const adj = adjacency(mol)
  const visited = new Array<boolean>(mol.atoms.length).fill(false)
  const children: Edge[][] = mol.atoms.map(() => [])
  const treeBonds = new Set<number>()
  const closures = new Map<number, number>()
  let nextDigit = 0

  const walk = (u: number, parentBond: number) => {
    visited[u] = true
    for (const e of adj[u]) {
      if (e.bi === parentBond) continue
      if (!visited[e.to]) {
        treeBonds.add(e.bi)
        children[u].push(e)
        walk(e.to, e.bi)
      } else if (!treeBonds.has(e.bi) && !closures.has(e.bi)) {
        nextDigit += 1
        closures.set(e.bi, nextDigit)
      }
    }
  }
  walk(0, -1)

  const bondSym = (bi: number): string => {
    const b = mol.bonds[bi]
    if (b.aromatic) return ''
    if (b.order === 2) return '='
    if (b.order === 3) return '#'
    return mol.atoms[b.a].aromatic && mol.atoms[b.b].aromatic ? '-' : ''
  }
  const atomSym = (i: number): string => {
    const a = mol.atoms[i]
    if (a.charge === 0 && ORGANIC_SUBSET.has(a.el)) return a.aromatic ? a.el.toLowerCase() : a.el
    const h = a.h > 0 ? `H${a.h > 1 ? a.h : ''}` : ''
    const mag = Math.abs(a.charge)
    const charge = a.charge === 0 ? '' : `${a.charge > 0 ? '+' : '-'}${mag > 1 ? mag : ''}`
    return `[${a.aromatic ? a.el.toLowerCase() : a.el}${h}${charge}]`
  }
  const written = new Set<number>()
  const write = (u: number): string => {
    let out = atomSym(u)
    for (const e of adj[u]) {
      const digit = closures.get(e.bi)
      if (digit === undefined) continue
      const first = !written.has(e.bi)
      written.add(e.bi)
      out += (first ? bondSym(e.bi) : '') + (digit < 10 ? String(digit) : `%${digit}`)
    }
    children[u].forEach((e, idx) => {
      const piece = bondSym(e.bi) + write(e.to)
      out += idx < children[u].length - 1 ? `(${piece})` : piece
    })
    return out
  }
  return write(0)
}

function hashString(s: string): string {
  let h1 = 5381
  let h2 = 52711
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i)
    h1 = (h1 * 33) ^ c
    h2 = (h2 * 33) ^ c
  }
  return ((h1 >>> 0) * 4096 + (h2 >>> 0)).toString(36)
}

/**
 * Order-independent fingerprint of a molecule. Two inputs describing the same
 * structure (e.g. a condensed formula and a SMILES string) give the same value.
 */
export function signature(mol: Mol): string {
  const adj = adjacency(mol)
  let inv = mol.atoms.map((a) => `${a.el}.${a.h}.${a.charge}.${a.aromatic ? 'a' : ''}`)
  const rounds = Math.min(mol.atoms.length, 12)
  for (let r = 0; r < rounds; r += 1) {
    inv = inv.map((own, i) => {
      const around = adj[i]
        .map((e) => `${mol.bonds[e.bi].aromatic ? 'a' : mol.bonds[e.bi].order}${inv[e.to]}`)
        .sort()
        .join(',')
      return hashString(`${own}|${around}`)
    })
  }
  return `${mol.atoms.length}:${mol.bonds.length}:${[...inv].sort().join('')}`
}
