/**
 * Past-paper question extractor ("record the papers" step)
 *
 * Reads a topic folder produced by scripts/scrape-topical.ts, sends each
 * question image (plus its mark-scheme image, when there is one) to Claude,
 * and saves a structured record per question. Then builds a review page that
 * shows every original image next to what was extracted, so a human can check
 * accuracy quickly.
 *
 * Usage:
 *   npx tsx scripts/extract-questions.ts <topic> [flags]
 *   npm run extract:questions -- <topic> [flags]
 *
 * Examples:
 *   npx tsx scripts/extract-questions.ts kinematics              (20-question pilot)
 *   npx tsx scripts/extract-questions.ts kinematics --limit=all  (everything)
 *
 * Flags:
 *   --limit=<n|all>      How many questions to process (default 20). The sample
 *                        is spread across paper types (MCQ and structured).
 *   --model=<id>         Claude model (default claude-opus-5-5)
 *   --concurrency=<n>    Parallel requests (default 4)
 *   --root=<dir>         Scrape root (default scraped)
 *   --review-only        Skip the API; just rebuild review.html
 *
 * Needs ANTHROPIC_API_KEY in .env (or the environment). Already-extracted
 * questions are skipped, so the script is safe to re-run and resume.
 *
 * Output (all inside the git-ignored scrape folder):
 *   <root>/<topic>/extracted/<name>.json   one record per question
 *   <root>/<topic>/extracted.json          all records combined
 *   <root>/<topic>/review.html             side-by-side checking page
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { mkdir, readFile, writeFile, access, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

interface IndexRecord {
  id: string;
  year: string;
  session: string;
  paper: string;
  paperType: string;
  question: string;
  marks: string;
  answer: string;
  imageFile: string | null;
  markSchemeFile: string | null;
  transcript: string;
}

const Extraction = z.object({
  kind: z.enum(['mcq', 'structured']),
  stem: z
    .string()
    .describe('The full question wording, exactly as printed, without the question number, options, answer lines or mark brackets. Maths and units in LaTeX between $ signs.'),
  context_from_earlier_parts: z
    .string()
    .describe('For a part of a longer question: any information shown in the image that comes from earlier parts and is needed here. Empty string if none.'),
  options: z
    .array(z.object({ label: z.string(), text: z.string() }))
    .describe('MCQ options in order, LaTeX between $ signs. Empty for structured questions. If an option is a row of a table or a graph, describe it in words.'),
  correct_option: z.string().describe('Correct MCQ letter, or empty string for structured questions.'),
  final_answer: z.string().describe('The final answer with unit. For MCQ, the text of the correct option.'),
  mark_points: z.array(z.string()).describe('Each marking point from the mark scheme, one per entry. Empty if no mark scheme was provided.'),
  marks: z.number().int(),
  has_figure: z.boolean(),
  figure_type: z.enum(['none', 'graph', 'diagram', 'table', 'photo', 'mixed']),
  figure_description: z
    .string()
    .describe('Enough detail to redraw the figure from scratch: axes, labels, units, scales, plotted values, shapes, annotations. Empty string if no figure.'),
  given_quantities: z.array(
    z.object({ name: z.string(), symbol: z.string(), value: z.string(), unit: z.string() }),
  ),
  asked_for: z.string().describe('What the student must find or do, in a few words.'),
  subtopic: z.string().describe('Specific syllabus subtopic, e.g. "velocity-time graphs" or "projectile motion".'),
  archetype: z
    .string()
    .describe('snake_case name for the mechanical operation the question requires, independent of topic, e.g. read_gradient_from_graph, apply_suvat_single_step, area_under_graph.'),
  skills: z.array(z.string()),
  difficulty: z.number().int().describe('1 (direct recall) to 5 (multi-step, unfamiliar context).'),
  solution_outline: z.string().describe('Short worked solution, LaTeX between $ signs.'),
  answer_check: z
    .enum(['agrees', 'disagrees', 'not_checked'])
    .describe('Whether your own solution agrees with the official answer provided.'),
  transcription_confidence: z.enum(['high', 'medium', 'low']),
  issues: z.array(z.string()).describe('Anything unreadable, ambiguous or cut off. Empty if none.'),
});
type Extraction = z.infer<typeof Extraction>;

const SYSTEM = `You transcribe Cambridge International AS & A Level exam questions into structured records for a private question database.

You are given an image of one question (or one part of a question), sometimes an image of its mark scheme, and some metadata. A rough machine transcript is included only as a hint: it has no formatting and its figure text is scrambled, so always trust the image over it.

Rules:
- Transcribe wording exactly. Do not paraphrase, shorten or correct it.
- Write maths, symbols and units in LaTeX between $ signs, e.g. $4.0\\,\\mathrm{m\\,s^{-1}}$.
- Ignore watermarks and site branding printed over the image.
- Read values off graphs and diagrams carefully; if a value cannot be read with confidence, say so in "issues" instead of guessing.
- Solve the question yourself and compare with the official answer. If they disagree, re-read the image before reporting "disagrees".
- Only report what is in the images. Leave fields empty when the information is not there.`;

interface Options {
  topic: string;
  limit: number;
  model: string;
  concurrency: number;
  root: string;
  reviewOnly: boolean;
}

function parseArgs(argv: string[]): Options {
  const positionals: string[] = [];
  const flags = new Map<string, string>();
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      flags.set(key, rest.join('=') || 'true');
    } else positionals.push(arg);
  }
  const limitFlag = flags.get('limit') ?? '20';
  return {
    topic: positionals[0] ?? 'kinematics',
    limit: limitFlag === 'all' ? Infinity : Number(limitFlag),
    model: flags.get('model') ?? 'claude-opus-5-5',
    concurrency: Number(flags.get('concurrency') ?? '4'),
    root: flags.get('root') ?? 'scraped',
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

/** Take up to `limit` records, round-robin across paper types for a mixed sample. */
function pickSample(records: IndexRecord[], limit: number): IndexRecord[] {
  const usable = records.filter((r) => r.imageFile);
  if (limit >= usable.length) return usable;
  const groups = new Map<string, IndexRecord[]>();
  for (const r of usable) {
    const g = groups.get(r.paperType) ?? [];
    g.push(r);
    groups.set(r.paperType, g);
  }
  const lists = [...groups.values()];
  const out: IndexRecord[] = [];
  for (let i = 0; out.length < limit; i++) {
    let added = false;
    for (const list of lists) {
      // Step through each group evenly so years are spread out too.
      const step = Math.max(1, Math.floor(list.length / Math.ceil(limit / lists.length)));
      const item = list[i * step];
      if (item && out.length < limit) {
        out.push(item);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

function mediaType(file: string): 'image/png' | 'image/jpeg' | 'image/webp' {
  const ext = file.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  return 'image/png';
}

async function imageBlock(dir: string, file: string): Promise<Anthropic.Beta.BetaImageBlockParam> {
  const data = (await readFile(join(dir, file))).toString('base64');
  return { type: 'image', source: { type: 'base64', media_type: mediaType(file), data } };
}

interface Usage {
  input: number;
  output: number;
}

async function extractOne(
  client: Anthropic,
  opts: Options,
  dir: string,
  rec: IndexRecord,
  usage: Usage,
): Promise<Extraction | null> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    { type: 'text', text: 'Question image:' },
    await imageBlock(dir, rec.imageFile!),
  ];
  if (rec.markSchemeFile && (await exists(join(dir, rec.markSchemeFile)))) {
    content.push({ type: 'text', text: 'Mark scheme image:' }, await imageBlock(dir, rec.markSchemeFile));
  }
  content.push({
    type: 'text',
    text: [
      `Metadata: ${rec.year} ${rec.session}, Paper ${rec.paper}, Question ${rec.question}, ${rec.marks}.`,
      rec.answer ? `Official answer: ${rec.answer}` : 'Official answer: see mark scheme image.',
      `Rough transcript (hint only): ${rec.transcript}`,
    ].join('\n'),
  });

  const response = await client.beta.messages.parse({
    model: opts.model,
    max_tokens: 16000,
    // Server-side refusal fallback is not offered on Haiku models.
    ...(opts.model.includes('haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
    system: SYSTEM,
    messages: [{ role: 'user', content }],
    output_config: { effort: 'medium', format: betaZodOutputFormat(Extraction) },
  });

  usage.input += response.usage.input_tokens;
  usage.output += response.usage.output_tokens;

  if (response.stop_reason === 'refusal') {
    console.warn(`  ! ${rec.imageFile}: model declined (${response.stop_details?.category ?? 'no category'})`);
    return null;
  }
  if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
    console.warn(`  ! ${rec.imageFile}: no usable output (stop_reason=${response.stop_reason})`);
    return null;
  }
  return response.parsed_output;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface Saved {
  source: IndexRecord;
  extraction: Extraction;
  model: string;
}

async function buildReview(dir: string, outDir: string): Promise<number> {
  const files = (await readdir(outDir)).filter((f) => f.endsWith('.json')).sort();
  const all: Saved[] = [];
  for (const f of files) all.push(JSON.parse(await readFile(join(outDir, f), 'utf8')) as Saved);
  await writeFile(join(dir, 'extracted.json'), JSON.stringify(all, null, 2));

  const cards = all
    .map(({ source: s, extraction: e }) => {
      const flag =
        e.answer_check === 'disagrees' || e.transcription_confidence !== 'high' || e.issues.length > 0;
      const opts = e.options
        .map((o) => `<li class="${o.label === e.correct_option ? 'ok' : ''}"><b>${esc(o.label)}</b> ${esc(o.text)}</li>`)
        .join('');
      const given = e.given_quantities
        .map((g) => `${esc(g.name)}${g.symbol ? ` (${esc(g.symbol)})` : ''} = ${esc(g.value)} ${esc(g.unit)}`)
        .join('; ');
      const row = (k: string, v: string) => (v ? `<tr><th>${k}</th><td>${v}</td></tr>` : '');
      return `<section class="card${flag ? ' flag' : ''}">
<h2>${esc(`${s.year} ${s.session} · Paper ${s.paper} · Q${s.question}`)} <small>${esc(e.kind)} · ${e.marks} mark(s) · confidence ${esc(e.transcription_confidence)} · answer check ${esc(e.answer_check)}</small></h2>
<div class="cols">
<div><img src="${esc(s.imageFile ?? '')}" loading="lazy">${s.markSchemeFile ? `<img src="${esc(s.markSchemeFile)}" loading="lazy">` : ''}</div>
<div><table>
${row('Context', esc(e.context_from_earlier_parts))}
${row('Question', esc(e.stem))}
${row('Options', opts ? `<ul>${opts}</ul>` : '')}
${row('Answer', esc(e.final_answer))}
${row('Mark points', e.mark_points.length ? `<ul>${e.mark_points.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : '')}
${row('Figure', e.has_figure ? `<i>${esc(e.figure_type)}</i> ${esc(e.figure_description)}` : '')}
${row('Given', given)}
${row('Asked for', esc(e.asked_for))}
${row('Subtopic', esc(e.subtopic))}
${row('Archetype', `<code>${esc(e.archetype)}</code>`)}
${row('Difficulty', `${e.difficulty} / 5`)}
${row('Solution', esc(e.solution_outline))}
${row('Issues', e.issues.length ? `<ul>${e.issues.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : '')}
</table></div>
</div></section>`;
    })
    .join('\n');

  const flagged = all.filter(
    ({ extraction: e }) => e.answer_check === 'disagrees' || e.transcription_confidence !== 'high' || e.issues.length > 0,
  ).length;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Extraction review</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"
  onload="renderMathInElement(document.body,{delimiters:[{left:'$',right:'$',display:false}],throwOnError:false})"></script>
<style>
body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:16px;background:#f4f4f5;color:#18181b}
h1{font-size:20px;margin:0 0 4px} p.sum{margin:0 0 16px;color:#52525b}
.card{background:#fff;border:1px solid #d4d4d8;border-radius:8px;padding:12px 16px;margin:0 0 16px}
.card.flag{border-left:6px solid #d97706}
h2{font-size:16px;margin:0 0 8px} h2 small{font-weight:400;color:#52525b;margin-left:8px}
.cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
@media(max-width:900px){.cols{grid-template-columns:1fr}}
img{max-width:100%;border:1px solid #e4e4e7;margin-bottom:8px;display:block}
table{border-collapse:collapse;width:100%} th{text-align:left;vertical-align:top;width:110px;color:#52525b;font-weight:600;padding:4px 8px 4px 0}
td{padding:4px 0;vertical-align:top} ul{margin:0;padding-left:18px} li.ok{color:#15803d;font-weight:600}
code{background:#f4f4f5;padding:1px 4px;border-radius:4px}
</style></head><body>
<h1>Extraction review</h1>
<p class="sum">${all.length} questions. ${flagged} flagged for a closer look (orange bar): low confidence, a noted issue, or the model's own answer disagreeing with the official one. Original on the left, extracted record on the right.</p>
${cards}
</body></html>`;
  await writeFile(join(dir, 'review.html'), html);
  return all.length;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const dir = resolve(process.cwd(), opts.root, opts.topic);
  const outDir = join(dir, 'extracted');
  await mkdir(outDir, { recursive: true });

  if (!opts.reviewOnly) {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      console.error('No ANTHROPIC_API_KEY found. Add it to .env (ANTHROPIC_API_KEY=...) and run again.');
      process.exit(1);
    }
    const index = JSON.parse(await readFile(join(dir, 'index.json'), 'utf8')) as IndexRecord[];
    const sample = pickSample(index, opts.limit);
    const todo: IndexRecord[] = [];
    for (const r of sample) {
      if (!(await exists(join(outDir, `${r.imageFile!.replace(/\.[^.]+$/, '')}.json`)))) todo.push(r);
    }
    console.log(`\nTopic "${opts.topic}": ${index.length} in index, ${sample.length} selected, ${todo.length} to extract (model ${opts.model}).\n`);

    const client = new Anthropic();
    const usage: Usage = { input: 0, output: 0 };
    let done = 0;
    let failed = 0;
    let cursor = 0;
    let fatal = false;

    const worker = async () => {
      while (!fatal) {
        const rec = todo[cursor++];
        if (!rec) return;
        try {
          const extraction = await extractOne(client, opts, dir, rec, usage);
          if (!extraction) {
            failed++;
            continue;
          }
          const saved: Saved = { source: rec, extraction, model: opts.model };
          await writeFile(join(outDir, `${rec.imageFile!.replace(/\.[^.]+$/, '')}.json`), JSON.stringify(saved, null, 2));
          done++;
          console.log(`  [${done + failed}/${todo.length}] ${rec.imageFile}  (${extraction.kind}, ${extraction.transcription_confidence}, ${extraction.answer_check})`);
        } catch (err) {
          failed++;
          if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
            console.error(`  ! API key rejected: ${err.message}`);
            fatal = true;
          } else if (err instanceof Anthropic.RateLimitError) {
            console.warn(`  ! ${rec.imageFile}: rate limited after retries; re-run later to pick it up`);
          } else if (err instanceof Anthropic.APIError) {
            console.warn(`  ! ${rec.imageFile}: API error ${err.status}: ${err.message}`);
          } else {
            console.warn(`  ! ${rec.imageFile}: ${(err as Error).message}`);
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, opts.concurrency) }, worker));

    console.log(`\nExtracted ${done}, failed ${failed}.`);
    console.log(`Tokens used: ${usage.input} in, ${usage.output} out.`);
    if (done > 0) {
      console.log(`Average per question: ${Math.round(usage.input / (done + failed))} in, ${Math.round(usage.output / (done + failed))} out.`);
    }
  }

  const total = await buildReview(dir, outDir);
  console.log(`\nReview page (${total} questions): ${join(dir, 'review.html')}`);
}

main().catch((err) => {
  console.error('\nExtractor failed:', err);
  process.exit(1);
});
