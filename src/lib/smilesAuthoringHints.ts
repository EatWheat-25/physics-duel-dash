/**
 * Lightweight checks for common authoring mistakes in SMILES-only fields.
 * Invalid SMILES is still surfaced by SmilesDrawer in the live preview.
 */

const EMPIRICAL_AS_NOT_SMILES = new Set(
  [
    'c6h6',
    'c6h12',
    'c6h5oh',
    'c2h6',
    'c2h4',
    'c2h2',
    'c2h5oh',
    'c3h8',
    'c3h6',
    'c3h4',
    'c4h10',
    'c4h8',
    'c4h6',
    'ch4',
    'ch3oh',
    'h2o',
    'co2',
    'nh3',
  ].map((s) => s.toLowerCase())
)

export function smilesAuthoringWarnings(fieldLabel: string, raw: string | null | undefined): string[] {
  const s = String(raw ?? '').trim()
  if (!s) return []

  const w: string[] = []
  const lower = s.toLowerCase()

  if (/\[\[smiles:/i.test(s)) {
    w.push(
      `${fieldLabel}: this field expects raw SMILES only. Use [[smiles:...]] inside stem/prompt/option text instead.`
    )
  }

  if (/\\ce\{/.test(s) || /\$\$?\\ce/.test(s)) {
    w.push(
      `${fieldLabel}: found mhchem (\\ce{...}). Equations belong in text with \\(\\ce{...}\\); structures use SMILES here.`
    )
  }

  if (EMPIRICAL_AS_NOT_SMILES.has(lower.replace(/\s+/g, ''))) {
    w.push(
      `${fieldLabel}: "${s}" looks like a molecular formula, not SMILES. Use a preset (e.g. benzene → c1ccccc1) or paste SMILES from PubChem/ChemDraw.`
    )
  }

  // Kekulé benzene: not wrong, but hint for Cambridge-style circle
  if (/^c1=cc=cc=c1$/i.test(s.replace(/\s+/g, '')) || /^C1=CC=CC=C1$/.test(s.trim())) {
    w.push(
      `${fieldLabel}: for aromatic circle style, prefer lowercase aromatic SMILES: c1ccccc1`
    )
  }

  return w
}
