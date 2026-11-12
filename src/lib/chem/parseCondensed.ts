import { ChemParseError, VALENCE, bondSum, type Mol } from './graph'

/**
 * Reads a condensed structural formula as printed in exam papers, e.g.
 *   CH3CH(OH)CH3   (CH3)3CCN   CH3COOC2H5   CH2=CHCl   HOOC(CH2)4COOH   C6H5OH
 *
 * The reader is valence-driven: each new atom bonds to the most recent atom
 * that still has a free bond, and any bonds left over at the end are turned
 * into double/triple bonds. If the bonds cannot be made to add up, it throws
 * instead of guessing.
 */

type Tok =
  | { t: 'el'; el: string }
  | { t: 'num'; n: number }
  | { t: 'open' }
  | { t: 'close' }
  | { t: 'bond'; order: 1 | 2 | 3 }
  | { t: 'phenyl' }
  | { t: 'carboxylStart' }
  | { t: 'alkyl'; n: number }

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉'

function tokenize(src: string): Tok[] {
  const s = src
    .replace(/\s+/g, '')
    .replace(/[₀-₉]/g, (c) => String(SUBSCRIPTS.indexOf(c)))
    .replace(/≡/g, '#')
    .replace(/[–—−]/g, '-')
  const out: Tok[] = []
  let i = 0
  while (i < s.length) {
    const rest = s.slice(i)
    let m: RegExpExecArray | null
    if ((i === 0 || s[i - 1] === '(') && (m = /^(HOOC|HO2C)/.exec(rest))) {
      out.push({ t: 'carboxylStart' })
    } else if ((m = /^C6H5(?!\d)/.exec(rest))) {
      out.push({ t: 'phenyl' })
    } else if ((m = /^C(\d+)H(\d+)/.exec(rest))) {
      const n = Number(m[1])
      if (n >= 2 && Number(m[2]) === 2 * n + 1) {
        out.push({ t: 'alkyl', n })
      } else {
        throw new ChemParseError(
          `"${m[0]}" is a molecular formula, which fits more than one structure. Write the structural formula instead, e.g. CH3CH2OH.`,
        )
      }
    } else if (/^C\d/.test(rest)) {
      throw new ChemParseError(
        'This looks like a molecular formula, which fits more than one structure. Write the structural formula instead, e.g. CH3CH2OH.',
      )
    } else if ((m = /^(Cl|Br|Si|[CHONSPFIB])/.exec(rest))) {
      out.push({ t: 'el', el: m[1] })
    } else if ((m = /^\d+/.exec(rest))) {
      out.push({ t: 'num', n: Number(m[0]) })
    } else if ((m = /^\(/.exec(rest))) {
      out.push({ t: 'open' })
    } else if ((m = /^\)/.exec(rest))) {
      out.push({ t: 'close' })
    } else if ((m = /^=/.exec(rest))) {
      out.push({ t: 'bond', order: 2 })
    } else if ((m = /^#/.exec(rest))) {
      out.push({ t: 'bond', order: 3 })
    } else if ((m = /^-/.exec(rest))) {
      out.push({ t: 'bond', order: 1 })
    } else {
      throw new ChemParseError(`Unexpected "${rest[0]}" in formula.`)
    }
    i += m[0].length
  }
  return out
}

export function parseCondensed(src: string): Mol {
  const toks = tokenize(src)
  if (toks.length === 0) throw new ChemParseError('Empty formula.')

  const mol: Mol = { atoms: [], bonds: [] }
  let pos = 0
  let pendingH = 0
  let pendingOrder: 0 | 1 | 2 | 3 = 0
  /** Open atoms of leading groups such as the (CH3)3 in (CH3)3COH, waiting for the next atom. */
  let pendingOpen: number[] = []

  const free = (i: number) => (VALENCE[mol.atoms[i].el] ?? 0) - mol.atoms[i].h - bondSum(mol, i)
  const addAtom = (el: string, h = 0, aromatic = false) => {
    mol.atoms.push({ el, h, charge: 0, ...(aromatic ? { aromatic: true } : {}) })
    return mol.atoms.length - 1
  }
  const addBond = (a: number, b: number, order: 1 | 2 | 3) => {
    if (free(a) < order - 0.01 || free(b) < order - 0.01) {
      const culprit = free(a) < order - 0.01 ? a : b
      throw new ChemParseError(`Too many bonds on ${mol.atoms[culprit].el}.`)
    }
    mol.bonds.push({ a, b, order })
  }
  const attachPoint = (backbone: number[]) => {
    for (let k = backbone.length - 1; k >= 0; k -= 1) {
      if (free(backbone[k]) > 0.5) return backbone[k]
    }
    return -1
  }
  const readCount = () => {
    const tk = toks[pos]
    if (tk && tk.t === 'num') {
      pos += 1
      return tk.n
    }
    return 1
  }
  /** Turn spare bonds on both ends of a bond into a double/triple bond. */
  const resolveMultiple = (fromBond: number, leaveAlone = -1) => {
    for (let bi = fromBond; bi < mol.bonds.length; bi += 1) {
      const b = mol.bonds[bi]
      if (b.aromatic || b.a === leaveAlone || b.b === leaveAlone) continue
      const inc = Math.floor(Math.min(free(b.a), free(b.b), 3 - b.order) + 0.01)
      if (inc > 0) b.order = (b.order + inc) as 1 | 2 | 3
    }
  }

  const connect = (atom: number, backbone: number[], autoOrder: (target: number) => 1 | 2 | 3) => {
    const target = attachPoint(backbone)
    if (target < 0 && backbone.length > 0) {
      throw new ChemParseError(`No free bond left to attach ${mol.atoms[atom].el}.`)
    }
    if (target >= 0) {
      addBond(target, atom, pendingOrder || autoOrder(target))
    } else if (pendingOrder > 1) {
      throw new ChemParseError('A bond symbol has nothing before it.')
    }
    pendingOrder = 0
    for (const open of pendingOpen) addBond(open, atom, 1)
    pendingOpen = []
    backbone.push(atom)
  }

  const heavy = (el: string, backbone: number[]) => {
    const count = readCount()
    for (let k = 0; k < count; k += 1) {
      const atom = addAtom(el, pendingH)
      pendingH = 0
      if (k === count - 1) {
        while (pos < toks.length) {
          const tk = toks[pos]
          if (tk.t !== 'el' || tk.el !== 'H') break
          pos += 1
          mol.atoms[atom].h += readCount()
        }
      }
      // O or S with no hydrogen of its own, following an atom with two spare
      // bonds, is a C=O / C=S. Otherwise it is a single-bonded link (-O-, -OH).
      connect(atom, backbone, (target) =>
        (el === 'O' || el === 'S') && mol.atoms[atom].h === 0 && free(target) >= 2 ? 2 : 1,
      )
    }
  }

  const phenyl = (backbone: number[]) => {
    const ring = [0, 1, 2, 3, 4, 5].map((k) => addAtom('C', k === 0 ? 0 : 1, true))
    ring.forEach((a, k) => mol.bonds.push({ a, b: ring[(k + 1) % 6], order: 1, aromatic: true }))
    connect(ring[0], backbone, () => 1)
  }

  const carboxylStart = (backbone: number[]) => {
    const c = addAtom('C')
    addBond(c, addAtom('O'), 2)
    addBond(c, addAtom('O', 1), 1)
    connect(c, backbone, () => 1)
  }

  const alkyl = (n: number, backbone: number[]) => {
    const leading = attachPoint(backbone) < 0
    let prev = -1
    for (let k = 0; k < n; k += 1) {
      const isMethylEnd = leading ? k === 0 : k === n - 1
      const c = addAtom('C', isMethylEnd ? 3 : 2)
      if (k === 0) {
        connect(c, backbone, () => 1)
      } else {
        addBond(prev, c, 1)
        backbone.push(c)
      }
      prev = c
    }
  }

  const group = (backbone: number[]) => {
    const start = pos
    const target = attachPoint(backbone)
    if (target < 0 && backbone.length > 0) {
      throw new ChemParseError('No free bond left to attach the bracketed group.')
    }
    const runOnce = (inner: number[]) => {
      const firstBond = mol.bonds.length
      pos = start
      parseSeq(inner, true)
      pos += 1 // the ')'
      // Settle bonds inside the group (e.g. the triple bond of CN), but leave the
      // atom the group hangs from alone: it may still need its spare bonds.
      resolveMultiple(firstBond, inner.length > 0 && inner[0] === target ? target : -1)
      return inner
    }

    if (target >= 0) {
      let inner = runOnce([target])
      const count = readCount()
      const after = pos
      const last = inner[inner.length - 1]
      // (CH2)4 leaves a free bond, so it is a run of chain links.
      // (CH3)2 or (OH) is used up, so it is a branch on the atom before it.
      const isChain = inner.length > 1 && free(last) > 0.5
      for (let k = 1; k < count; k += 1) {
        inner = runOnce([isChain ? inner[inner.length - 1] : target])
      }
      pos = after
      if (isChain) backbone.push(...inner.slice(1))
      return
    }

    // Leading group, e.g. (CH3)3 in (CH3)3CCl: hold its open atom for the next atom.
    const held = pendingOpen
    const opens: number[] = []
    let count = 1
    let after = pos
    for (let k = 0; k < count; k += 1) {
      pendingOpen = []
      const inner = runOnce([])
      if (k === 0) {
        count = readCount()
        after = pos
      }
      const open = attachPoint(inner)
      if (open < 0 || pendingOpen.length > 0) {
        throw new ChemParseError('A bracketed group at the start has no free bond to join the rest.')
      }
      opens.push(open)
    }
    pos = after
    pendingOpen = [...held, ...opens]
  }

  function parseSeq(backbone: number[], nested: boolean) {
    while (pos < toks.length) {
      const tk = toks[pos]
      if (tk.t === 'close') {
        if (!nested) throw new ChemParseError('Unmatched ")".')
        return
      }
      pos += 1
      switch (tk.t) {
        case 'bond':
          pendingOrder = tk.order
          break
        case 'el':
          if (tk.el === 'H') pendingH += readCount()
          else heavy(tk.el, backbone)
          break
        case 'phenyl':
          phenyl(backbone)
          break
        case 'carboxylStart':
          carboxylStart(backbone)
          break
        case 'alkyl':
          alkyl(tk.n, backbone)
          break
        case 'open':
          group(backbone)
          break
        case 'num':
          throw new ChemParseError(`Unexpected number ${tk.n}.`)
      }
    }
    if (nested) throw new ChemParseError('Missing ")".')
  }

  parseSeq([], false)

  if (mol.atoms.length === 0) throw new ChemParseError('No atoms found in formula.')
  if (pendingOpen.length > 0 || pendingH > 0) {
    throw new ChemParseError('The formula ends before a group is attached to anything.')
  }

  resolveMultiple(0)

  mol.atoms.forEach((atom, i) => {
    const spare = free(i)
    if (Math.abs(spare) > 0.01) {
      const group = `${atom.el}${atom.h > 0 ? `H${atom.h > 1 ? atom.h : ''}` : ''}`
      throw new ChemParseError(
        spare > 0
          ? `Bonds do not add up at ${group}: ${spare} bond${spare === 1 ? '' : 's'} unused. Check the formula, or use SMILES.`
          : `Bonds do not add up at ${group}: too many bonds.`,
      )
    }
  })

  return mol
}
