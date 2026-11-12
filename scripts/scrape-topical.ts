/**
 * Topical Past-Paper Image Scraper
 *
 * Downloads every question (and mark-scheme) image for a given Cambridge
 * topic from educateachange.com's server-rendered "study sheet" pages, and
 * writes a metadata `index.json` alongside the images.
 *
 * The study-sheet view is fully server-rendered, so no browser automation is
 * needed - a plain fetch returns all image URLs in the raw HTML. The site's
 * client-side right-click / F12 blocking never runs here.
 *
 * Usage:
 *   npx tsx scripts/scrape-topical.ts <topic> [flags]
 *   npm run scrape:topical -- <topic> [flags]
 *
 * Examples:
 *   npx tsx scripts/scrape-topical.ts kinematics
 *   npx tsx scripts/scrape-topical.ts kinematics --from=2010 --to=2025 --papers=p1,p2,p4
 *
 * Flags:
 *   --from=<year>        Start year (default 1990)
 *   --to=<year>          End year (default 2025)
 *   --papers=<list>      Comma-separated study types (default p1,p2,p3,p4,p5)
 *   --subject=<slug>     Subject slug (default physics-9702)
 *   --per-page=<n>       Questions per page: 10 | 25 | 50 (default 50)
 *   --out=<dir>          Output root (default scraped)
 *   --delay=<ms>         Delay between image downloads (default 500)
 *   --records=<file>     Skip crawling; download from a pre-collected records
 *                        JSON array instead. Each item needs at least
 *                        { id, year, session, paper, paperType, question,
 *                        marks, answer, transcript, imageUrl, markSchemeUrl }.
 *                        Use this when the HTML pages sit behind a bot
 *                        challenge (Cloudflare) and were collected via the
 *                        browser; the image URLs are served directly and work
 *                        from Node.
 *
 * NOTE: Images are copyrighted Cambridge material. Use privately for
 * reference only; `scraped/` is git-ignored. Do not publish or commit them.
 */

import * as cheerio from 'cheerio';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { join, resolve } from 'node:path';

const BASE_HOST = 'https://educateachange.com';
const PAPER_TYPES_DEFAULT = ['p1', 'p2', 'p3', 'p4', 'p5'];

interface Options {
  topic: string;
  subject: string;
  from: string;
  to: string;
  papers: string[];
  perPage: number;
  outRoot: string;
  delayMs: number;
  recordsFile: string | null;
}

/** Raw, un-named question as parsed from a page or supplied via --records. */
interface RawQuestion {
  id: string;
  year: string;
  session: string;
  paper: string;
  paperType: string;
  question: string;
  marks: string;
  answer: string;
  transcript: string;
  imageUrl: string | null;
  markSchemeUrl: string | null;
}

interface QuestionRecord {
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
  sourceImageUrl: string | null;
  sourceMarkSchemeUrl: string | null;
}

function parseArgs(argv: string[]): Options {
  const positionals: string[] = [];
  const flags = new Map<string, string>();
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      flags.set(key, rest.join('=') || 'true');
    } else {
      positionals.push(arg);
    }
  }
  const topic = positionals[0] ?? 'kinematics';
  const papersFlag = flags.get('papers');
  return {
    topic,
    subject: flags.get('subject') ?? 'physics-9702',
    from: flags.get('from') ?? '1990',
    to: flags.get('to') ?? '2025',
    papers: papersFlag ? papersFlag.split(',').map((p) => p.trim()).filter(Boolean) : PAPER_TYPES_DEFAULT,
    perPage: Number(flags.get('per-page') ?? '50'),
    outRoot: flags.get('out') ?? 'scraped',
    delayMs: Number(flags.get('delay') ?? '500'),
    recordsFile: flags.get('records') ?? null,
  };
}

function buildUrl(opts: Options, study: string, page: number): string {
  const path = `/past-papers/topical/as-a-level/${opts.subject}/${opts.topic}/`;
  const params = new URLSearchParams({
    from: opts.from,
    to: opts.to,
    per_page: String(opts.perPage),
    study,
    answers: 'end',
    p: String(page),
  });
  return `${BASE_HOST}${path}?${params.toString()}`;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      Referer: `${BASE_HOST}/`,
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function sessionCode(session: string): string {
  const map: Record<string, string> = {
    'october-november': 'ON',
    'may-june': 'MJ',
    'february-march': 'FM',
    'march': 'MR',
  };
  const key = session.toLowerCase();
  if (map[key]) return map[key];
  return session.replace(/[^a-z0-9]+/gi, '').toUpperCase().slice(0, 3) || 'XX';
}

function sanitize(part: string): string {
  return part.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'x';
}

/** Parse "Page 1 of 7 ..." from the study pagination block. */
function parsePageCount($: cheerio.CheerioAPI): number {
  const text = $('.ayloti-study-pagination span').first().text();
  const m = text.match(/Page\s+\d+\s+of\s+(\d+)/i);
  return m ? Number(m[1]) : 1;
}

function parseMatchCount($: cheerio.CheerioAPI): number | null {
  const text = $('.ayloti-study-hero p').first().text();
  const m = text.match(/(\d+)\s+matching questions/i);
  return m ? Number(m[1]) : null;
}

interface ParsedQuestion {
  id: string;
  year: string;
  session: string;
  paper: string;
  question: string;
  marks: string;
  answer: string;
  transcript: string;
  imageUrl: string | null;
  markSchemeUrl: string | null;
}

function parseQuestions($: cheerio.CheerioAPI): ParsedQuestion[] {
  const out: ParsedQuestion[] = [];
  $('article.ayloti-study-item').each((_, article) => {
    const $article = $(article);
    const domId = $article.attr('id') ?? '';
    const id = domId.replace('study-question-', '').trim();

    const question = $article.find('.ayloti-study-item-head strong').first().text().replace(/^Question\s*/i, '').trim();

    const metaSpans = $article
      .find('.ayloti-topical-qmeta span')
      .map((__, s) => $(s).text().trim())
      .get();
    const year = metaSpans.find((t) => /^\d{4}$/.test(t)) ?? '';
    const paper = (metaSpans.find((t) => /^Paper\b/i.test(t)) ?? '').replace(/^Paper\s*/i, '').trim();
    const marks = metaSpans.find((t) => /mark/i.test(t)) ?? '';
    const session = metaSpans.find((t) => t.includes('-') && !/^Paper/i.test(t)) ?? '';

    const imageUrl = $article.find('.ayloti-topical-image-stage img').first().attr('src') ?? null;

    const transcript = $article
      .find('.ayloti-searchable-transcript .ayloti-doc-content')
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    // Answer letter: prefer the official answer book, fall back to solver attr.
    const $answer = $(`#study-answer-${id}`);
    let answer = $answer.find('.ayloti-study-mcq-letter strong').first().text().trim();
    if (!answer) {
      answer = $article.find('[data-fallback-answer]').first().attr('data-fallback-answer') ?? '';
    }
    const markSchemeUrl = $answer.find('.ayloti-study-answer-images img').first().attr('src') ?? null;

    out.push({ id, year, session, paper, question, marks, answer, transcript, imageUrl, markSchemeUrl });
  });
  return out;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function downloadImage(url: string, destPath: string): Promise<boolean> {
  if (await fileExists(destPath)) return false; // already have it; skip
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      Referer: `${BASE_HOST}/`,
      Accept: 'image/avif,image/webp,image/png,image/*',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for image ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function extOf(url: string): string {
  const clean = url.split('?')[0];
  const m = clean.match(/\.(png|jpe?g|webp|svg)$/i);
  return m ? m[1].toLowerCase() : 'png';
}

interface DownloadStats {
  imagesSaved: number;
  imagesSkipped: number;
}

/**
 * Shared routine: given raw questions, name and download their images and
 * return the finalised index records. Deduplicates by question id and by
 * output filename. Mutates the passed stats accumulator.
 */
async function downloadRecords(
  raws: RawQuestion[],
  outDir: string,
  delayMs: number,
  stats: DownloadStats,
  usedNames: Set<string>,
  seenIds: Set<string>,
): Promise<QuestionRecord[]> {
  const records: QuestionRecord[] = [];
  let downloadsSinceSleep = 0;

  const maybeSleep = async () => {
    if (downloadsSinceSleep > 0) {
      await sleep(delayMs);
      downloadsSinceSleep = 0;
    }
  };

  for (const q of raws) {
    if (seenIds.has(q.id)) continue; // same question can appear under multiple views
    seenIds.add(q.id);

    const baseName = `${q.year || 'YYYY'}_${sessionCode(q.session)}_P${q.paper || 'XX'}_Q${sanitize(q.question)}`;
    let name = baseName;
    if (usedNames.has(name)) name = `${baseName}_${q.id}`;
    usedNames.add(name);

    let imageFile: string | null = null;
    if (q.imageUrl) {
      const fileName = `${name}.${extOf(q.imageUrl)}`;
      try {
        const saved = await downloadImage(q.imageUrl, join(outDir, fileName));
        if (saved) {
          stats.imagesSaved++;
          downloadsSinceSleep++;
        } else {
          stats.imagesSkipped++;
        }
        imageFile = fileName;
      } catch (err) {
        console.warn(`    ! question image failed (${name}): ${(err as Error).message}`);
      }
      await maybeSleep();
    }

    let markSchemeFile: string | null = null;
    if (q.markSchemeUrl) {
      const fileName = `${name}_ms.${extOf(q.markSchemeUrl)}`;
      try {
        const saved = await downloadImage(q.markSchemeUrl, join(outDir, fileName));
        if (saved) {
          stats.imagesSaved++;
          downloadsSinceSleep++;
        } else {
          stats.imagesSkipped++;
        }
        markSchemeFile = fileName;
      } catch (err) {
        console.warn(`    ! mark-scheme image failed (${name}): ${(err as Error).message}`);
      }
      await maybeSleep();
    }

    records.push({
      id: q.id,
      year: q.year,
      session: q.session,
      paper: q.paper,
      paperType: q.paperType,
      question: q.question,
      marks: q.marks,
      answer: q.answer,
      imageFile,
      markSchemeFile,
      transcript: q.transcript,
      sourceImageUrl: q.imageUrl,
      sourceMarkSchemeUrl: q.markSchemeUrl,
    });
  }

  return records;
}

/** Crawl the live site (works only when the host is not behind a challenge). */
async function collectByCrawling(
  opts: Options,
  outDir: string,
  stats: DownloadStats,
  usedNames: Set<string>,
  seenIds: Set<string>,
): Promise<QuestionRecord[]> {
  const records: QuestionRecord[] = [];
  const perPaperFound: Record<string, number> = {};

  for (const study of opts.papers) {
    let pageCount = 1;
    let matchCount: number | null = null;
    let foundForPaper = 0;

    for (let page = 1; page <= pageCount; page++) {
      const url = buildUrl(opts, study, page);
      let html: string;
      try {
        html = await fetchHtml(url);
      } catch (err) {
        console.warn(`  [${study}] page ${page}: fetch failed - ${(err as Error).message}`);
        break;
      }
      const $ = cheerio.load(html);
      if (page === 1) {
        pageCount = parsePageCount($);
        matchCount = parseMatchCount($);
      }
      const parsed = parseQuestions($).map<RawQuestion>((q) => ({ ...q, paperType: study }));
      if (parsed.length === 0) {
        if (page === 1) console.log(`  [${study}] no questions for this paper type - skipping`);
        break;
      }

      const pageRecords = await downloadRecords(parsed, outDir, opts.delayMs, stats, usedNames, seenIds);
      records.push(...pageRecords);
      foundForPaper += pageRecords.length;
      console.log(`  [${study}] page ${page}/${pageCount}: ${parsed.length} parsed, ${pageRecords.length} new`);
    }

    if (foundForPaper > 0) {
      perPaperFound[study] = foundForPaper;
      const note = matchCount != null ? ` (site reports ${matchCount} matching)` : '';
      console.log(`  [${study}] total new questions: ${foundForPaper}${note}`);
    }
  }

  return records;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const outDir = resolve(process.cwd(), opts.outRoot, opts.topic);
  await mkdir(outDir, { recursive: true });

  const stats: DownloadStats = { imagesSaved: 0, imagesSkipped: 0 };
  const usedNames = new Set<string>();
  const seenIds = new Set<string>();
  let records: QuestionRecord[];

  if (opts.recordsFile) {
    console.log(`\nDownloading topic "${opts.topic}" from records file: ${opts.recordsFile}`);
    console.log(`Output: ${outDir}\n`);
    const rawText = await readFile(resolve(process.cwd(), opts.recordsFile), 'utf8');
    const raws = JSON.parse(rawText) as RawQuestion[];
    // Fill any missing paperType so filenames/index stay consistent.
    for (const r of raws) if (!r.paperType) r.paperType = 'unknown';
    records = await downloadRecords(raws, outDir, opts.delayMs, stats, usedNames, seenIds);
    console.log(`  Parsed ${raws.length} records, ${records.length} unique.`);
  } else {
    console.log(`\nScraping topic "${opts.topic}" (${opts.subject}) years ${opts.from}-${opts.to}`);
    console.log(`Paper types: ${opts.papers.join(', ')} | per_page=${opts.perPage} | out=${outDir}\n`);
    records = await collectByCrawling(opts, outDir, stats, usedNames, seenIds);
  }

  const indexPath = join(outDir, 'index.json');
  await writeFile(indexPath, JSON.stringify(records, null, 2));

  console.log('\nDone.');
  console.log(`  Questions recorded: ${records.length}`);
  console.log(`  Images downloaded:  ${stats.imagesSaved} (skipped existing: ${stats.imagesSkipped})`);
  console.log(`  Index written:      ${indexPath}`);
}

main().catch((err) => {
  console.error('\nScraper failed:', err);
  process.exit(1);
});
