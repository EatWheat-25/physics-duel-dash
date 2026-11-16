/**
 * Question template maker
 *
 * Has the model write question TEMPLATES instead of fixed questions: the
 * scenario text with variables, the allowed range of each variable, a formula
 * for each answer, a formula for each wrong option, and (if needed) drawing
 * code that takes the same variables. scripts/lib/template-engine.ts then
 * produces as many versions as wanted, with code doing the arithmetic.
 *
 * Each template is tested before it is kept:
 *   1. health   - 200 random versions are tried by code; most must work
 *   2. verify   - two versions are solved blind by the model; its choices must
 *                 match the answers the formulas produced
 *   3. figure   - the drawing code is run for each sample version
 *
 * Usage:
 *   npx tsx scripts/make-templates.ts [flags]
 *   npm run make:templates -- [flags]
 *
 * Flags:
 *   --subject=<code>   Syllabus code (default 9702)
 *   --count=<n>        How many templates to write (default 8)
 *   --topic=<name>     Only this topic (default: spread across topics)
 *   --versions=<n>     Sample versions per template on the review page (default 3)
 *   --model=<id>       Claude model (default claude-haiku-5-5)
 *   --seed=<n>         Random seed (default 1)
 *   --review-only      Skip the API; rebuild samples and the review page
 *
 * Output (inside the git-ignored papers folder):
 *   papers/_templates/<id>/template.json   the template plus its test results
 *   papers/_templates/<id>/v1, v2, ...     sample versions with their figures
 *   papers/_templates/review.html          checking page
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, readdir, access, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { healthCheck, instantiate, seededRandom, type QuestionInstance, type QuestionTemplate } from './lib/template-engine';

const run = promisify(execFile);

interface RefPart {
  label: string;
  text: string;
  marks: number;
  kind: string;
  topics: string[];
  mark_points: string[];
  final_answer: string;
}
interface RefQuestion {
  id: string;
  subject: string;
  topics: string[];
  primary_topic: string;
  context: string;
  figures: { label: string; type: string; description: string }[];
  parts: RefPart[];
}

const TemplateSchema = z.object({
  title: z.string().describe('Short neutral title, e.g. "Crate on a ramp".'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  variables: z
    .array(
      z.object({
        name: z.string().describe('snake_case, e.g. mass, ramp_angle.'),
        min: z.number(),
        max: z.number(),
        step: z.number().describe('Spacing of allowed values, e.g. 0.5. Choose it so every value reads naturally in an exam.'),
      }),
    )
    .describe('The numbers that change between versions. Usually 2 to 5.'),
  derived: z
    .array(z.object({ name: z.string(), expr: z.string() }))
    .describe('Named intermediate values, each a formula over variables and earlier derived values.'),
  constraints: z.array(z.string()).describe('Conditions every version must satisfy, as formulas, e.g. "tension > 0". Empty if none are needed.'),
  stem: z.string().describe('The single main question: situation, data and ONE thing to find, in at most 50 words. Each changing number appears as {{name}} or {{name|3}}.'),
  main_timer_seconds: z.number().int().describe('Total working time for the main question: about 180 for easy, 210 to 360 for medium, 360 to 420 for hard.'),
  steps: z.array(
    z.object({
      title: z.string(),
      prompt: z.string(),
      answer_expr: z.string().describe('Formula for the correct answer, in the unit given in unit_latex.'),
      unit_latex: z.string().describe('LaTeX for the unit, e.g. \\mathrm{N} or \\mathrm{m\\,s^{-2}}. Empty for a pure number.'),
      sig_figs: z.number().int(),
      distractors: z
        .array(z.object({ expr: z.string(), mistake: z.string().describe('The specific error this wrong answer comes from.') }))
        .describe('Exactly three.'),
      explanation: z.string().describe('Short worked solution, using placeholders for every number so it is right for every version.'),
      marks: z.number().int(),
      topics: z.array(z.string()),
      archetype: z.string(),
    }),
  ),
  needs_figure: z.boolean(),
  figure_description: z.string().describe('What the figure shows, in words. Empty if none.'),
  figure_script: z.string().describe('matplotlib code reading its numbers from PARAMS. Empty if no figure.'),
});

const Verification = z.object({
  answers: z.array(
    z.object({
      working: z.string(),
      chosen_index: z.number().int().describe('0-based index of the correct option, or -1 if none is correct or the step cannot be answered.'),
    }),
  ),
  problems: z.array(z.object({ severity: z.enum(['blocking', 'minor']), text: z.string() })),
});

const WRITE_SYSTEM = `You write question TEMPLATES for a revision game, at Cambridge International AS & A Level standard. A template is one question whose numbers are variables, so a program can produce many versions of it and compute every answer.

You are shown reference questions from past papers only as a guide to topic, skill, difficulty and house style. The template must be your own work: a different physical situation from every reference, with no sentence or distinctive phrase copied.

How a template works:
- "variables": the numbers that change. Give each a range and a step, chosen so every possible value is realistic for the situation and reads naturally (2 or 3 significant figures).
- "derived": named intermediate values, each a formula.
- Text fields (stem, prompts, explanations) show a value with {{name}}, or {{name|3}} to force 3 significant figures. Use a placeholder for every number that depends on a variable. Never type such a number directly.
- Each step has "answer_expr", a formula for the correct answer in the unit shown, and exactly three distractors, each a formula for the answer a student gets from one specific mistake (wrong formula, forgotten factor, missed unit conversion, sign error, sin and cos swapped).
- "constraints": conditions that must hold for a version to make physical sense, e.g. "tension > 0".

Formula language (nothing else is available):
- Numbers, names, + - * / ^ and brackets. Comparisons < > <= >= for constraints.
- sqrt abs exp ln log10 sin cos tan asin acos atan (radians), sind cosd tand asind acosd atand (degrees), min max, pi.
- Put unit conversions in the formula. If a length is given in mm, the formula must divide by 1000.
- Use 9.81 for g and write physical constants as numbers, e.g. 1.60e-19.

Format. This is how the game works, so follow it exactly:
- The player first sees only the main question (the stem), with a timer of several minutes, and works the whole problem out on paper. So the stem reads like one exam question: the situation, the data, and ONE thing to find. At most 50 words. It is not split into parts and does not mention steps.
- The steps then check the player's working, in the order of a mark scheme for that question. Each step asks for one intermediate result a student must find on the way, and the last step asks for the final answer the stem asked for. Two to four steps. Example: the stem asks for the acceleration of a trolley; step 1 asks for its displacement, step 2 for its final velocity, step 3 for the acceleration.
- Only include intermediate results that every correct method passes through, so a student who solved it a different valid way is not penalised. Do not invent a detour to add a step: if the usual solution has two stages, write two steps, and choose a main question whose solution naturally has two to four stages.
- A wrong option must be a value a student could believe: never negative for a quantity that cannot be negative, and never an absurd size.
- Step prompts are short, about ten words, such as "What is the tension in the cable?". They do not restate the data and never reveal an earlier result, because the player has already worked everything out.
- Every formula therefore uses the variables and derived values directly, at full precision. There is no carrying forward of rounded answers.
- Each step is worth 1 mark, or 2 if it covers two marking points.
- Every step must have a numerical answer. No "state" or "explain" steps.
- The four options of a step must stay clearly different from each other across the whole range of the variables. Avoid distractors that coincide with the answer for some values.
- Wrong options must be tempting. Prefer conceptual mistakes that give an answer of a believable size. Use at most one power-of-ten or unit-conversion slip per step, and never one that gives an absurd size for the situation.
- The numbers must be physically consistent with each other in every version, not just arithmetically valid. If two quantities are linked by the physics (for example the heat supplied, the work done and the temperature change of an ideal gas), make one a variable and derive the other. Choose ranges so no version gives an extreme result.
- Stay strictly inside the syllabus content you are given for the allowed topics. Do not use ideas beyond it, however natural they seem.
- Concise, formal exam wording. SI units. Every quantity, symbol and equation in LaTeX between $ signs, e.g. $m = {{mass}}\\,\\mathrm{kg}$.
- Steps may only need the allowed topics you are given.

Figure: set "needs_figure" to true when the setup, circuit, forces or graph would be clearer with a drawing, and say in "figure_description" what it should show. Leave "figure_script" empty; the drawing code is written in a separate step.

Check your formulas by working one version through by hand before you finish.`;

const DRAW_SYSTEM = `You write the drawing code for a question template in a revision game. The same code must draw the figure for every version of the question, so it takes its numbers from a dict.

Requirements:
- A dict named PARAMS is defined before your code runs. It holds the value of every variable for this version, as numbers. Take every number you draw or label from PARAMS, e.g. f"{PARAMS['mass']:g} kg". Never type a value that comes from a variable.
- Show only what the stem states: the setup and the given data. Never show an answer or anything the student has to work out.
- Scale the geometry from the values where it matters (the angle of a slope, the shape of a graph), and keep it readable across the whole range of each variable.
- Import only matplotlib, numpy and math. No file reading, no network. Save exactly one file: fig.savefig("figure.svg", bbox_inches="tight"). Do not call plt.show().
- Plain exam style: black lines on a white background, serif font, mathtext for symbols and units, no title, no colour.
- Diagrams: lines, patches and text; axes off; equal aspect; every label clear of lines and of other labels. Circuits: standard symbols, rectangular wiring.
- Graphs: label both axes with quantity and unit, sensible ticks, light grid.
- About 5 inches wide.`;

const FigureCheck = z.object({
  matches: z.boolean().describe('True only if the drawing shows the setup and given data correctly and legibly, with no overlapping labels, and reveals no answer.'),
  problems: z.array(z.string()),
});
const Drawing = z.object({ script: z.string() });

const VERIFY_SYSTEM = `You are checking a multiple-choice exam question before it is published. Solve every step yourself from the information given, then say which option is correct. Be strict: if no option matches your answer, or more than one does, or data is missing, answer -1 for that step and say why. Do not assume the question is correct.`;

interface Saved {
  id: string;
  template: QuestionTemplate;
  subject: string;
  topics: string[];
  topic_key: string;
  is_mixed: boolean;
  level: 'A1' | 'A2';
  health: { ok: number; tries: number; error: string | null };
  /** Number of distinct combinations of variable values. */
  combinations: number;
  verify: { versions_checked: number; disagreements: string[]; blocking_problems: string[]; minor_notes: string[] };
  figure: { attempted: boolean; ok: boolean; retried: boolean; problems: string[]; error: string };
  format_problems: string[];
  usable: boolean;
  references: string[];
  model: string;
}

const usage = { input: 0, output: 0 };
const AS_TOPIC_COUNT: Record<string, number> = { '9702': 11 };

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
function refText(q: RefQuestion): string {
  const figs = q.figures.map((f) => `  ${f.label} (${f.type}): ${f.description}`).join('\n');
  const parts = q.parts.map((p) => `  ${p.label} [${p.marks}] ${p.text}\n     marking: ${p.mark_points.join(' | ') || p.final_answer}`).join('\n');
  return `Stem: ${q.context || '(none)'}\n${figs ? `Figures:\n${figs}\n` : ''}Parts:\n${parts}`;
}

/** Write a version's figure script (PARAMS + the template's code) and render it. */
async function renderFigure(template: QuestionTemplate, inst: QuestionInstance, dir: string): Promise<{ ok: boolean; error: string }> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'script.py'), `PARAMS = ${JSON.stringify(inst.values)}\n\n${template.figure_script}\n`);
  try {
    const { stdout } = await run('python', [resolve('scripts/figures_pilot.py'), 'render-one', dir]);
    return JSON.parse(stdout.trim().split('\n').pop() ?? '{"ok":false,"error":"no result"}');
  } catch (err) {
    return { ok: false, error: (err as Error).message.split('\n')[0] };
  }
}

async function verifyVersion(client: Anthropic, model: string, t: QuestionTemplate, inst: QuestionInstance) {
  const blind = inst.steps.map((s, i) => `Step ${i + 1}: ${s.prompt}\n${s.options.map((o, k) => `  [${k}] ${o}`).join('\n')}`).join('\n\n');
  const res = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    system: VERIFY_SYSTEM,
    messages: [{ role: 'user', content: `${inst.stem}\n${t.needs_figure ? `\nFigure: ${t.figure_description}\n` : ''}\n${blind}` }],
    output_config: { effort: 'medium', format: betaZodOutputFormat(Verification) },
  });
  usage.input += res.usage.input_tokens;
  usage.output += res.usage.output_tokens;
  return res.parsed_output;
}

/**
 * Write the template's drawing code in a focused call of its own, render it
 * for one version, have the model look at the result, and retry once if it
 * does not match. On success the code is stored on the template.
 */
async function addFigure(client: Anthropic, model: string, template: QuestionTemplate, dir: string): Promise<Saved['figure']> {
  const fig: Saved['figure'] = { attempted: true, ok: false, retried: false, problems: [], error: '' };
  const inst = instantiate(template, seededRandom(5));
  const givens = Object.fromEntries(template.variables.map((v) => [v.name, inst.values[v.name]]));
  const testDir = join(dir, '_figure_test');
  let feedback = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      system: DRAW_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Question stem (placeholders in double braces are filled per version):\n${template.stem}\n\nWhat the figure should show: ${template.figure_description || 'the physical setup described in the stem, with the given data labelled'}\n\nVariables available in PARAMS, with their ranges and the values for the version you will be tested on:\n${template.variables
            .map((v) => `- ${v.name}: ${v.min} to ${v.max} (this version: ${givens[v.name]})`)
            .join('\n')}\n\nThe stem for this version reads:\n${inst.stem}${feedback}`,
        },
      ],
      output_config: { effort: 'medium', format: betaZodOutputFormat(Drawing) },
    });
    usage.input += res.usage.input_tokens;
    usage.output += res.usage.output_tokens;
    if (!res.parsed_output) {
      fig.error = 'no drawing code was produced';
      return fig;
    }
    const candidate = { ...template, figure_script: res.parsed_output.script };
    // Only the given data goes into PARAMS for the figure, so it cannot show an answer.
    const status = await renderFigure(candidate, { ...inst, values: givens }, testDir);
    if (!status.ok) {
      fig.error = status.error;
      fig.retried = attempt === 0;
      feedback = `\n\nYour previous script failed with: ${status.error}. Write a corrected script.`;
      continue;
    }
    fig.error = '';
    template.figure_script = res.parsed_output.script;
    template.needs_figure = true;
    const png = (await readFile(join(testDir, 'figure.png'))).toString('base64');
    const check = await client.beta.messages.parse({
      model,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: png } },
            { type: 'text', text: `This figure was drawn for the question below. Check it strictly: does it show the setup and every given value correctly and legibly, with no overlapping labels, and without revealing any answer?\n\n${inst.stem}` },
          ],
        },
      ],
      output_config: { effort: 'low', format: betaZodOutputFormat(FigureCheck) },
    });
    usage.input += check.usage.input_tokens;
    usage.output += check.usage.output_tokens;
    const verdict = check.parsed_output ?? { matches: false, problems: ['the check returned nothing'] };
    fig.ok = verdict.matches;
    fig.problems = verdict.problems;
    if (verdict.matches || attempt === 1) break;
    fig.retried = true;
    feedback = `\n\nYour previous drawing had these problems. Fix all of them:\n${verdict.problems.map((p) => `- ${p}`).join('\n')}\n\nPrevious script:\n${res.parsed_output.script}`;
  }
  await rm(testDir, { recursive: true, force: true });
  return fig;
}

async function makeOne(
  client: Anthropic,
  model: string,
  subject: string,
  order: string[],
  guide: Record<string, string>,
  seedQ: RefQuestion,
  focus: RefPart,
  id: string,
  outRoot: string,
  avoid: string[],
): Promise<Saved | null> {
  const allowed = focus.topics;
  const res = await client.beta.messages.parse({
    model,
    max_tokens: 20000,
    system: WRITE_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Allowed topics and the syllabus content each covers:\n${allowed.map((t) => `- ${t}${guide[t] ? `: ${guide[t]}` : ''}`).join('\n')}\n\nWrite one original template testing the same calculation skill, at the same level, as part ${focus.label || '(the only part)'} of the reference question below. That part is worth ${focus.marks} marks, and its marking points show the kind of working route your steps should check.\n\n--- Reference question ---\n${refText(seedQ)}\n\n--- Focus part ${focus.label} ---\n${focus.text}\nmarking: ${focus.mark_points.join(' | ') || focus.final_answer}${
          avoid.length ? `\n\nTemplates already written for this topic. Choose a clearly different situation from all of them:\n${avoid.map((t) => `- ${t}`).join('\n')}` : ''
        }`,
      },
    ],
    output_config: { effort: 'medium', format: betaZodOutputFormat(TemplateSchema) },
  });
  usage.input += res.usage.input_tokens;
  usage.output += res.usage.output_tokens;
  if (!res.parsed_output) return null;
  const template = res.parsed_output as QuestionTemplate;
  template.figure_script = '';
  const wantsFigure =
    template.needs_figure || seedQ.figures.some((f) => f.type !== 'table' && (focus.text.includes(f.label) || seedQ.context.includes(f.label)));
  template.needs_figure = false; // set again by addFigure once drawing code exists and runs

  const formatProblems: string[] = [];
  if (template.steps.length < 2 || template.steps.length > 4) formatProblems.push(`has ${template.steps.length} steps (expected 2 to 4)`);
  template.steps.forEach((s, i) => {
    if (s.distractors.length !== 3) formatProblems.push(`step ${i + 1} has ${s.distractors.length} wrong options (expected 3)`);
  });
  for (const v of template.variables) {
    if (!(v.step > 0) || v.max < v.min) formatProblems.push(`variable ${v.name} has an invalid range`);
  }

  const health = formatProblems.length ? { ok: 0, tries: 0, error: 'not tested: format problems' } : healthCheck(template);
  const combinations = template.variables.reduce((n, v) => n * (v.step > 0 ? Math.floor((v.max - v.min) / v.step + 1e-9) + 1 : 1), 1);
  const healthy = !health.error && health.tries > 0 && health.ok / health.tries >= 0.5;

  // Two versions solved blind by the model; its choices must match what the formulas produced.
  const verify: Saved['verify'] = { versions_checked: 0, disagreements: [], blocking_problems: [], minor_notes: [] };
  if (healthy) {
    const rand = seededRandom(1000 + Number(id.slice(-3)));
    for (let n = 0; n < 2; n++) {
      const inst = instantiate(template, rand);
      const v = await verifyVersion(client, model, template, inst);
      verify.versions_checked++;
      if (!v) {
        verify.blocking_problems.push('the checker returned nothing');
        continue;
      }
      inst.steps.forEach((s, i) => {
        const chosen = v.answers[i]?.chosen_index;
        if (chosen !== s.correctAnswer) {
          verify.disagreements.push(
            `version ${n + 1}, step ${i + 1}: formula gives ${s.options[s.correctAnswer]} but the checker ${chosen === -1 || chosen === undefined ? 'found no correct option' : `chose ${s.options[chosen]}`}`,
          );
        }
      });
      for (const p of v.problems) (p.severity === 'blocking' ? verify.blocking_problems : verify.minor_notes).push(p.text);
    }
  }

  const pos = (t: string) => (order.indexOf(t) === -1 ? order.length : order.indexOf(t));
  const topics = [...new Set(template.steps.flatMap((s) => s.topics))].filter((t) => allowed.includes(t)).sort((a, b) => pos(a) - pos(b));
  if (topics.length === 0) topics.push(seedQ.primary_topic);
  const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  const dir = join(outRoot, id);
  await mkdir(dir, { recursive: true });
  let figure: Saved['figure'] = { attempted: false, ok: false, retried: false, problems: [], error: '' };
  if (healthy && wantsFigure) {
    try {
      figure = await addFigure(client, model, template, dir);
    } catch (err) {
      figure = { attempted: true, ok: false, retried: false, problems: [], error: (err as Error).message.split('\n')[0] };
    }
  }

  const saved: Saved = {
    id,
    template,
    subject,
    topics,
    topic_key: topics.map(slug).join('-'),
    is_mixed: topics.length > 1,
    level: topics.every((t) => pos(t) < (AS_TOPIC_COUNT[subject] ?? order.length)) ? 'A1' : 'A2',
    health,
    combinations,
    verify,
    figure,
    format_problems: formatProblems,
    usable: healthy && verify.disagreements.length === 0 && verify.blocking_problems.length === 0,
    references: [`${seedQ.id} ${focus.label}`.trim()],
    model,
  };
  await writeFile(join(dir, 'template.json'), JSON.stringify(saved, null, 2));
  return saved;
}

async function buildReview(outRoot: string, versions: number): Promise<{ total: number; usable: number }> {
  const all: Saved[] = [];
  for (const entry of (await readdir(outRoot, { withFileTypes: true })).filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const f = join(outRoot, entry.name, 'template.json');
    if (await exists(f)) all.push(JSON.parse(await readFile(f, 'utf8')) as Saved);
  }

  const cards: string[] = [];
  for (const s of all) {
    const t = s.template;
    const dir = join(outRoot, s.id);
    const healthy = !s.health.error && s.health.tries > 0 && s.health.ok / s.health.tries >= 0.5;
    const cols: string[] = [];
    if (healthy) {
      const rand = seededRandom(42 + Number(s.id.slice(-3)));
      for (let n = 1; n <= versions; n++) {
        const inst = instantiate(t, rand);
        const vdir = join(dir, `v${n}`);
        await rm(vdir, { recursive: true, force: true });
        await mkdir(vdir, { recursive: true });
        await writeFile(join(vdir, 'question.json'), JSON.stringify(inst, null, 2));
        let figHtml = '';
        if (t.needs_figure && t.figure_script.trim()) {
          // Figures get only the given data, never derived values or answers.
          const givens = Object.fromEntries(t.variables.map((v) => [v.name, inst.values[v.name]]));
          const fig = await renderFigure(t, { ...inst, values: givens }, vdir);
          figHtml = fig.ok ? `<img src="${esc(s.id)}/v${n}/figure.svg" alt="figure">` : `<p class="bad">Figure failed: ${esc(fig.error)}</p>`;
        }
        cols.push(`<div class="ver"><h3>Version ${n} · main question, ${inst.main_question_timer_seconds} s</h3><p class="main">${esc(inst.stem)}</p>${figHtml}
${inst.steps
  .map(
    (st, i) => `<div class="step"><b>Step ${i + 1}: ${esc(st.title)}</b> <small>${st.marks} mk · ${st.timeLimitSeconds} s</small><div>${esc(st.prompt)}</div>
<ol type="A">${st.options.map((o, k) => `<li class="${k === st.correctAnswer ? 'ok' : ''}">${esc(o)}</li>`).join('')}</ol><div class="exp">${esc(st.explanation)}</div></div>`,
  )
  .join('')}</div>`);
      }
    }
    const warn = [
      ...s.format_problems,
      ...(s.health.error ? [`Formula error: ${s.health.error}`] : []),
      ...(!s.health.error && s.health.tries > 0 && !healthy ? [`Only ${s.health.ok} of ${s.health.tries} random versions were valid`] : []),
      ...s.verify.disagreements.map((d) => `Answer check: ${d}`),
      ...s.verify.blocking_problems.map((d) => `Checker: ${d}`),
      ...(s.figure?.attempted && s.figure.error ? [`Figure code failed: ${s.figure.error}`] : []),
      ...(s.figure?.attempted && !s.figure.error && !s.figure.ok ? s.figure.problems.map((p) => `Figure: ${p}`) : []),
    ];
    cards.push(`<section class="card${s.usable ? '' : ' flag'}">
<h2>${esc(t.title)} <small><span class="${s.is_mixed ? 'mixed' : 'single'}">${esc(s.topics.join(' + '))}</span> · ${esc(s.level)} · ${esc(t.difficulty)} · ${s.combinations.toLocaleString('en')} possible versions · ${s.usable ? 'passed checks' : 'NOT usable as is'}</small></h2>
<p class="vars"><b>What changes:</b> ${t.variables.map((v) => `<code>${esc(v.name)}</code> ${v.min} to ${v.max} in steps of ${v.step}`).join('; ')}</p>
${warn.length ? `<ul class="warn">${warn.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
${s.verify.minor_notes.length ? `<ul class="minor">${s.verify.minor_notes.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
<div class="vers">${cols.join('')}</div>
<details><summary>Formulas</summary><pre>${esc(
      [
        ...t.derived.map((d) => `${d.name} = ${d.expr}`),
        ...t.constraints.map((c) => `require ${c}`),
        ...t.steps.flatMap((st, i) => [`step ${i + 1} answer = ${st.answer_expr}`, ...st.distractors.map((d) => `   wrong: ${d.expr}   (${d.mistake})`)]),
      ].join('\n'),
    )}</pre></details>
</section>`);
  }

  const usable = all.filter((s) => s.usable).length;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Question templates</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"
  onload="renderMathInElement(document.body,{delimiters:[{left:'$',right:'$',display:false}],throwOnError:false})"></script>
<style>
body{font:14px/1.5 system-ui,sans-serif;margin:0 auto;padding:16px;max-width:1400px;background:#f4f4f5;color:#18181b}
h1{font-size:20px;margin:0 0 4px} h2{font-size:17px;margin:0 0 6px} h3{font-size:13px;margin:0 0 4px;color:#52525b}
small{font-weight:400;color:#52525b;margin-left:6px}
.card{background:#fff;border:1px solid #d4d4d8;border-radius:8px;padding:12px 16px;margin:0 0 16px}
.card.flag{border-left:6px solid #dc2626}
.vers{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:8px}
.ver{border:1px solid #e4e4e7;border-radius:6px;padding:8px 10px;min-width:0}
img{max-width:100%;display:block;margin:6px 0;border:1px solid #e4e4e7}
.step{border-top:1px solid #e4e4e7;padding:6px 0} ol{margin:2px 0;padding-left:24px} li.ok{color:#15803d;font-weight:600}
.main{font-weight:600} .exp{color:#71717a;font-size:13px} .vars{color:#3f3f46;margin:0} .warn{color:#b91c1c;margin:6px 0 0;padding-left:18px} .minor{color:#71717a;font-size:13px;margin:6px 0 0;padding-left:18px}
.bad{color:#b91c1c} .mixed{color:#7c3aed} .single{color:#0f766e} code{background:#f4f4f5;padding:1px 4px;border-radius:4px}
pre{background:#f4f4f5;padding:8px;border-radius:6px;overflow:auto;font-size:12px} summary{cursor:pointer;color:#52525b;margin-top:8px}
</style></head><body>
<h1>Question templates</h1>
<p>${all.length} templates, ${usable} passed every check. Each card shows ${versions} versions made from the same template: same scenario, different numbers, answers computed by formula. The correct option is in green.</p>
${cards.join('\n')}
</body></html>`;
  await writeFile(join(outRoot, 'review.html'), html);
  await writeFile(join(outRoot, 'templates.json'), JSON.stringify(all, null, 2));
  return { total: all.length, usable };
}

async function main(): Promise<void> {
  const flags = new Map(
    process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
      const [k, ...v] = a.slice(2).split('=');
      return [k, v.join('=') || 'true'] as const;
    }),
  );
  const subject = flags.get('subject') ?? '9702';
  const target = Number(flags.get('count') ?? '8');
  const versions = Number(flags.get('versions') ?? '3');
  const model = flags.get('model') ?? 'claude-haiku-5-5';
  const rand = seededRandom(Number(flags.get('seed') ?? '1'));
  const outRoot = resolve(process.cwd(), 'papers', '_templates');
  await mkdir(outRoot, { recursive: true });

  if (!flags.has('review-only')) {
    // References: single-topic calculation parts worth 2+ marks. Their marking points are the
    // working route, which is what the game's steps check.
    const pairs = (JSON.parse(await readFile(resolve('papers/_extracted/all.json'), 'utf8')) as RefQuestion[])
      .filter((q) => q.subject === subject)
      .flatMap((q) =>
        q.parts
          .filter((p) => p.kind === 'calculation' && p.marks >= 2 && p.topics.length === 1 && p.topics[0] !== 'Other' && p.mark_points.length >= 2)
          .map((p) => ({ q, p })),
      );
    const order = (JSON.parse(await readFile(resolve('papers/_extracted/topic_order.json'), 'utf8')) as Record<string, string[]>)[subject] ?? [];
    const guide =
      (JSON.parse(await readFile(resolve('papers/_extracted/topic_guide.json'), 'utf8').catch(() => '{}')) as Record<string, Record<string, string>>)[subject] ?? {};
    const byTopic = new Map<string, { q: RefQuestion; p: RefPart }[]>();
    for (const pair of pairs) byTopic.set(pair.p.topics[0], [...(byTopic.get(pair.p.topics[0]) ?? []), pair]);
    const wanted = flags.get('topic');
    const topics = (wanted ? [wanted] : order).filter((t) => byTopic.has(t));
    if (topics.length === 0) {
      console.error('No reference questions found for that subject or topic.');
      process.exit(1);
    }
    // Spread the templates evenly across the topic list.
    const stride = Math.max(1, Math.floor(topics.length / target));
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const existing = (await readdir(outRoot, { withFileTypes: true })).filter((e) => e.isDirectory()).length;
    const jobs = Array.from({ length: target }, (_, i) => {
      const list = byTopic.get(topics[(i * stride) % topics.length])!;
      const pair = list[Math.floor(rand() * list.length)];
      return { id: `tpl_${subject}_${stamp}_${String(existing + i + 1).padStart(3, '0')}`, seedQ: pair.q, focus: pair.p };
    });

    console.log(`\nWriting ${jobs.length} ${subject} template(s) with ${model}.\n`);
    const client = new Anthropic({ maxRetries: 6 });
    // Titles already used per topic, so new templates are steered towards fresh situations.
    const used = new Map<string, string[]>();
    for (const entry of (await readdir(outRoot, { withFileTypes: true })).filter((e) => e.isDirectory())) {
      const f = join(outRoot, entry.name, 'template.json');
      if (!(await exists(f))) continue;
      const prev = JSON.parse(await readFile(f, 'utf8')) as Saved;
      for (const t of prev.topics) used.set(t, [...(used.get(t) ?? []), prev.template.title]);
    }
    let cursor = 0;
    const worker = async () => {
      for (let job = jobs[cursor++]; job; job = jobs[cursor++]) {
        try {
          const s = await makeOne(client, model, subject, order, guide, job.seedQ, job.focus, job.id, outRoot, [...(used.get(job.focus.topics[0]) ?? [])]);
          if (s) used.set(job.focus.topics[0], [...(used.get(job.focus.topics[0]) ?? []), s.template.title]);
          if (!s) {
            console.warn(`  ! ${job.id}: nothing usable came back`);
            continue;
          }
          const why = s.usable
            ? 'passed'
            : s.health.error
              ? `FORMULA ERROR: ${s.health.error}`
              : s.format_problems[0] ?? s.verify.disagreements[0] ?? s.verify.blocking_problems[0] ?? `only ${s.health.ok}/${s.health.tries} versions valid`;
          console.log(`  ${job.id}  ${s.template.title} [${s.topics.join(' + ')}]  ${why.slice(0, 150)}`);
        } catch (err) {
          if (err instanceof Anthropic.APIError) console.warn(`  ! ${job.id}: API error ${err.status}: ${err.message}`);
          else console.warn(`  ! ${job.id}: ${(err as Error).message}`);
        }
      }
    };
    await Promise.all(Array.from({ length: 5 }, worker));
    console.log(`\nTokens used: ${usage.input} in, ${usage.output} out.`);
  }

  const totals = await buildReview(outRoot, versions);
  console.log(`\nReview page (${totals.total} templates, ${totals.usable} passed every check): ${join(outRoot, 'review.html')}`);
}

main().catch((err) => {
  console.error('\nTemplate maker failed:', err);
  process.exit(1);
});
