## Chemistry authoring (Cambridge A-Level style)

This project supports:

- **Chemical equations** via KaTeX **mhchem** using `\ce{...}`
- **Skeletal / structural diagrams** via **SMILES** (rendered client-side)

### 1) Writing chemistry equations (mhchem)

In any text field (`stem`, step `prompt`, step `options`, `explanation`) wrap mhchem in math delimiters:

- **Inline (recommended for options/buttons):** `\(\ce{...}\)`
- **Block (recommended for long equations in stems):** `$$\ce{...}$$`

Examples:

- Net ionic: `\(\ce{Ba^2+(aq) + SO4^2-(aq) -> BaSO4(s)}\)`
- Equilibrium: `\(\ce{N2(g) + 3H2(g) <=> 2NH3(g)}\)`
- Conditions: `\(\ce{CaCO3(s) ->[\Delta] CaO(s) + CO2(g)}\)`
- Redox half-equation: `\(\ce{Cr2O7^2- + 14H+ + 6e- -> 2Cr^3+ + 7H2O}\)`

### 2) Skeletal structures (SMILES)

You have three options:

1) **Main question structure** (renders under the main stem): set `questions_v2.structure_smiles`.
2) **Step diagram structure**: set `diagramSmiles` inside that step object in `steps`.
3) **Inline token inside any text**: `[[smiles:c1ccccc1]]`.

Common SMILES:

- Benzene (aromatic, draws a circle in the ring): `c1ccccc1`
- Benzene (non-aromatic form, may draw alternating double bonds): `C1=CC=CC=C1`
- Ethanol: `CCO`
- Ethene: `C=C`

### 2.1) Admin panel: presets and validation

In **Admin → Questions**, when **Subject** is **chemistry**:

- **Structure SMILES** (main diagram under the stem) and each step’s **Diagram SMILES** include an **Insert preset** dropdown. Pick a name (e.g. “Benzene (aromatic)”) to paste canonical SMILES such as `c1ccccc1`.
- The **live preview** under each field uses the same renderer as the game; parse errors appear under the preview if SMILES is invalid.
- The **Chemistry helper** panel lists **Authoring warnings** for common mistakes (e.g. pasting a molecular formula like `C6H6` into a SMILES field, or putting `[[smiles:...]]` / raw `\ce{...}` in those fields).

For arbitrary structures not in the preset list, paste SMILES from PubChem, ChemDraw (“Copy as SMILES”), or similar. A future option is a name-to-SMILES API behind the admin; the game still stores and renders **SMILES** only.

### 3) “SQL inserted but not showing” — common causes

- **Insert failed**: `gen_random_uuid()` can fail if the SQL editor session doesn’t have it in `search_path`.
  - Easiest fix: **omit `id`** from the insert (let the table default generate it), and use deterministic string step ids (`step-0`, `step-1`).
- **Wrong Supabase project**: the app is pointing at a different `SUPABASE_URL` than the SQL editor project.
- **Admin filters/search hiding it**: reset filters + clear search.
- **Row can’t be parsed**: the Admin list may skip rows that fail mapping (check Admin → Diagnostics).

### 4) Hardened SQL template (no extensions, Cambridge-friendly)

This template:

- avoids `gen_random_uuid()` entirely
- uses inline-safe `\(\ce{...}\)` for options
- includes an example benzene structure

```sql
insert into public.questions_v2 (
  title, subject, chapter, level, difficulty, rank_tier,
  stem, main_question_timer_seconds,
  total_marks, topic_tags,
  steps,
  structure_smiles,
  is_enabled, is_done
) values (
  'Chem: Net ionic (BaSO4)',
  'chemistry',
  'Inorganic Chemistry',
  'A2',
  'easy',
  'Bronze',
  $stem$
Identify the correct net ionic equation for the formation of a barium sulfate precipitate when aqueous barium chloride is mixed with aqueous sodium sulfate.
$stem$,
  120,
  1,
  array['precipitation','ionic-equations','mhchem'],
  jsonb_build_array(
    jsonb_build_object(
      'id','step-0',
      'index',0,
      'type','mcq',
      'title','Select the equation',
      'prompt',$p$Which equation accurately represents this reaction?$p$,
      'options', jsonb_build_array(
        $opt$\(\ce{Ba^2+(aq) + SO4^2-(aq) -> BaSO4(s)}\)$opt$,
        $opt$\(\ce{BaCl2(aq) + Na2SO4(aq) -> BaSO4(s) + 2NaCl(aq)}\)$opt$,
        $opt$\(\ce{Ba(s) + H2SO4(aq) -> BaSO4(s) + H2(g)}\)$opt$,
        $opt$\(\ce{Ba^2+(aq) + S^2-(aq) + 2O2(g) -> BaSO4(s)}\)$opt$
      ),
      'correctAnswer',0,
      'timeLimitSeconds',15,
      'marks',1,
      'explanation',$exp$Net ionic equations omit spectator ions (e.g. \(\ce{Na+}\), \(\ce{Cl-}\)).$exp$
    )
  ),
  null,
  true,
  false
);

insert into public.questions_v2 (
  title, subject, chapter, level, difficulty,
  stem, main_question_timer_seconds,
  total_marks, topic_tags,
  steps,
  structure_smiles,
  is_enabled, is_done
) values (
  'Chem: Benzene structure',
  'chemistry',
  'Organic Basics',
  'A2',
  'easy',
  $stem$Benzene has formula \(\ce{C6H6}\). A skeletal structure is shown below.$stem$,
  120,
  1,
  array['benzene','aromatics','smiles'],
  jsonb_build_array(
    jsonb_build_object(
      'id','step-0',
      'index',0,
      'type','mcq',
      'title','Formula check',
      'prompt',$p$Which formula matches benzene?$p$,
      'options', jsonb_build_array(
        $opt$\(\ce{C6H6}\)$opt$,
        $opt$\(\ce{C6H12}\)$opt$,
        $opt$\(\ce{C6H5OH}\)$opt$,
        $opt$\(\ce{C5H6}\)$opt$
      ),
      'correctAnswer',0,
      'timeLimitSeconds',15,
      'marks',1,
      'explanation',null
    )
  ),
  'c1ccccc1',
  true,
  false
);
```

