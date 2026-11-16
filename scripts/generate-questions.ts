/**
 * Original question generator
 *
 * Writes brand-new questions in the game's step-based multiple-choice format,
 * using the extracted past-paper records only as a guide to topic, skill,
 * difficulty and house style. Nothing is copied: each question must use a new
 * scenario and new numbers, and a word-overlap check flags anything that
 * reads too close to its references.
 *
 * For each question:
 *   1. write   - the model writes the question, options, answers and explanations
 *   2. verify  - a second, independent call solves it without seeing the answers
 *   3. draw    - if a figure is needed, the model writes matplotlib code for it
 *   4. check   - the model compares the rendered figure with its description
 *                and gets one retry if they do not match
 *
 * Usage:
 *   npx tsx scripts/generate-questions.ts [flags]
 *   npm run generate:questions -- [flags]
 *
 * Flags:
 *   --subject=<code>   Syllabus code (default 9702)
 *   --count=<n>        How many questions to write (default 20)
 *   --topic=<name>     Only this topic (default: spread across topics)
 *   --model=<id>       Claude model (default claude-haiku-5-5)
 *   --seed=<n>         Random seed, for a repeatable choice of references (default 1)
 *   --review-only      Skip the API; just rebuild the review page
 *
 * Needs ANTHROPIC_API_KEY in .env, and Python with matplotlib for figures.
 *
 * Output (inside the git-ignored papers folder):
 *   papers/_generated/<id>/question.json   the question in the game's format, plus checks
 *   papers/_generated/<id>/figure.svg      its figure, if it has one (script.py is the source)
 *   papers/_generated/generated.json       everything combined
 *   papers/_generated/review.html          checking page
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, readdir, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const run = promisify(execFile);

interface RefPart {
  label: string;
  text: string;
  marks: number;
  topics: string[];
  mark_points: string[];
  final_answer: string;
}
interface RefQuestion {
  id: string;
  subject: string;
  year: number;
  topics: string[];
  primary_topic: string;
  context: string;
  figures: { label: string; type: string; description: string }[];
  parts: RefPart[];
}

const SUBJECT_NAME: Record<string, 'physics' | 'chemistry' | 'math'> = { '9702': 'physics', '9701': 'chemistry', '9709': 'math' };
/** How many topics at the start of each syllabus list are AS level (the rest are A2). */
const AS_TOPIC_COUNT: Record<string, number> = { '9702': 11 };

const Step = z.object({
  title: z.string().describe('Two to five words naming what this step does, e.g. "Find the tension".'),
  prompt: z.string().describe('The question for this step. Maths and units in LaTeX between $ signs.'),
  options: z.array(z.string()).describe('Exactly four answer options, LaTeX between $ signs where needed.'),
  correct_index: z.number().int().describe('0-based index of the correct option.'),
  marks: z.number().int(),
  explanation: z.string().describe('Short worked solution showing why the correct option is right.'),
  topics: z.array(z.string()).describe('Syllabus topics this step needs, from the allowed list only.'),
  archetype: z.string().describe('snake_case name for the operation, e.g. take_moments_about_pivot.'),
});

const Generated = z.object({
  title: z.string().describe('Short neutral title, e.g. "Crane lifting a crate".'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  stem: z.string().describe('The scenario and all data needed, in at most 80 words. Maths and units in LaTeX between $ signs.'),
  needs_figure: z.boolean(),
  figure_description: z
    .string()
    .describe('If a figure is needed: a complete description to draw it from scratch, with every label, value, axis range and shape, consistent with the stem and not revealing any answer. Otherwise an empty string.'),
  figure_type: z.enum(['none', 'graph', 'diagram']),
  steps: z.array(Step),
  how_it_differs: z.string().describe('One sentence on how the scenario and numbers differ from the references.'),
});
type Generated = z.infer<typeof Generated>;

const Verification = z.object({
  answers: z.array(
    z.object({
      working: z.string().describe('Brief working.'),
      chosen_index: z.number().int().describe('0-based index of the option you believe is correct, or -1 if none of the options is correct or the step cannot be answered from the information given.'),
    }),
  ),
  problems: z
    .array(
      z.object({
        severity: z
          .enum(['blocking', 'minor'])
          .describe('blocking: the question must not be published as it is (no correct option, more than one correct option, missing data, wrong physics, genuinely ambiguous). minor: worth a look but answerable (last-digit rounding, slightly unrealistic value, clumsy wording or distractor).'),
        text: z.string(),
      }),
    )
    .describe('Flaws found. Empty if none.'),
});

const Drawing = z.object({ script: z.string(), notes: z.string() });
const FigureCheck = z.object({
  matches: z.boolean().describe('True only if the drawing shows everything in the description correctly and legibly.'),
  problems: z.array(z.string()).describe('Each mismatch, missing element, wrong value or overlapping label. Empty if it matches.'),
});

const WRITE_SYSTEM = `You write original exam-style questions for a revision game, at Cambridge International AS & A Level standard.

You are shown reference questions from past papers. They are there only to show the topic, the skills tested, the difficulty and the house style. Your question must be your own work:
- Use a different physical situation: different objects, setting and setup from every reference. Do not reuse a distinctive scenario even with new numbers.
- Use different numerical values throughout.
- Do not copy any sentence or distinctive phrase from the references.

Format, for a head-to-head quiz game:
- A stem of at most 80 words that sets the scene and gives all the data.
- Two to four steps that build on each other. Each step is one multiple-choice question with exactly four options, answerable in about a minute.
- If a step needs the result of an earlier step, state that value in its prompt, so each step can be answered on its own.
- One option is correct. The other three are each the result of a specific, realistic mistake (wrong formula, forgotten factor, unit slip, sign error). All four are in the same form and unit, and clearly different from each other.
- Put the correct option at any position.
- An explanation for each step: a short worked solution.

Standards:
- Concise, formal exam wording: "Calculate", "Determine", "State", "Explain". SI units. Data to 2 or 3 significant figures, answers to match. Use $g = 9.81\\,\\mathrm{m\\,s^{-2}}$ where needed.
- Realistic values for the situation described.
- Work every answer out carefully and check it before choosing the options. A question with a wrong answer is worse than no question.
- Calculate with unrounded intermediate values and round only the final answer, so the correct option is exactly the rounded true value. When a later step restates an earlier result, its answer must still follow from the restated value.
- Leave no room for doubt about what is asked: say "change in" or "final", give the sign convention when sign matters, and give angles and phase differences in their simplest form.
- Every quantity, symbol and equation goes in LaTeX between $ signs.
- Steps may only need the allowed topics you are given. Do not bring in content from other topics.
- Figures: if Reference 1 has a figure, your question should normally have one too, showing your own scenario. A question about a setup, a circuit, a set of forces or a graph is clearer with a figure. Purely verbal or definition-based questions need none. Describe the figure completely, make sure it agrees with the stem, and make sure it gives away no answer.`;

const VERIFY_SYSTEM = `You are checking a multiple-choice exam question before it is published. Solve every step yourself from the information given, then say which option is correct. Be strict: if no option matches your answer, or more than one does, or data is missing, answer -1 for that step and say why. Do not assume the question is correct.`;

const DRAW_SYSTEM = `You draw figures for physics exam questions as clean vector drawings, by writing matplotlib code.

You are given a written description of one figure, and the question it belongs to. Write a Python script that draws it.

Requirements:
- Import only matplotlib, numpy and math. No file reading, no network, no other libraries.
- Save exactly one file: fig.savefig("figure.svg", bbox_inches="tight"). Do not call plt.show().
- Show everything in the description: every label, value, dimension, axis range and unit, exactly as given.
- Plain exam style: black lines on a white background, no title, no colour. Use a serif font and mathtext for symbols and units, e.g. r"$v$ / m s$^{-1}$".
- For graphs: label both axes with quantity and unit, use sensible tick values, and draw a light grid.
- For diagrams: use lines, patches and text. Turn the axes off, keep the aspect ratio equal, and place every label clear of lines and of other labels.
- Do not include the question text or any answer.
- Keep the figure compact, about 5 inches wide.`;

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function refText(q: RefQuestion): string {
  const figs = q.figures.map((f) => `  ${f.label} (${f.type}): ${f.description}`).join('\n');
  const parts = q.parts
    .map((p) => `  ${p.label} [${p.marks}] ${p.text}\n     marking: ${p.mark_points.join(' | ') || p.final_answer}`)
    .join('\n');
  return `Stem: ${q.context || '(none)'}\n${figs ? `Figures:\n${figs}\n` : ''}Parts:\n${parts}`;
}

/** Share of the new text's 5-word runs that also appear in the references (0 to 1). */
function overlap(text: string, refs: string): number {
  const words = (s: string) => s.toLowerCase().replace(/\$[^$]*\$/g, ' ').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  const grams = (w: string[]) => {
    const out = new Set<string>();
    for (let i = 0; i + 5 <= w.length; i++) out.add(w.slice(i, i + 5).join(' '));
    return out;
  };
  const mine = grams(words(text));
  if (mine.size === 0) return 0;
  const theirs = grams(words(refs));
  let hit = 0;
  for (const g of mine) if (theirs.has(g)) hit++;
  return hit / mine.size;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

interface Saved {
  id: string;
  /** The question in the shape the game's questions table expects. */
  question: {
    title: string;
    subject: string;
    chapter: string;
    level: 'A1' | 'A2';
    difficulty: string;
    stem: string;
    total_marks: number;
    topic_tags: string[];
    image_file: string | null;
    steps: { title: string; prompt: string; type: 'mcq'; options: string[]; correct_answer: number; marks: number; explanation: string }[];
  };
  topics: string[];
  topic_key: string;
  is_mixed: boolean;
  figure: { needed: boolean; description: string; ok: boolean; retried: boolean; problems: string[]; error: string };
  checks: {
    verified: boolean;
    disagreements: string[];
    /** Flaws the checker says must be fixed before publishing. */
    blocking_problems: string[];
    /** Smaller remarks from the checker; the question is still answerable. */
    minor_notes: string[];
    overlap_with_references: number;
    how_it_differs: string;
    format_problems: string[];
  };
  references: string[];
  model: string;
}

const usage = { input: 0, output: 0 };
function count(u: { input_tokens: number; output_tokens: number }): void {
  usage.input += u.input_tokens;
  usage.output += u.output_tokens;
}

async function drawFigure(client: Anthropic, model: string, dir: string, g: Generated): Promise<Saved['figure']> {
  const fig: Saved['figure'] = { needed: true, description: g.figure_description, ok: false, retried: false, problems: [], error: '' };
  let feedback = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      system: DRAW_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Draw this ${g.figure_type}.\n\nDescription: ${g.figure_description}\n\nQuestion it belongs to: ${g.stem}${feedback}`,
        },
      ],
      output_config: { effort: 'medium', format: betaZodOutputFormat(Drawing) },
    });
    count(res.usage);
    if (!res.parsed_output) {
      fig.error = 'no drawing code was produced';
      return fig;
    }
    await writeFile(join(dir, 'script.py'), res.parsed_output.script);
    const { stdout } = await run('python', [resolve('scripts/figures_pilot.py'), 'render-one', dir]);
    const status = JSON.parse(stdout.trim().split('\n').pop() ?? '{}') as { ok: boolean; error: string };
    if (!status.ok) {
      fig.error = status.error;
      feedback = `\n\nYour previous script failed with: ${status.error}. Write a corrected script.`;
      fig.retried = attempt === 0;
      continue;
    }
    fig.error = '';
    // Look at the rendered drawing and compare it with the description.
    const png = (await readFile(join(dir, 'figure.png'))).toString('base64');
    const check = await client.beta.messages.parse({
      model,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: png } },
            {
              type: 'text',
              text: `This drawing was made from the description below. Check it strictly: is everything in the description shown, correct and legible, with no overlapping labels and nothing that gives away an answer?\n\nDescription: ${g.figure_description}`,
            },
          ],
        },
      ],
      output_config: { effort: 'low', format: betaZodOutputFormat(FigureCheck) },
    });
    count(check.usage);
    const verdict = check.parsed_output ?? { matches: false, problems: ['the check returned nothing'] };
    fig.ok = verdict.matches;
    fig.problems = verdict.problems;
    if (verdict.matches || attempt === 1) return fig;
    fig.retried = true;
    feedback = `\n\nYour previous drawing had these problems. Fix all of them:\n${verdict.problems.map((p) => `- ${p}`).join('\n')}\n\nPrevious script:\n${res.parsed_output.script}`;
  }
  return fig;
}

async function makeOne(
  client: Anthropic,
  model: string,
  subject: string,
  topicOrder: string[],
  seedQ: RefQuestion,
  otherRef: RefQuestion | undefined,
  id: string,
  outRoot: string,
  rand: () => number,
): Promise<Saved | null> {
  const refs = [seedQ, ...(otherRef ? [otherRef] : [])];
  const refsText = refs.map((r, i) => `--- Reference ${i + 1} ---\n${refText(r)}`).join('\n\n');
  const allowed = seedQ.topics;

  const res = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    system: WRITE_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Allowed topics: ${allowed.join('; ')}\n\nWrite one original question testing similar skills at a similar level to Reference 1.\n\n${refsText}`,
      },
    ],
    output_config: { effort: 'medium', format: betaZodOutputFormat(Generated) },
  });
  count(res.usage);
  const g = res.parsed_output;
  if (!g) return null;

  const formatProblems: string[] = [];
  if (g.steps.length < 2 || g.steps.length > 4) formatProblems.push(`has ${g.steps.length} steps (expected 2 to 4)`);
  g.steps.forEach((s, i) => {
    if (s.options.length !== 4) formatProblems.push(`step ${i + 1} has ${s.options.length} options`);
    if (s.correct_index < 0 || s.correct_index >= s.options.length) formatProblems.push(`step ${i + 1} has no valid correct option`);
    if (new Set(s.options.map((o) => o.replace(/\s+/g, ''))).size !== s.options.length) formatProblems.push(`step ${i + 1} has duplicate options`);
    const stray = s.topics.filter((t) => !allowed.includes(t));
    if (stray.length) formatProblems.push(`step ${i + 1} uses topics outside the allowed list: ${stray.join(', ')}`);
  });

  // Shuffle each step's options so the correct one lands in a random position.
  const steps = g.steps.map((s) => {
    const order = s.options.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return { ...s, options: order.map((i) => s.options[i]), correct_index: order.indexOf(s.correct_index) };
  });

  // Independent solve: the checker sees the question and options but not the answers.
  const blind = steps
    .map((s, i) => `Step ${i + 1}: ${s.prompt}\n${s.options.map((o, k) => `  [${k}] ${o}`).join('\n')}`)
    .join('\n\n');
  const ver = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    system: VERIFY_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `${g.stem}\n${g.needs_figure ? `\nFigure: ${g.figure_description}\n` : ''}\n${blind}`,
      },
    ],
    output_config: { effort: 'medium', format: betaZodOutputFormat(Verification) },
  });
  count(ver.usage);
  const v = ver.parsed_output;
  const disagreements: string[] = [];
  steps.forEach((s, i) => {
    const chosen = v?.answers[i]?.chosen_index;
    if (chosen !== s.correct_index) {
      disagreements.push(
        `step ${i + 1}: marked answer is "${s.options[s.correct_index] ?? '?'}" but the checker ${chosen === -1 || chosen === undefined ? 'found no correct option' : `chose "${s.options[chosen]}"`}`,
      );
    }
  });

  const dir = join(outRoot, id);
  await mkdir(dir, { recursive: true });
  let figure: Saved['figure'] = { needed: false, description: '', ok: true, retried: false, problems: [], error: '' };
  if (g.needs_figure && g.figure_description.trim()) {
    try {
      figure = await drawFigure(client, model, dir, g);
    } catch (err) {
      figure = { needed: true, description: g.figure_description, ok: false, retried: false, problems: [], error: (err as Error).message };
    }
  }

  const pos = (t: string) => (topicOrder.indexOf(t) === -1 ? topicOrder.length : topicOrder.indexOf(t));
  const topics = [...new Set(steps.flatMap((s) => s.topics))].filter((t) => allowed.includes(t)).sort((a, b) => pos(a) - pos(b));
  if (topics.length === 0) topics.push(seedQ.primary_topic);
  const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const asCount = AS_TOPIC_COUNT[subject] ?? topicOrder.length;
  const newText = [g.stem, ...steps.map((s) => s.prompt)].join(' ');

  const saved: Saved = {
    id,
    question: {
      title: g.title,
      subject: SUBJECT_NAME[subject] ?? 'physics',
      chapter: topics.length === 1 ? topics[0] : seedQ.primary_topic,
      level: topics.every((t) => pos(t) < asCount) ? 'A1' : 'A2',
      difficulty: g.difficulty,
      stem: g.stem,
      total_marks: steps.reduce((n, s) => n + s.marks, 0),
      topic_tags: [...topics.map(slug), ...(steps[0] ? [`archetype_${steps[0].archetype.replace(/^archetype_/, '')}`] : [])],
      image_file: figure.needed && !figure.error ? 'figure.svg' : null,
      steps: steps.map((s) => ({
        title: s.title,
        prompt: s.prompt,
        type: 'mcq' as const,
        options: s.options,
        correct_answer: s.correct_index,
        marks: s.marks,
        explanation: s.explanation,
      })),
    },
    topics,
    topic_key: topics.map(slug).join('-'),
    is_mixed: topics.length > 1,
    figure,
    checks: {
      verified: Boolean(v) && disagreements.length === 0 && !v!.problems.some((p) => p.severity === 'blocking'),
      disagreements,
      blocking_problems: v ? v.problems.filter((p) => p.severity === 'blocking').map((p) => p.text) : ['the checker returned nothing'],
      minor_notes: v ? v.problems.filter((p) => p.severity === 'minor').map((p) => p.text) : [],
      overlap_with_references: Number(overlap(newText, refs.map(refText).join(' ')).toFixed(3)),
      how_it_differs: g.how_it_differs,
      format_problems: formatProblems,
    },
    references: refs.map((r) => r.id),
    model,
  };
  await writeFile(join(dir, 'question.json'), JSON.stringify(saved, null, 2));
  return saved;
}

function needsAttention(s: Saved): boolean {
  return !s.checks.verified || s.checks.format_problems.length > 0 || s.checks.overlap_with_references > 0.15 || (s.figure.needed && !s.figure.ok);
}

async function buildReview(outRoot: string): Promise<{ total: number; clean: number }> {
  const all: Saved[] = [];
  for (const entry of (await readdir(outRoot, { withFileTypes: true })).filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const f = join(outRoot, entry.name, 'question.json');
    if (await exists(f)) all.push(JSON.parse(await readFile(f, 'utf8')) as Saved);
  }
  await writeFile(join(outRoot, 'generated.json'), JSON.stringify(all, null, 2));

  const cards = all
    .map((s) => {
      const q = s.question;
      const warn = [
        ...s.checks.format_problems,
        ...s.checks.disagreements.map((d) => `Answer check: ${d}`),
        ...s.checks.blocking_problems.map((d) => `Checker: ${d}`),
        ...(s.checks.overlap_with_references > 0.15 ? [`Wording overlaps the references (${Math.round(s.checks.overlap_with_references * 100)}%)`] : []),
        ...(s.figure.needed && s.figure.error ? [`Figure failed: ${s.figure.error}`] : []),
        ...(s.figure.needed && !s.figure.error && !s.figure.ok ? s.figure.problems.map((p) => `Figure: ${p}`) : []),
      ];
      const steps = q.steps
        .map(
          (st, i) => `<div class="step"><b>Step ${i + 1}: ${esc(st.title)}</b> <small>${st.marks} mk</small>
<div>${esc(st.prompt)}</div>
<ol type="A">${st.options.map((o, k) => `<li class="${k === st.correct_answer ? 'ok' : ''}">${esc(o)}</li>`).join('')}</ol>
<div class="exp">${esc(st.explanation)}</div></div>`,
        )
        .join('');
      return `<section class="card${needsAttention(s) ? ' flag' : ''}">
<h2>${esc(q.title)} <small><span class="${s.is_mixed ? 'mixed' : 'single'}">${esc(s.topics.join(' + '))}</span> · ${esc(q.level)} · ${esc(q.difficulty)} · ${q.total_marks} marks · wording overlap ${Math.round(s.checks.overlap_with_references * 100)}% · modelled on ${esc(s.references[0])}</small></h2>
<p>${esc(q.stem)}</p>
${q.image_file ? `<img src="${esc(s.id)}/${esc(q.image_file)}" alt="figure">` : ''}
${steps}
<p class="diff"><b>How it differs from the reference:</b> ${esc(s.checks.how_it_differs)}</p>
${warn.length ? `<ul class="warn">${warn.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
${s.checks.minor_notes.length ? `<ul class="minor">${s.checks.minor_notes.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
</section>`;
    })
    .join('\n');
  const clean = all.filter((s) => !needsAttention(s)).length;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Generated questions</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"
  onload="renderMathInElement(document.body,{delimiters:[{left:'$',right:'$',display:false}],throwOnError:false})"></script>
<style>
body{font:15px/1.5 system-ui,sans-serif;margin:0 auto;padding:16px;max-width:900px;background:#f4f4f5;color:#18181b}
h1{font-size:20px;margin:0 0 4px} h2{font-size:17px;margin:0 0 8px} small{font-weight:400;color:#52525b;margin-left:6px}
.card{background:#fff;border:1px solid #d4d4d8;border-radius:8px;padding:12px 16px;margin:0 0 16px}
.card.flag{border-left:6px solid #d97706} img{max-width:420px;width:100%;display:block;margin:8px 0;border:1px solid #e4e4e7}
.step{border-top:1px solid #e4e4e7;padding:8px 0} ol{margin:4px 0;padding-left:26px} li.ok{color:#15803d;font-weight:600}
.exp{color:#52525b;font-size:14px} .diff{color:#52525b;font-size:14px;margin:8px 0 0}
.warn{color:#b45309;margin:8px 0 0;padding-left:18px} .minor{color:#71717a;font-size:13px;margin:8px 0 0;padding-left:18px} .mixed{color:#7c3aed} .single{color:#0f766e}
</style></head><body>
<h1>Generated questions</h1>
<p>${all.length} original questions. ${clean} passed every automatic check; ${all.length - clean} have an orange bar and a list of what to look at. The correct option is in green.</p>
${cards}
</body></html>`;
  await writeFile(join(outRoot, 'review.html'), html);
  return { total: all.length, clean };
}

async function main(): Promise<void> {
  const flags = new Map(
    process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
      const [k, ...v] = a.slice(2).split('=');
      return [k, v.join('=') || 'true'] as const;
    }),
  );
  const subject = flags.get('subject') ?? '9702';
  const target = Number(flags.get('count') ?? '20');
  const model = flags.get('model') ?? 'claude-haiku-5-5';
  const rand = mulberry(Number(flags.get('seed') ?? '1'));
  const outRoot = resolve(process.cwd(), 'papers', '_generated');
  await mkdir(outRoot, { recursive: true });

  if (!flags.has('review-only')) {
    const all = (JSON.parse(await readFile(resolve('papers/_extracted/all.json'), 'utf8')) as RefQuestion[]).filter(
      (q) => q.subject === subject && !q.topics.includes('Other') && q.topics.length <= 2 && q.parts.length >= 2,
    );
    // Syllabus order of topics, recovered from the records (single-topic questions list them in order).
    const topicOrder = JSON.parse(await readFile(resolve('papers/_extracted/topic_order.json'), 'utf8').catch(() => '{}'))[subject] as string[] | undefined;
    const order = topicOrder ?? [...new Set(all.map((q) => q.primary_topic))];

    const byTopic = new Map<string, RefQuestion[]>();
    for (const q of all) {
      const list = byTopic.get(q.primary_topic) ?? [];
      list.push(q);
      byTopic.set(q.primary_topic, list);
    }
    const wanted = flags.get('topic');
    const topics = (wanted ? [wanted] : order).filter((t) => byTopic.has(t));
    if (topics.length === 0) {
      console.error('No reference questions found for that subject or topic.');
      process.exit(1);
    }

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const jobs: { id: string; seedQ: RefQuestion; other?: RefQuestion }[] = [];
    for (let i = 0; i < target; i++) {
      const list = byTopic.get(topics[i % topics.length])!;
      const seedQ = list[Math.floor(rand() * list.length)];
      const others = list.filter((q) => q.id !== seedQ.id);
      jobs.push({
        id: `gen_${subject}_${stamp}_${String(i + 1).padStart(3, '0')}`,
        seedQ,
        other: others.length ? others[Math.floor(rand() * others.length)] : undefined,
      });
    }

    console.log(`\nWriting ${jobs.length} original ${subject} question(s) with ${model}.\n`);
    const client = new Anthropic({ maxRetries: 6 });
    let cursor = 0;
    let made = 0;
    const worker = async () => {
      for (let job = jobs[cursor++]; job; job = jobs[cursor++]) {
        try {
          const s = await makeOne(client, model, subject, order, job.seedQ, job.other, job.id, outRoot, rand);
          if (!s) {
            console.warn(`  ! ${job.id}: nothing usable came back`);
            continue;
          }
          made++;
          console.log(
            `  ${job.id}  ${s.topics.join(' + ')}  ${s.checks.verified ? 'verified' : 'ANSWER CHECK FAILED'}${s.figure.needed ? (s.figure.ok ? ', figure ok' : ', FIGURE NEEDS A LOOK') : ''}`,
          );
        } catch (err) {
          if (err instanceof Anthropic.APIError) console.warn(`  ! ${job.id}: API error ${err.status}: ${err.message}`);
          else console.warn(`  ! ${job.id}: ${(err as Error).message}`);
        }
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    console.log(`\nWrote ${made} question(s). Tokens used: ${usage.input} in, ${usage.output} out.`);
  }

  const totals = await buildReview(outRoot);
  console.log(`\nReview page (${totals.total} questions, ${totals.clean} passed every check): ${join(outRoot, 'review.html')}`);
}

main().catch((err) => {
  console.error('\nGenerator failed:', err);
  process.exit(1);
});
