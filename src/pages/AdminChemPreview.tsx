import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Molecule } from '@/components/chem/Molecule'
import { ScienceText } from '@/components/chem/ScienceText'
import { MoleculeInsertButton } from '@/components/admin/MoleculeInsertButton'
import { buildMolDrawing, type MolStyle } from '@/lib/chem/draw'
import { SYLLABUS_MOLECULES } from '@/lib/chem/syllabusMolecules'

const STYLES: MolStyle[] = ['skeletal', 'structural', 'displayed']

const SAMPLE_TEXT =
  'The diagram shows three esters. [[mol:CH3CH2COOCH2CH2CH3|label=S]] [[mol:CH3CH2CH2COOCH2CH2CH3|label=T]] [[mol:CH3CH2CH2COOCH2CH2CH2CH3|label=U]] Which could form from propan-1-ol?'

/**
 * Check page for the molecule drawing engine: a box to try any formula, a
 * sample of the [[mol:...]] tag inside question text, and every reference
 * molecule in all three styles.
 */
export default function AdminChemPreview() {
  const [input, setInput] = useState('CH3CH(OH)CH2CH3')
  const [sample, setSample] = useState(SAMPLE_TEXT)

  const groups = useMemo(() => {
    const map = new Map<string, typeof SYLLABUS_MOLECULES>()
    for (const m of SYLLABUS_MOLECULES) map.set(m.group, [...(map.get(m.group) ?? []), m])
    return [...map.entries()]
  }, [])

  const fallbackCount = useMemo(
    () =>
      SYLLABUS_MOLECULES.filter((m) => buildMolDrawing(m.formula ?? m.smiles, { style: 'skeletal' }).fallbackSmiles)
        .length,
    [],
  )

  return (
    <div className="relative z-10 h-screen overflow-y-auto bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Molecule drawing check</h1>
            <p className="text-white/60 text-sm mt-1">
              {SYLLABUS_MOLECULES.length} reference molecules. {fallbackCount} use the old fallback drawer.
            </p>
          </div>
          <Link to="/admin/dashboard" className="text-cyan-300 text-sm hover:underline">
            Back to dashboard
          </Link>
        </header>

        <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
          <h2 className="font-semibold">Try a formula</h2>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 font-mono text-sm"
            placeholder="CH3CH2OH or SMILES such as c1ccccc1"
          />
          <div className="flex flex-wrap gap-4 items-start">
            {STYLES.map((style) => (
              <div key={style} className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-white/50">{style}</div>
                <Molecule input={input} style={style} />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
          <h2 className="font-semibold">Tag inside question text</h2>
          <textarea
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            spellCheck={false}
            rows={3}
            className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 font-mono text-xs"
          />
          <div className="flex justify-end">
            <MoleculeInsertButton value={sample} onChange={setSample} />
          </div>
          <div className="rounded-lg bg-slate-800/60 p-4">
            <ScienceText text={sample} />
          </div>
        </section>

        {groups.map(([group, molecules]) => (
          <section key={group} className="space-y-3">
            <h2 className="font-semibold text-lg">{group}</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {molecules.map((m) => (
                <div key={m.name} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <span className="font-medium">{m.name}</span>
                    <span className="font-mono text-xs text-white/50 truncate">{m.formula ?? m.smiles}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {STYLES.map((style) => (
                      <Molecule key={style} input={m.formula ?? m.smiles} style={style} size="sm" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
