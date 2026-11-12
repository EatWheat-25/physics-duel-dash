import { ChemParseError, VALENCE, type Mol } from './graph'

/**
 * SMILES reader for the subset needed at A level: organic-subset atoms,
 * bracket atoms with H counts and charges, branches, ring closures, double
 * and triple bonds, and lowercase aromatic atoms. Stereo marks (/ \ @) are
 * accepted and ignored for now.
 */

const BRACKET_RE = /^(\d+)?(Cl|Br|Si|[BCNOPSFIH]|[bcnops])(@{0,2})(?:H(\d*))?((?:\+{1,3}|-{1,3})\d?)?(?::\d+)?$/
const ORGANIC_RE = /^(Cl|Br|[BCNOPSFI]|[bcnops])/
const HIGHER_VALENCE: Record<string, number[]> = { N: [3, 5], P: [3, 5], S: [2, 4, 6] }

export function parseSmiles(src: string): Mol {
  const s = src.trim()
  if (!s) throw new ChemParseError('Empty SMILES.')

  const mol: Mol = { atoms: [], bonds: [] }
  const fromBracket: boolean[] = []
  const stack: number[] = []
  const rings = new Map<number, { atom: number; order: 0 | 1 | 2 | 3 }>()
  let prev = -1
  let pendingOrder: 0 | 1 | 2 | 3 = 0

  const link = (a: number, b: number, order: 0 | 1 | 2 | 3) => {
    const aromatic = order === 0 && Boolean(mol.atoms[a].aromatic && mol.atoms[b].aromatic)
    mol.bonds.push({ a, b, order: (order || 1) as 1 | 2 | 3, ...(aromatic ? { aromatic: true } : {}) })
  }
  const addAtom = (symbol: string, h: number, charge: number, bracket: boolean) => {
    const aromatic = symbol === symbol.toLowerCase()
    const el = aromatic ? symbol.toUpperCase() : symbol
    if (!(el in VALENCE)) throw new ChemParseError(`Element ${el} is not supported.`)
    mol.atoms.push({ el, h, charge, ...(aromatic ? { aromatic: true } : {}) })
    fromBracket.push(bracket)
    const atom = mol.atoms.length - 1
    if (prev >= 0) link(prev, atom, pendingOrder)
    pendingOrder = 0
    prev = atom
  }
  const ringBond = (n: number) => {
    if (prev < 0) throw new ChemParseError('Ring number before any atom.')
    const open = rings.get(n)
    if (open) {
      link(open.atom, prev, pendingOrder || open.order)
      rings.delete(n)
    } else {
      rings.set(n, { atom: prev, order: pendingOrder })
    }
    pendingOrder = 0
  }

  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === '(') {
      if (prev < 0) throw new ChemParseError('"(" before any atom.')
      stack.push(prev)
      i += 1
    } else if (ch === ')') {
      const back = stack.pop()
      if (back === undefined) throw new ChemParseError('Unmatched ")".')
      prev = back
      i += 1
    } else if (ch === '-') {
      pendingOrder = 1
      i += 1
    } else if (ch === '=') {
      pendingOrder = 2
      i += 1
    } else if (ch === '#') {
      pendingOrder = 3
      i += 1
    } else if (ch === ':' || ch === '/' || ch === '\\') {
      i += 1
    } else if (ch === '.') {
      throw new ChemParseError('Separate molecules in one SMILES string are not supported.')
    } else if (ch === '%') {
      const m = /^%(\d\d)/.exec(s.slice(i))
      if (!m) throw new ChemParseError('Bad ring number after "%".')
      ringBond(Number(m[1]))
      i += m[0].length
    } else if (ch >= '0' && ch <= '9') {
      ringBond(Number(ch))
      i += 1
    } else if (ch === '[') {
      const end = s.indexOf(']', i)
      if (end < 0) throw new ChemParseError('Missing "]".')
      const m = BRACKET_RE.exec(s.slice(i + 1, end))
      if (!m) throw new ChemParseError(`Cannot read atom "[${s.slice(i + 1, end)}]".`)
      const h = m[4] === undefined ? 0 : m[4] === '' ? 1 : Number(m[4])
      let charge = 0
      if (m[5]) {
        const sign = m[5][0] === '+' ? 1 : -1
        const digit = /\d$/.exec(m[5])
        charge = sign * (digit ? Number(digit[0]) : m[5].length)
      }
      addAtom(m[2], h, charge, true)
      i = end + 1
    } else {
      const m = ORGANIC_RE.exec(s.slice(i))
      if (!m) throw new ChemParseError(`Unexpected "${ch}" in SMILES.`)
      addAtom(m[1], 0, 0, false)
      i += m[0].length
    }
  }

  if (stack.length > 0) throw new ChemParseError('Missing ")".')
  if (rings.size > 0) throw new ChemParseError('A ring number is opened but never closed.')
  if (mol.atoms.length === 0) throw new ChemParseError('No atoms found in SMILES.')

  // Fill in implicit hydrogens on atoms written without brackets.
  mol.atoms.forEach((atom, idx) => {
    if (fromBracket[idx]) return
    let used = atom.aromatic ? 1 : 0
    for (const b of mol.bonds) {
      if (b.a === idx || b.b === idx) used += b.aromatic ? 1 : b.order
    }
    const options = HIGHER_VALENCE[atom.el] ?? [VALENCE[atom.el]]
    const valence = options.find((v) => v >= used) ?? options[options.length - 1]
    atom.h = Math.max(0, valence - used)
  })

  return mol
}
