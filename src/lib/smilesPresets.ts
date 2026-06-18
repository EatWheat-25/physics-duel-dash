/**
 * Curated SMILES for admin authoring. Prefer aromatic lowercase for arenes (e.g. benzene c1ccccc1) so SmilesDrawer can draw the ring circle where supported.
 */
export type SmilesPreset = {
  id: string
  label: string
  smiles: string
}

export const SMILES_PRESETS: SmilesPreset[] = [
  { id: 'benzene-aromatic', label: 'Benzene (aromatic)', smiles: 'c1ccccc1' },
  { id: 'benzene-kekule', label: 'Benzene (Kekulé)', smiles: 'C1=CC=CC=C1' },
  { id: 'toluene', label: 'Toluene', smiles: 'Cc1ccccc1' },
  { id: 'phenol', label: 'Phenol', smiles: 'Oc1ccccc1' },
  { id: 'aniline', label: 'Aniline', smiles: 'Nc1ccccc1' },
  { id: 'benzoic-acid', label: 'Benzoic acid', smiles: 'O=C(O)c1ccccc1' },
  { id: 'nitrobenzene', label: 'Nitrobenzene', smiles: 'O=[N+]([O-])c1ccccc1' },
  { id: 'chlorobenzene', label: 'Chlorobenzene', smiles: 'Clc1ccccc1' },
  { id: 'naphthalene', label: 'Naphthalene', smiles: 'c1ccc2ccccc2c1' },
  { id: 'cyclohexane', label: 'Cyclohexane', smiles: 'C1CCCCC1' },
  { id: 'cyclohexene', label: 'Cyclohexene', smiles: 'C1=CCCCC1' },
  { id: 'methane', label: 'Methane', smiles: 'C' },
  { id: 'ethane', label: 'Ethane', smiles: 'CC' },
  { id: 'ethene', label: 'Ethene', smiles: 'C=C' },
  { id: 'ethyne', label: 'Ethyne', smiles: 'C#C' },
  { id: 'ethanol', label: 'Ethanol', smiles: 'CCO' },
  { id: 'ethanoic-acid', label: 'Ethanoic acid', smiles: 'CC(=O)O' },
  { id: 'acetone', label: 'Propanone (acetone)', smiles: 'CC(=O)C' },
  { id: 'propanal', label: 'Propanal', smiles: 'CCC=O' },
  { id: 'propene', label: 'Propene', smiles: 'CC=C' },
  { id: 'propanoic-acid', label: 'Propanoic acid', smiles: 'CCC(=O)O' },
  { id: 'propane', label: 'Propane', smiles: 'CCC' },
  { id: 'butane', label: 'Butane', smiles: 'CCCC' },
  { id: '2-methylpropane', label: '2-Methylpropane', smiles: 'CC(C)C' },
  { id: 'methylpropene', label: 'Methylpropene (2-methylpropene)', smiles: 'C=C(C)C' },
  { id: 'benzaldehyde', label: 'Benzaldehyde', smiles: 'O=Cc1ccccc1' },
  { id: 'styrene', label: 'Phenylethene (styrene)', smiles: 'C=Cc1ccccc1' },
]
