/**
 * Reference set of A-level molecules. The gallery page draws every one in all
 * three styles, and the tests check that each formula and its SMILES describe
 * the same structure.
 */
export interface SyllabusMolecule {
  name: string
  group: string
  formula?: string
  smiles: string
}

export const SYLLABUS_MOLECULES: SyllabusMolecule[] = [
  { group: 'Alkanes', name: 'methane', formula: 'CH4', smiles: 'C' },
  { group: 'Alkanes', name: 'ethane', formula: 'CH3CH3', smiles: 'CC' },
  { group: 'Alkanes', name: 'propane', formula: 'CH3CH2CH3', smiles: 'CCC' },
  { group: 'Alkanes', name: 'butane', formula: 'CH3CH2CH2CH3', smiles: 'CCCC' },
  { group: 'Alkanes', name: 'hexane', formula: 'CH3(CH2)4CH3', smiles: 'CCCCCC' },
  { group: 'Alkanes', name: '2-methylpropane', formula: 'CH3CH(CH3)CH3', smiles: 'CC(C)C' },
  { group: 'Alkanes', name: '2,2-dimethylpropane', formula: 'C(CH3)4', smiles: 'CC(C)(C)C' },
  { group: 'Alkanes', name: '2,3-dimethylbutane', formula: 'CH3CH(CH3)CH(CH3)CH3', smiles: 'CC(C)C(C)C' },
  { group: 'Alkanes', name: '2,2,4-trimethylpentane', formula: '(CH3)3CCH2CH(CH3)2', smiles: 'CC(C)(C)CC(C)C' },

  { group: 'Alkenes and alkynes', name: 'ethene', formula: 'CH2=CH2', smiles: 'C=C' },
  { group: 'Alkenes and alkynes', name: 'propene', formula: 'CH3CH=CH2', smiles: 'CC=C' },
  { group: 'Alkenes and alkynes', name: 'but-2-ene', formula: 'CH3CH=CHCH3', smiles: 'CC=CC' },
  { group: 'Alkenes and alkynes', name: '2-methylpropene', formula: '(CH3)2C=CH2', smiles: 'CC(C)=C' },
  { group: 'Alkenes and alkynes', name: 'buta-1,3-diene', formula: 'CH2=CHCH=CH2', smiles: 'C=CC=C' },
  { group: 'Alkenes and alkynes', name: 'chloroethene', formula: 'CH2=CHCl', smiles: 'C=CCl' },
  { group: 'Alkenes and alkynes', name: 'ethyne', formula: 'CH≡CH', smiles: 'C#C' },
  { group: 'Alkenes and alkynes', name: 'propyne', formula: 'CH3C≡CH', smiles: 'CC#C' },

  { group: 'Halogenoalkanes', name: 'chloromethane', formula: 'CH3Cl', smiles: 'CCl' },
  { group: 'Halogenoalkanes', name: 'trichloromethane', formula: 'CHCl3', smiles: 'ClC(Cl)Cl' },
  { group: 'Halogenoalkanes', name: 'tetrachloromethane', formula: 'CCl4', smiles: 'ClC(Cl)(Cl)Cl' },
  { group: 'Halogenoalkanes', name: '1-bromobutane', formula: 'CH3CH2CH2CH2Br', smiles: 'CCCCBr' },
  { group: 'Halogenoalkanes', name: '2-bromobutane', formula: 'CH3CHBrCH2CH3', smiles: 'CC(Br)CC' },
  { group: 'Halogenoalkanes', name: '1,2-dibromoethane', formula: 'CH2BrCH2Br', smiles: 'BrCCBr' },
  { group: 'Halogenoalkanes', name: '2-chloro-2-methylpropane', formula: '(CH3)3CCl', smiles: 'CC(C)(C)Cl' },

  { group: 'Alcohols and ethers', name: 'methanol', formula: 'CH3OH', smiles: 'CO' },
  { group: 'Alcohols and ethers', name: 'ethanol', formula: 'C2H5OH', smiles: 'CCO' },
  { group: 'Alcohols and ethers', name: 'propan-2-ol', formula: 'CH3CH(OH)CH3', smiles: 'CC(O)C' },
  { group: 'Alcohols and ethers', name: 'pentan-2-ol', formula: 'CH3CH(OH)CH2CH2CH3', smiles: 'CC(O)CCC' },
  { group: 'Alcohols and ethers', name: '2-methylpropan-2-ol', formula: '(CH3)3COH', smiles: 'CC(C)(C)O' },
  { group: 'Alcohols and ethers', name: 'ethane-1,2-diol', formula: 'HOCH2CH2OH', smiles: 'OCCO' },
  { group: 'Alcohols and ethers', name: 'propane-1,2,3-triol', formula: 'CH2OHCH(OH)CH2OH', smiles: 'OCC(O)CO' },
  { group: 'Alcohols and ethers', name: 'methoxymethane', formula: 'CH3OCH3', smiles: 'COC' },

  { group: 'Aldehydes and ketones', name: 'methanal', formula: 'HCHO', smiles: 'C=O' },
  { group: 'Aldehydes and ketones', name: 'ethanal', formula: 'CH3CHO', smiles: 'CC=O' },
  { group: 'Aldehydes and ketones', name: 'propanone', formula: 'CH3COCH3', smiles: 'CC(=O)C' },
  { group: 'Aldehydes and ketones', name: 'butanone', formula: 'CH3COCH2CH3', smiles: 'CC(=O)CC' },
  { group: 'Aldehydes and ketones', name: 'pentan-3-one', formula: 'CH3CH2COCH2CH3', smiles: 'CCC(=O)CC' },

  { group: 'Acids and derivatives', name: 'methanoic acid', formula: 'HCOOH', smiles: 'OC=O' },
  { group: 'Acids and derivatives', name: 'ethanoic acid', formula: 'CH3COOH', smiles: 'CC(=O)O' },
  { group: 'Acids and derivatives', name: 'propanoic acid', formula: 'CH3CH2CO2H', smiles: 'CCC(=O)O' },
  { group: 'Acids and derivatives', name: 'ethanedioic acid', formula: 'HOOCCOOH', smiles: 'OC(=O)C(=O)O' },
  { group: 'Acids and derivatives', name: 'hexanedioic acid', formula: 'HOOC(CH2)4COOH', smiles: 'OC(=O)CCCCC(=O)O' },
  { group: 'Acids and derivatives', name: '2-hydroxypropanoic acid', formula: 'CH3CH(OH)COOH', smiles: 'CC(O)C(=O)O' },
  { group: 'Acids and derivatives', name: 'methyl ethanoate', formula: 'CH3COOCH3', smiles: 'CC(=O)OC' },
  { group: 'Acids and derivatives', name: 'ethyl ethanoate', formula: 'CH3COOC2H5', smiles: 'CC(=O)OCC' },
  { group: 'Acids and derivatives', name: 'propyl propanoate', formula: 'CH3CH2CO2CH2CH2CH3', smiles: 'CCC(=O)OCCC' },
  { group: 'Acids and derivatives', name: 'ethanoyl chloride', formula: 'CH3COCl', smiles: 'CC(=O)Cl' },

  { group: 'Nitrogen compounds', name: 'methylamine', formula: 'CH3NH2', smiles: 'CN' },
  { group: 'Nitrogen compounds', name: 'ethylamine', formula: 'CH3CH2NH2', smiles: 'CCN' },
  { group: 'Nitrogen compounds', name: 'trimethylamine', formula: '(CH3)3N', smiles: 'CN(C)C' },
  { group: 'Nitrogen compounds', name: 'ethanamide', formula: 'CH3CONH2', smiles: 'CC(=O)N' },
  { group: 'Nitrogen compounds', name: 'hydrogen cyanide', formula: 'HCN', smiles: 'C#N' },
  { group: 'Nitrogen compounds', name: 'ethanenitrile', formula: 'CH3CN', smiles: 'CC#N' },
  { group: 'Nitrogen compounds', name: '2,2-dimethylpropanenitrile', formula: '(CH3)3CCN', smiles: 'CC(C)(C)C#N' },
  { group: 'Nitrogen compounds', name: '2-hydroxypropanenitrile', formula: 'CH3CH(OH)CN', smiles: 'CC(O)C#N' },
  { group: 'Nitrogen compounds', name: 'glycine', formula: 'H2NCH2COOH', smiles: 'NCC(=O)O' },
  { group: 'Nitrogen compounds', name: 'alanine', formula: 'CH3CH(NH2)COOH', smiles: 'CC(N)C(=O)O' },

  { group: 'Rings', name: 'benzene', smiles: 'c1ccccc1' },
  { group: 'Rings', name: 'methylbenzene', formula: 'C6H5CH3', smiles: 'c1ccccc1C' },
  { group: 'Rings', name: 'phenol', formula: 'C6H5OH', smiles: 'c1ccccc1O' },
  { group: 'Rings', name: 'benzoic acid', formula: 'C6H5COOH', smiles: 'c1ccccc1C(=O)O' },
  { group: 'Rings', name: 'phenylamine', formula: 'C6H5NH2', smiles: 'c1ccccc1N' },
  { group: 'Rings', name: 'phenylethene', formula: 'C6H5CH=CH2', smiles: 'c1ccccc1C=C' },
  { group: 'Rings', name: 'phenylethanone', formula: 'CH3COC6H5', smiles: 'CC(=O)c1ccccc1' },
  { group: 'Rings', name: 'nitrobenzene', smiles: 'O=[N+]([O-])c1ccccc1' },
  { group: 'Rings', name: 'benzene (Kekulé)', smiles: 'C1=CC=CC=C1' },
  { group: 'Rings', name: 'cyclohexane', smiles: 'C1CCCCC1' },
  { group: 'Rings', name: 'cyclohexene', smiles: 'C1=CCCCC1' },
  { group: 'Rings', name: 'cyclopentane', smiles: 'C1CCCC1' },
  { group: 'Rings', name: 'naphthalene', smiles: 'c1ccc2ccccc2c1' },
  { group: 'Rings', name: 'aspirin', smiles: 'CC(=O)Oc1ccccc1C(=O)O' },
  { group: 'Rings', name: 'limonene', smiles: 'CC1=CCC(CC1)C(C)=C' },
  { group: 'Rings', name: 'retinol', smiles: 'CC1=C(C(CCC1)(C)C)C=CC(C)=CC=CC(C)=CCO' },
]
