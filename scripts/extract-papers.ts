/**
 * Whole-paper extractor (PDF source)
 *
 * Reads Cambridge past-paper PDFs from a local folder, pairs each question
 * paper with its mark scheme, sends both to Claude, and saves one structured
 * record per paper containing every question and part. Then builds a review
 * page with links back to the exact PDF pages for checking.
 *
 * The PDFs are the permanent source of truth. Records can be regenerated from
 * them at any time, and nothing here touches a website.
 *
 * Folder layout (standard Cambridge file names, any sub-folders allowed):
 *   papers/9702_s23_qp_22.pdf     question paper
 *   papers/9702_s23_ms_22.pdf     mark scheme
 *   name = <syllabus>_<s|w|m><yy>_<qp|ms>_<paper><variant>.pdf
 *          s = May/June, w = Oct/Nov, m = Feb/March
 *
 * Usage:
 *   npx tsx scripts/extract-papers.ts [flags]
 *   npm run extract:papers -- [flags]
 *
 * Examples:
 *   npm run extract:papers -- --subject=9702 --papers=2,4            (pilot: 2 papers)
 *   npm run extract:papers -- --subject=9709 --limit=all
 *   npm run extract:papers -- --list                                  (count only, free)
 *
 * Flags:
 *   --dir=<folder>       Where the PDFs are (default papers)
 *   --subject=<code>     Only this syllabus code, e.g. 9702 (default: all found)
 *   --papers=<list>      Only these paper numbers, e.g. 2,4 (default: all found)
 *   --from=<year>        Ignore papers before this year, e.g. 2015 (default 2015)
 *   --limit=<n|all>      How many papers to process (default 2)
 *   --model=<id>         Claude model (default claude-opus-5-5)
 *   --concurrency=<n>    Parallel requests (default 2)
 *   --list               Show what would be processed and exit. No API calls.
 *   --review-only        Skip the API; just rebuild review.html
 *
 * Needs ANTHROPIC_API_KEY in .env. Papers already extracted are skipped, so
 * the script is safe to re-run and resume.
 *
 * Output (inside the git-ignored papers folder):
 *   <dir>/_extracted/<paper>.json   one record per paper
 *   <dir>/_extracted/all.json       every question, flattened
 *   <dir>/review.html               checking page
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { mkdir, readFile, writeFile, access, readdir, stat } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';

const MAX_PDF_BYTES = 14 * 1024 * 1024; // two PDFs must fit the 32 MB request limit after base64

const Part = z.object({
  label: z.string().describe('Part label exactly as printed, e.g. "(a)", "(b)(ii)". Empty string if the question has no parts.'),
  text: z.string().describe('Full wording of this part, exactly as printed, without answer lines or mark brackets. Maths and units in LaTeX between $ signs.'),
  marks: z.number().int(),
  topics: z
    .array(z.string())
    .describe('Every syllabus topic a student must have studied to answer this part, copied exactly from the topic list given. Usually one; more when the part genuinely combines topics.'),
  kind: z.enum(['mcq', 'calculation', 'derivation', 'explain', 'define', 'graph_or_drawing', 'data_analysis', 'other']),
  options: z
    .array(z.object({ label: z.string(), text: z.string() }))
    .describe('MCQ options in order. Empty for everything else.'),
  final_answer: z.string().describe('The accepted final answer with unit, from the mark scheme. For MCQ, the correct letter.'),
  mark_points: z.array(z.string()).describe('Each marking point from the mark scheme for this part, one per entry, including the mark code if shown (M1, A1, B1, C1).'),
  archetype: z
    .string()
    .describe('snake_case name for the mechanical operation required, independent of topic, e.g. apply_suvat_single_step, read_gradient_from_graph, differentiate_product.'),
  difficulty: z.number().int().describe('1 (direct recall) to 5 (multi-step, unfamiliar context).'),
});

const Question = z.object({
  number: z.string().describe('Question number as printed, e.g. "3".'),
  subtopic: z.string().describe('Short description of the specific content covered, e.g. "moments about a pivot; projectile energy".'),
  context: z.string().describe('Shared stem that introduces the question before its parts. Empty string if none.'),
  qp_pages: z.array(z.number().int()).describe('1-based PDF page numbers of the question paper where this question appears.'),
  ms_pages: z.array(z.number().int()).describe('1-based PDF page numbers of the mark scheme covering this question.'),
  total_marks: z.number().int(),
  figures: z.array(
    z.object({
      label: z.string().describe('e.g. "Fig. 3.1" or "Table 2.1".'),
      type: z.enum(['graph', 'diagram', 'table', 'photo', 'other']),
      description: z
        .string()
        .describe('Enough detail to redraw it from scratch: axes, labels, units, scales, plotted values, shapes, annotations, table contents.'),
    }),
  ),
  parts: z.array(Part),
  transcription_confidence: z.enum(['high', 'medium', 'low']),
  issues: z.array(z.string()).describe('Anything unreadable, ambiguous, or where the mark scheme could not be matched. Empty if none.'),
});

const PaperExtraction = z.object({
  questions: z.array(Question),
  total_marks: z.number().int().describe('Total marks for the paper as printed on the cover.'),
  notes: z.array(z.string()).describe('Paper-level problems, e.g. the mark scheme does not match the question paper. Empty if none.'),
});
type PaperExtraction = z.infer<typeof PaperExtraction>;

const SYSTEM = `You transcribe Cambridge International AS & A Level exam papers into structured records for a private question database.

You are given a question paper PDF and its mark scheme PDF. Record every question and every part of every question, in order.

Rules:
- Transcribe wording exactly. Do not paraphrase, shorten or correct it.
- Write maths, symbols, chemical formulae and units in LaTeX between $ signs.
- Skip cover pages, instructions, formula and data sheets, blank pages and "additional page" sections.
- Use LaTeX consistently: every quantity with a unit, every symbol and every equation goes between $ signs, in the question text, the answers and the marking points alike.
- Match each part to its mark scheme entry and record the accepted answer and each marking point. Generic marking principles at the front of the mark scheme are not marking points.
- When the mark scheme gives an alternative accepted method, record its marking points too, each prefixed with "ALT: ".
- Describe every figure and table in enough detail that it could be redrawn without seeing the original. Read values off graphs carefully; if a value cannot be read with confidence, say so in "issues" instead of guessing.
- Record the PDF page numbers (counting the first page of each file as 1) so a reviewer can find the original.
- Only report what is in the documents. Leave fields empty when the information is not there.`;

/**
 * Fixed topic lists per syllabus, so every paper is labelled with the same
 * names. Taken from the current Cambridge syllabuses; edit here if a label
 * needs changing. Subjects not listed get free-form topic names.
 */
const TOPICS: Record<string, string[]> = {
  '9702': [
    'Physical quantities and units', 'Kinematics', 'Dynamics', 'Forces, density and pressure',
    'Work, energy and power', 'Deformation of solids', 'Waves', 'Superposition', 'Electricity',
    'D.C. circuits', 'Particle physics', 'Motion in a circle', 'Gravitational fields', 'Temperature',
    'Ideal gases', 'Thermodynamics', 'Oscillations', 'Electric fields', 'Capacitance', 'Magnetic fields',
    'Alternating currents', 'Quantum physics', 'Nuclear physics', 'Medical physics', 'Astronomy and cosmology',
  ],
  '9701': [
    'Atomic structure', 'Atoms, molecules and stoichiometry', 'Chemical bonding', 'States of matter',
    'Chemical energetics', 'Electrochemistry', 'Equilibria', 'Reaction kinetics',
    'The Periodic Table: chemical periodicity', 'Group 2', 'Group 17', 'Nitrogen and sulfur',
    'Chemistry of transition elements', 'Introduction to organic chemistry', 'Hydrocarbons', 'Halogen compounds',
    'Hydroxy compounds', 'Carbonyl compounds', 'Carboxylic acids and derivatives', 'Nitrogen compounds',
    'Polymerisation', 'Organic synthesis', 'Analytical techniques',
  ],
  '9709': [
    'Quadratics', 'Functions', 'Coordinate geometry', 'Circular measure', 'Trigonometry', 'Series',
    'Differentiation', 'Integration', 'Algebra', 'Logarithmic and exponential functions',
    'Numerical solution of equations', 'Vectors', 'Differential equations', 'Complex numbers',
    'Forces and equilibrium', 'Kinematics of motion in a straight line', 'Momentum', "Newton's laws of motion",
    'Energy, work and power', 'Representation of data', 'Permutations and combinations', 'Probability',
    'Discrete random variables', 'The normal distribution', 'The Poisson distribution',
    'Linear combinations of random variables', 'Continuous random variables', 'Sampling and estimation',
    'Hypothesis tests',
  ],
};

/**
 * What each topic covers, so the model files content under the right name
 * (for example moments belong to "Forces, density and pressure", not
 * "Dynamics"). Optional: a subject or topic with no entry is listed by name only.
 */
const TOPIC_GUIDE: Record<string, Record<string, string>> = {
  '9702': {
    'Physical quantities and units': 'SI base units, checking homogeneity of equations, prefixes, estimates, errors and uncertainties, scalars and vectors, resolving and adding vectors',
    'Kinematics': 'displacement, speed, velocity, acceleration, motion graphs, equations of uniformly accelerated motion, free fall, projectile motion',
    'Dynamics': "mass and weight, Newton's laws, F = ma, linear momentum, force as rate of change of momentum, conservation of momentum, collisions, drag and terminal velocity",
    'Forces, density and pressure': 'moments, couples and torque, centre of gravity, equilibrium of forces, triangle of forces, density, pressure, pressure in fluids, upthrust',
    'Work, energy and power': 'work done, conservation of energy, efficiency, gravitational potential energy, kinetic energy, power, P = Fv',
    'Deformation of solids': "stress, strain, Hooke's law, spring constant, Young modulus, elastic and plastic behaviour, elastic potential energy and area under a force-extension graph",
    'Waves': 'progressive waves, v = f lambda, phase difference, intensity, transverse and longitudinal waves, Doppler effect for a moving source and a stationary observer only, electromagnetic spectrum, polarisation',
    'Superposition': 'stationary waves, diffraction, interference, coherence, double-slit experiment, diffraction grating',
    'Electricity': 'current and charge, drift speed I = Anvq, potential difference, electrical power, resistance, resistivity, I-V characteristics, how LDR and thermistor resistance varies',
    'D.C. circuits': "circuit diagrams, e.m.f. and internal resistance, Kirchhoff's laws, resistors in series and parallel, potential dividers, potentiometers",
    'Particle physics': 'AS-level nuclear model: alpha-scattering, nucleon and proton numbers, isotopes, nuclide notation, alpha, beta and gamma radiation, decay equations, quarks, leptons, hadrons, antiparticles, neutrinos',
    'Motion in a circle': 'radians, angular speed, centripetal acceleration, centripetal force',
    'Gravitational fields': "Newton's law of gravitation, gravitational field strength, gravitational potential and potential energy, circular orbits, geostationary satellites",
    'Temperature': 'thermal equilibrium, temperature scales and the kelvin, absolute zero, specific heat capacity, specific latent heat',
    'Ideal gases': 'the mole and Avogadro constant, pV = nRT, kinetic theory of gases, root-mean-square speed, mean kinetic energy of molecules',
    'Thermodynamics': 'internal energy, first law of thermodynamics, work done by or on a gas',
    'Oscillations': 'simple harmonic motion, energy in SHM, damping, forced oscillations, resonance',
    'Electric fields': "electric field lines, uniform fields between plates, Coulomb's law, electric field strength, electric potential and potential energy",
    'Capacitance': 'capacitance, capacitors in series and parallel, energy stored, discharge through a resistor, time constant',
    'Magnetic fields': "force on a current-carrying conductor, force on a moving charge, Hall effect, velocity selection, fields due to currents, magnetic flux and flux linkage, electromagnetic induction, Faraday's and Lenz's laws",
    'Alternating currents': 'peak and r.m.s. values, power in a.c. circuits, half-wave and full-wave rectification, smoothing',
    'Quantum physics': 'photons, photoelectric effect, photon momentum, wave-particle duality, de Broglie wavelength, energy levels in atoms, line spectra',
    'Nuclear physics': 'A-level nuclear: mass defect, binding energy, mass-energy equivalence, fission and fusion, radioactive decay law, activity, decay constant, half-life',
    'Medical physics': 'ultrasound production and use, acoustic impedance, X-ray production, X-ray attenuation, CT scanning, PET scanning',
    'Astronomy and cosmology': "luminosity, radiant flux intensity, standard candles, Wien's displacement law, Stefan-Boltzmann law, stellar radii, redshift, Hubble's law, the Big Bang",
  },
};

const SESSIONS: Record<string, string> = { s: 'May/June', w: 'Oct/Nov', m: 'Feb/March' };

interface PaperFile {
  key: string; // e.g. 9702_s23_22
  subject: string;
  session: string;
  year: number;
  paper: string;
  variant: string;
  qp: string;
  ms: string | null;
}

interface Options {
  dir: string;
  subject: string | null;
  papers: string[] | null;
  from: number;
  limit: number;
  model: string;
  concurrency: number;
  list: boolean;
  reviewOnly: boolean;
}

function parseArgs(argv: string[]): Options {
  const flags = new Map<string, string>();
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      flags.set(key, rest.join('=') || 'true');
    }
  }
  const limitFlag = flags.get('limit') ?? '2';
  const papers = flags.get('papers');
  return {
    dir: flags.get('dir') ?? 'papers',
    subject: flags.get('subject') ?? null,
    papers: papers ? papers.split(',').map((p) => p.trim()).filter(Boolean) : null,
    from: Number(flags.get('from') ?? '2015'),
    limit: limitFlag === 'all' ? Infinity : Number(limitFlag),
    model: flags.get('model') ?? 'claude-opus-5-5',
    concurrency: Number(flags.get('concurrency') ?? '2'),
    list: flags.has('list'),
    reviewOnly: flags.has('review-only'),
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.toLowerCase().endsWith('.pdf')) out.push(full);
  }
  return out;
}

/** Pair question papers with mark schemes using the Cambridge file-name convention. */
async function findPapers(root: string, opts: Options): Promise<{ papers: PaperFile[]; unrecognised: string[] }> {
  const files = await walk(root);
  const byKey = new Map<string, Partial<PaperFile> & { key: string }>();
  const unrecognised: string[] = [];
  for (const file of files) {
    const name = file.split(/[\\/]/).pop()!.toLowerCase();
    const m = name.match(/^(\d{4})_([swm])(\d{2})_(qp|ms)_(\d)(\d?)\.pdf$/);
    if (!m) {
      unrecognised.push(relative(root, file));
      continue;
    }
    const [, subject, sess, yy, type, paper, variant] = m;
    const key = `${subject}_${sess}${yy}_${paper}${variant}`;
    const rec = byKey.get(key) ?? { key, subject, session: SESSIONS[sess], year: 2000 + Number(yy), paper, variant };
    if (type === 'qp') rec.qp = file;
    else rec.ms = file;
    byKey.set(key, rec);
  }
  const papers = [...byKey.values()]
    .filter((r): r is PaperFile => Boolean(r.qp))
    .map((r) => ({ ...r, ms: r.ms ?? null }))
    .filter((r) => !opts.subject || r.subject === opts.subject)
    .filter((r) => !opts.papers || opts.papers.includes(r.paper))
    .filter((r) => r.year >= opts.from)
    .sort((a, b) => b.year - a.year || a.key.localeCompare(b.key));
  return { papers, unrecognised };
}

async function pdfBlock(file: string): Promise<Anthropic.Beta.BetaRequestDocumentBlock> {
  const data = (await readFile(file)).toString('base64');
  return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } };
}

interface Usage {
  input: number;
  output: number;
}

async function extractPaper(client: Anthropic, opts: Options, paper: PaperFile, usage: Usage): Promise<PaperExtraction | null> {
  for (const f of [paper.qp, paper.ms]) {
    if (f && (await stat(f)).size > MAX_PDF_BYTES) {
      console.warn(`  ! ${paper.key}: ${f} is too large to send in one request; skipped`);
      return null;
    }
  }
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    { type: 'text', text: 'Question paper:' },
    await pdfBlock(paper.qp),
  ];
  if (paper.ms) content.push({ type: 'text', text: 'Mark scheme:' }, await pdfBlock(paper.ms));
  const topics = TOPICS[paper.subject];
  content.push({
    type: 'text',
    text: `This is syllabus ${paper.subject}, ${paper.session} ${paper.year}, Paper ${paper.paper}${paper.variant}.${paper.ms ? '' : ' No mark scheme is available; leave answers and marking points empty.'}${topics ? `

Topic tagging decides which students are allowed to see a question, so it must be complete. For every part, list in "topics" each topic from the list below whose content a student needs in order to answer that part, copied exactly.
- Tag a part with several topics when it genuinely needs them, for example a part that uses both moments and energy.
- Include topics needed to understand the setup the part relies on, even if they were introduced in the question stem or an earlier part.
- Do not tag a topic just because basic skills from it appear: using units, significant figures or simple algebra does not make a part "Physical quantities and units" unless that is what the part is testing.
- Use "Other" only if nothing fits, for example content since removed from the syllabus.
- Go by what each topic covers (given after the colon), not by the everyday meaning of its name.
${topics.map((t) => `- ${t}${TOPIC_GUIDE[paper.subject]?.[t] ? `: ${TOPIC_GUIDE[paper.subject][t]}` : ''}`).join('\n')}` : ''}`,
  });

  // Streaming: a full paper is a long output, and streaming avoids HTTP timeouts.
  const stream = client.beta.messages.stream({
    model: opts.model,
    max_tokens: 64000,
    // Server-side refusal fallback is not offered on Haiku models.
    ...(opts.model.includes('haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
    system: SYSTEM,
    messages: [{ role: 'user', content }],
    output_config: { effort: 'medium', format: betaZodOutputFormat(PaperExtraction) },
  });
  const response = await stream.finalMessage();

  usage.input += response.usage.input_tokens;
  usage.output += response.usage.output_tokens;

  if (response.stop_reason === 'refusal') {
    console.warn(`  ! ${paper.key}: model declined (${response.stop_details?.category ?? 'no category'})`);
    return null;
  }
  if (response.stop_reason === 'max_tokens') {
    console.warn(`  ! ${paper.key}: output was cut off at the token limit; skipped`);
    return null;
  }
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  const parsed = PaperExtraction.safeParse(JSON.parse(text));
  if (!parsed.success) {
    console.warn(`  ! ${paper.key}: output did not match the expected shape`);
    return null;
  }
  // Guard against the model stopping early: the questions must account for most of the paper.
  const recorded = parsed.data.questions.reduce((n, q) => n + q.total_marks, 0);
  if (parsed.data.total_marks > 0 && recorded < 0.8 * parsed.data.total_marks) {
    console.warn(`  ! ${paper.key}: only ${recorded} of ${parsed.data.total_marks} marks were recorded; treated as failed so a re-run retries it`);
    return null;
  }
  return parsed.data;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface Saved {
  paper: Omit<PaperFile, 'qp' | 'ms'> & { qp: string; ms: string | null };
  extraction: PaperExtraction;
  model: string;
}

const COMBINED_FILES = ['all.json', 'single_topic.json', 'mixed_topic.json', 'topic_index.json', 'topic_order.json', 'topic_guide.json'];

function slug(topic: string): string {
  return topic.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Map a topic name as the model wrote it onto the fixed list. Handles the
 * model copying the description after the colon, or dropping punctuation
 * ("DC circuits", "Work energy and power"). Anything else is returned as is
 * and shows up as an unknown topic on the review page.
 */
function canonicalTopic(raw: string, subject: string): string {
  const squash = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = squash(raw.split(':')[0]);
  return (TOPICS[subject] ?? []).find((t) => squash(t) === key) ?? raw.split(':')[0].trim();
}

interface TopicInfo {
  /** Every topic the question touches, in syllabus order. */
  topics: string[];
  /** Stable label for the combination, e.g. "kinematics-dynamics-electricity". */
  topic_key: string;
  is_mixed: boolean;
  /** The topic carrying the most marks. */
  primary_topic: string;
  /** Topics the model returned that are not in the fixed list. */
  unknown_topics: string[];
}

/**
 * Work out a question's topic combination from its parts. A question counts as
 * mixed when its parts between them need more than one topic, because a player
 * must have unlocked all of them to attempt it.
 */
function classify(q: z.infer<typeof Question>, subject: string): TopicInfo {
  const order = TOPICS[subject] ?? [];
  const pos = (t: string) => (order.indexOf(t) === -1 ? order.length : order.indexOf(t));
  const marks = new Map<string, number>();
  for (const p of q.parts) {
    const ts = p.topics?.length ? p.topics : ['Other'];
    for (const t of ts) marks.set(t, (marks.get(t) ?? 0) + p.marks / ts.length);
  }
  if (marks.size === 0) marks.set('Other', 0);
  const topics = [...marks.keys()].sort((a, b) => pos(a) - pos(b) || a.localeCompare(b));
  const primary_topic = [...marks.entries()].sort((a, b) => b[1] - a[1] || pos(a[0]) - pos(b[0]))[0][0];
  return {
    topics,
    topic_key: topics.map(slug).join('-'),
    is_mixed: topics.length > 1,
    primary_topic,
    unknown_topics: order.length ? topics.filter((t) => t !== 'Other' && !order.includes(t)) : [],
  };
}

async function buildReview(root: string, outDir: string): Promise<{ papers: number; questions: number; parts: number; mixed: number }> {
  const files = (await readdir(outDir)).filter((f) => f.endsWith('.json') && !COMBINED_FILES.includes(f)).sort();
  const saved: Saved[] = [];
  for (const f of files) saved.push(JSON.parse(await readFile(join(outDir, f), 'utf8')) as Saved);
  // Tidy topic names the model wrote slightly differently from the fixed list.
  for (const s of saved) {
    for (const q of s.extraction.questions) {
      for (const p of q.parts) p.topics = [...new Set((p.topics ?? []).map((t) => canonicalTopic(t, s.paper.subject)))];
    }
  }

  const flat = saved.flatMap((s) =>
    s.extraction.questions.map((q) => ({
      id: `${s.paper.key}_q${q.number}`,
      subject: s.paper.subject,
      session: s.paper.session,
      year: s.paper.year,
      paper: `${s.paper.paper}${s.paper.variant}`,
      qp_file: s.paper.qp,
      ms_file: s.paper.ms,
      ...classify(q, s.paper.subject),
      ...q,
    })),
  );
  const single = flat.filter((q) => !q.is_mixed);
  const mixed = flat.filter((q) => q.is_mixed);
  const index: Record<string, { subject: string; topics: string[]; mixed: boolean; questions: string[] }> = {};
  for (const q of flat) {
    const k = `${q.subject}:${q.topic_key}`;
    index[k] ??= { subject: q.subject, topics: q.topics, mixed: q.is_mixed, questions: [] };
    index[k].questions.push(q.id);
  }
  await writeFile(join(outDir, 'all.json'), JSON.stringify(flat, null, 2));
  await writeFile(join(outDir, 'single_topic.json'), JSON.stringify(single, null, 2));
  await writeFile(join(outDir, 'mixed_topic.json'), JSON.stringify(mixed, null, 2));
  await writeFile(join(outDir, 'topic_index.json'), JSON.stringify(index, null, 2));
  // The fixed topic lists in syllabus order, for other scripts (e.g. the question generator).
  await writeFile(join(outDir, 'topic_order.json'), JSON.stringify(TOPICS, null, 2));
  await writeFile(join(outDir, 'topic_guide.json'), JSON.stringify(TOPIC_GUIDE, null, 2));

  let parts = 0;
  const sections = saved
    .map((s) => {
      const marksFound = s.extraction.questions.reduce((n, q) => n + q.total_marks, 0);
      const marksOk = marksFound === s.extraction.total_marks;
      const cards = s.extraction.questions
        .map((q) => {
          parts += q.parts.length;
          const partMarks = q.parts.reduce((n, p) => n + p.marks, 0);
          const info = classify(q, s.paper.subject);
          const flag =
            q.transcription_confidence !== 'high' ||
            q.issues.length > 0 ||
            partMarks !== q.total_marks ||
            info.unknown_topics.length > 0;
          const link = (file: string | null, pages: number[], label: string) =>
            file && pages.length
              ? `<a href="${esc(file.replace(/\\/g, '/'))}#page=${pages[0]}" target="_blank">${label} p.${pages.join(', ')}</a>`
              : '';
          const figs = q.figures
            .map((f) => `<li><b>${esc(f.label)}</b> <i>${esc(f.type)}</i>: ${esc(f.description)}</li>`)
            .join('');
          const partRows = q.parts
            .map(
              (p) => `<tr><th>${esc(p.label) || '&ndash;'}<br><small>${p.marks} mk · ${esc(p.kind)}</small></th><td>
<div>${esc(p.text)}</div>
${p.options.length ? `<ul>${p.options.map((o) => `<li><b>${esc(o.label)}</b> ${esc(o.text)}</li>`).join('')}</ul>` : ''}
<div class="ans"><b>Answer:</b> ${esc(p.final_answer)}</div>
${p.mark_points.length ? `<ul class="mp">${p.mark_points.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
<small>${(p.topics ?? []).map((t) => `<span class="chip">${esc(t)}</span>`).join(' ')} <code>${esc(p.archetype)}</code> · difficulty ${p.difficulty}/5</small></td></tr>`,
            )
            .join('');
          return `<section class="card${flag ? ' flag' : ''}">
<h3>Q${esc(q.number)} · <span class="${info.is_mixed ? 'mixed' : 'single'}">${info.is_mixed ? 'MIXED: ' : ''}${esc(info.topics.join(' + '))}</span> <small><code>${esc(info.topic_key)}</code>${info.unknown_topics.length ? ` · not in topic list: ${esc(info.unknown_topics.join(', '))}` : ''} ·${esc(q.subtopic)} · ${q.total_marks} marks${partMarks !== q.total_marks ? ` (parts add to ${partMarks})` : ''} · confidence ${esc(q.transcription_confidence)} · ${link(s.paper.qp, q.qp_pages, 'paper')} ${link(s.paper.ms, q.ms_pages, 'mark scheme')}</small></h3>
${q.context ? `<p>${esc(q.context)}</p>` : ''}
${figs ? `<ul class="fig">${figs}</ul>` : ''}
<table>${partRows}</table>
${q.issues.length ? `<p class="iss"><b>Issues:</b> ${q.issues.map(esc).join(' | ')}</p>` : ''}
</section>`;
        })
        .join('\n');
      return `<h2>${esc(`${s.paper.subject} · ${s.paper.session} ${s.paper.year} · Paper ${s.paper.paper}${s.paper.variant}`)} <small>${s.extraction.questions.length} questions · ${marksFound}/${s.extraction.total_marks} marks${marksOk ? '' : ' (mismatch)'}</small></h2>
${s.extraction.notes.length ? `<p class="iss">${s.extraction.notes.map(esc).join(' | ')}</p>` : ''}
${cards}`;
    })
    .join('\n');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Paper extraction review</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"
  onload="renderMathInElement(document.body,{delimiters:[{left:'$',right:'$',display:false}],throwOnError:false})"></script>
<style>
body{font:15px/1.5 system-ui,sans-serif;margin:0 auto;padding:16px;max-width:1000px;background:#f4f4f5;color:#18181b}
h1{font-size:20px;margin:0 0 4px} p.sum{margin:0 0 16px;color:#52525b}
h2{font-size:17px;margin:28px 0 8px} h3{font-size:15px;margin:0 0 8px}
small{font-weight:400;color:#52525b} h2 small,h3 small{margin-left:8px}
.card{background:#fff;border:1px solid #d4d4d8;border-radius:8px;padding:12px 16px;margin:0 0 12px}
.card.flag{border-left:6px solid #d97706}
table{border-collapse:collapse;width:100%} tr{border-top:1px solid #e4e4e7}
th{text-align:left;vertical-align:top;width:96px;padding:8px 8px 8px 0} td{padding:8px 0;vertical-align:top}
ul{margin:4px 0;padding-left:18px} ul.fig{color:#3f3f46} ul.mp{color:#166534}
.ans{margin-top:4px} .iss{color:#b45309} code{background:#f4f4f5;padding:1px 4px;border-radius:4px}
a{color:#1d4ed8}
.mixed{color:#7c3aed} .single{color:#0f766e}
.chip{display:inline-block;background:#ede9fe;color:#4c1d95;border-radius:999px;padding:0 8px;margin-right:2px;font-size:12px}
</style></head><body>
<h1>Paper extraction review</h1>
<p class="sum">${saved.length} papers, ${flat.length} questions, ${parts} parts. An orange bar marks a question to look at closely: low confidence, a noted issue, or part marks that do not add up to the question total. Page links open the original PDF.</p>
<p class="sum"><b>${single.length} single-topic</b> and <b class="mixed">${mixed.length} mixed-topic</b> questions. A question is mixed when its parts between them need more than one topic.</p>
<table class="idx"><tr><th style="width:auto">Topic combination</th><th style="width:auto">Questions</th></tr>
${Object.values(index)
  .sort((a, b) => Number(a.mixed) - Number(b.mixed) || b.questions.length - a.questions.length)
  .map((g) => `<tr><td class="${g.mixed ? 'mixed' : 'single'}">${esc(g.topics.join(' + '))}</td><td>${g.questions.length}</td></tr>`)
  .join('')}
</table>
${sections}
</body></html>`;
  await writeFile(join(root, 'review.html'), html);
  return { papers: saved.length, questions: flat.length, parts, mixed: mixed.length };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const root = resolve(process.cwd(), opts.dir);
  const outDir = join(root, '_extracted');
  await mkdir(outDir, { recursive: true });

  if (!opts.reviewOnly) {
    const { papers, unrecognised } = await findPapers(root, opts);
    if (unrecognised.length) {
      console.log(`\n${unrecognised.length} PDF(s) ignored because the file name is not in Cambridge format, e.g. ${unrecognised.slice(0, 3).join(', ')}`);
    }

    const counts = new Map<string, { qp: number; ms: number }>();
    for (const p of papers) {
      const k = `${p.subject} Paper ${p.paper}`;
      const c = counts.get(k) ?? { qp: 0, ms: 0 };
      c.qp++;
      if (p.ms) c.ms++;
      counts.set(k, c);
    }
    console.log(`\nFound ${papers.length} question paper(s) in ${root}:`);
    for (const [k, c] of [...counts].sort()) console.log(`  ${k}: ${c.qp} papers, ${c.ms} with a mark scheme`);

    if (opts.list) return;
    if (papers.length === 0) {
      console.log('\nNothing to do. Put PDFs named like 9702_s23_qp_22.pdf and 9702_s23_ms_22.pdf in that folder.');
      return;
    }
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      console.error('\nNo ANTHROPIC_API_KEY found. Add it to .env (ANTHROPIC_API_KEY=...) and run again.');
      process.exit(1);
    }

    const todo: PaperFile[] = [];
    for (const p of papers) {
      if (todo.length >= opts.limit) break;
      if (!(await exists(join(outDir, `${p.key}.json`)))) todo.push(p);
    }
    console.log(`\n${todo.length} paper(s) to extract (model ${opts.model}).\n`);

    const client = new Anthropic({ maxRetries: 6 });
    const usage: Usage = { input: 0, output: 0 };
    let done = 0;
    let failed = 0;
    let cursor = 0;
    let fatal = false;

    const worker = async () => {
      while (!fatal) {
        const paper = todo[cursor++];
        if (!paper) return;
        try {
          const extraction = await extractPaper(client, opts, paper, usage);
          if (!extraction) {
            failed++;
            continue;
          }
          const saved: Saved = {
            paper: { ...paper, qp: relative(root, paper.qp), ms: paper.ms ? relative(root, paper.ms) : null },
            extraction,
            model: opts.model,
          };
          await writeFile(join(outDir, `${paper.key}.json`), JSON.stringify(saved, null, 2));
          done++;
          console.log(`  [${done + failed}/${todo.length}] ${paper.key}: ${extraction.questions.length} questions, ${extraction.questions.reduce((n, q) => n + q.parts.length, 0)} parts`);
        } catch (err) {
          failed++;
          if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
            console.error(`  ! API key rejected: ${err.message}`);
            fatal = true;
          } else if (err instanceof Anthropic.RateLimitError) {
            console.warn(`  ! ${paper.key}: rate limited after retries; re-run later to pick it up`);
          } else if (err instanceof Anthropic.APIError) {
            console.warn(`  ! ${paper.key}: API error ${err.status}: ${err.message}`);
          } else {
            console.warn(`  ! ${paper.key}: ${(err as Error).message}`);
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, opts.concurrency) }, worker));

    console.log(`\nExtracted ${done}, failed ${failed}.`);
    console.log(`Tokens used: ${usage.input} in, ${usage.output} out.`);
    if (done + failed > 0) {
      console.log(`Average per paper: ${Math.round(usage.input / (done + failed))} in, ${Math.round(usage.output / (done + failed))} out.`);
    }
  }

  const totals = await buildReview(root, outDir);
  console.log(`\nReview page (${totals.papers} papers, ${totals.questions} questions of which ${totals.mixed} mixed-topic, ${totals.parts} parts):${join(root, 'review.html')}`);
}

main().catch((err) => {
  console.error('\nExtractor failed:', err);
  process.exit(1);
});
