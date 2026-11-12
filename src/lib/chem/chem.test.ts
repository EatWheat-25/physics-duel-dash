import { describe, expect, it } from 'vitest'
import { expandHydrogens, signature, toSmiles } from './graph'
import { layoutGrid, layoutZigzag } from './layout'
import { parseCondensed } from './parseCondensed'
import { parseSmiles } from './parseSmiles'
import { buildMolDrawing, findMolTags, formatMolTag, parseMolInput, parseMolTag } from './draw'
import { SYLLABUS_MOLECULES } from './syllabusMolecules'

const withFormula = SYLLABUS_MOLECULES.filter((m) => m.formula)

describe('structural formula reader', () => {
  it.each(withFormula.map((m) => [m.name, m.formula as string, m.smiles]))(
    '%s: %s matches %s',
    (_name, formula, smiles) => {
      expect(signature(parseCondensed(formula))).toBe(signature(parseSmiles(smiles)))
    },
  )

  it.each([
    ['CH3CHOHCH3', 'CC(O)C'],
    ['CH3-CH2-OH', 'CCO'],
    ['CH₃CH₂OH', 'CCO'],
    ['CH2CHCH3', 'C=CC'],
    ['CH3CH2CH(CH3)CH(CH3)2', 'CCC(C)C(C)C'],
    ['(C2H5)2O', 'CCOCC'],
    ['CH3C(=O)CH3', 'CC(=O)C'],
    ['CO2', 'O=C=O'],
    ['CH3CH(CN)CH3', 'CC(C#N)C'],
    ['HOOCCH2CH(NH2)COOH', 'OC(=O)CC(N)C(=O)O'],
    ['CH2ClCH2Cl', 'ClCCCl'],
    ['CH3COCH2COCH3', 'CC(=O)CC(=O)C'],
  ])('%s matches %s', (formula, smiles) => {
    expect(signature(parseCondensed(formula))).toBe(signature(parseSmiles(smiles)))
  })

  it('tells isomers apart', () => {
    expect(signature(parseCondensed('CH3CH2CH2OH'))).not.toBe(signature(parseCondensed('CH3CH(OH)CH3')))
    expect(signature(parseCondensed('CH3COOCH3'))).not.toBe(signature(parseCondensed('CH3CH2COOH')))
  })

  it.each(['C4H8O2', 'C2H4', 'CH3CH2', 'CH5', 'CH3CH(OH', 'CH3)CH3', 'CH3XCH3', ''])(
    'rejects %s instead of guessing',
    (bad) => {
      expect(() => parseCondensed(bad)).toThrow()
    },
  )
})

describe('SMILES reader', () => {
  it('fills in hydrogens', () => {
    const ethanol = parseSmiles('CCO')
    expect(ethanol.atoms.map((a) => a.h)).toEqual([3, 2, 1])
    const benzene = parseSmiles('c1ccccc1')
    expect(benzene.atoms.every((a) => a.h === 1 && a.aromatic)).toBe(true)
    expect(benzene.bonds).toHaveLength(6)
  })

  it('reads charges and bracket hydrogens', () => {
    const ammonium = parseSmiles('[NH4+]')
    expect(ammonium.atoms[0]).toMatchObject({ el: 'N', h: 4, charge: 1 })
    const nitro = parseSmiles('O=[N+]([O-])c1ccccc1')
    expect(nitro.atoms[1].charge).toBe(1)
    expect(nitro.atoms[2].charge).toBe(-1)
  })

  it.each(['C1CC', 'C(C', 'CC)', 'C.C', 'CXC'])('rejects %s', (bad) => {
    expect(() => parseSmiles(bad)).toThrow()
  })

  it.each(SYLLABUS_MOLECULES.map((m) => [m.name, m.smiles]))('%s survives a round trip', (_name, smiles) => {
    const mol = parseSmiles(smiles)
    expect(signature(parseSmiles(toSmiles(mol)))).toBe(signature(mol))
  })
})

describe('input detection', () => {
  it('picks the right reader', () => {
    expect(signature(parseMolInput('CCO'))).toBe(signature(parseMolInput('CH3CH2OH')))
    expect(signature(parseMolInput('CCl4'))).toBe(signature(parseSmiles('ClC(Cl)(Cl)Cl')))
    expect(signature(parseMolInput('CO2'))).toBe(signature(parseSmiles('O=C=O')))
  })

  it('reads tag options', () => {
    expect(parseMolTag('CH3CH(OH)CH3 | style=displayed | label=S | rotate=30 | flip')).toEqual({
      input: 'CH3CH(OH)CH3',
      style: 'displayed',
      kind: 'auto',
      label: 'S',
      rotate: 30,
      flip: true,
    })
    expect(parseMolTag('C=C').style).toBe('skeletal')
  })
})

describe('layout', () => {
  const minGap = (pts: { x: number; y: number }[]) => {
    let best = Infinity
    for (let i = 0; i < pts.length; i += 1) {
      for (let j = i + 1; j < pts.length; j += 1) {
        best = Math.min(best, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y))
      }
    }
    return best
  }

  it.each(SYLLABUS_MOLECULES.map((m) => [m.name, m.smiles]))('%s: skeletal layout has no clashes', (_n, smiles) => {
    const mol = parseSmiles(smiles)
    const layout = layoutZigzag(mol)
    expect(layout).not.toBeNull()
    expect(layout?.overlap).toBe(false)
    // Every bond is one unit long.
    for (const b of mol.bonds) {
      const pa = layout!.pos[b.a]
      const pb = layout!.pos[b.b]
      expect(Math.hypot(pa.x - pb.x, pa.y - pb.y)).toBeCloseTo(1, 5)
    }
  })

  const acyclic = SYLLABUS_MOLECULES.filter((m) => !/\d/.test(m.smiles))
  it.each(acyclic.map((m) => [m.name, m.smiles]))('%s: displayed layout has no clashes', (_n, smiles) => {
    const pts = layoutGrid(expandHydrogens(parseSmiles(smiles)))
    expect(pts).not.toBeNull()
    expect(minGap(pts!)).toBeGreaterThan(0.69)
  })

  it.each(acyclic.map((m) => [m.name, m.smiles]))('%s: structural layout has no clashes', (_n, smiles) => {
    const pts = layoutGrid(parseSmiles(smiles))
    expect(pts).not.toBeNull()
    if (pts!.length > 1) expect(minGap(pts!)).toBeGreaterThan(0.69)
  })
})

describe('drawing', () => {
  it.each(SYLLABUS_MOLECULES.map((m) => [m.name, m.formula ?? m.smiles]))('%s draws in every style', (_n, input) => {
    for (const style of ['skeletal', 'structural', 'displayed'] as const) {
      const result = buildMolDrawing(input, { style })
      expect(result.error).toBeUndefined()
      expect(result.drawing).toBeDefined()
      expect(result.drawing!.width).toBeGreaterThan(0)
      const numbers = [
        ...result.drawing!.lines.flatMap((l) => [l.x1, l.y1, l.x2, l.y2]),
        ...result.drawing!.texts.flatMap((t) => [t.x, t.y]),
      ]
      expect(numbers.every(Number.isFinite)).toBe(true)
    }
  })

  it('reports unreadable input as an error, not a crash', () => {
    expect(buildMolDrawing('C4H8O2').error).toMatch(/molecular formula/)
    expect(buildMolDrawing('').error).toBeDefined()
  })
})

describe('tag text', () => {
  it('writes a tag that reads back the same', () => {
    const tag = { input: 'CH3CH(OH)CH3', style: 'displayed', kind: 'auto', label: 'S', rotate: 30, flip: true } as const
    expect(formatMolTag(tag)).toBe('[[mol:CH3CH(OH)CH3|style=displayed|label=S|rotate=30|flip]]')
    expect(findMolTags(`before ${formatMolTag(tag)} after`)[0].tag).toEqual(tag)
    expect(formatMolTag({ input: 'CCO', style: 'skeletal', kind: 'auto' })).toBe('[[mol:CCO]]')
  })

  it('finds every tag, including SMILES ending in a bracket', () => {
    const text = 'X [[mol:CC[O-]]] and [[mol:CH3OH|label=T]] done'
    const found = findMolTags(text)
    expect(found.map((f) => f.tag.input)).toEqual(['CC[O-]', 'CH3OH'])
    expect(text.slice(found[1].start, found[1].end)).toBe('[[mol:CH3OH|label=T]]')
  })
})
