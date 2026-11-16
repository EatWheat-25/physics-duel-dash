/**
 * Past-paper PDF downloader
 *
 * Downloads Cambridge question papers and mark schemes for one syllabus into
 * the local papers folder, using the standard Cambridge file names that
 * scripts/extract-papers.ts expects. Files already present are skipped, so it
 * is safe to re-run. Anything that is not a real PDF is discarded.
 *
 * Usage:
 *   npx tsx scripts/download-papers.ts --subject=9702 --papers=2,4
 *   npm run download:papers -- --subject=9702 --papers=2,4
 *
 * Flags:
 *   --subject=<code>     Syllabus code, e.g. 9702 (required)
 *   --papers=<list>      Paper numbers, e.g. 2,4 (required)
 *   --from=<year>        First year (default 2015)
 *   --to=<year>          Last year (default: current year)
 *   --dir=<folder>       Output root (default papers); files go in <dir>/<subject>
 *   --delay=<ms>         Pause between downloads (default 600)
 *   --dry-run            List what would be requested and exit
 *
 * NOTE: the PDFs are copyrighted Cambridge material. Private reference only;
 * the papers folder is git-ignored. Do not publish or commit them.
 */

import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const BASE = 'https://pastpapers.papacambridge.com/directories/CAIE/CAIE-pastpapers/upload';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function parseFlags(argv: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      flags.set(key, rest.join('=') || 'true');
    }
  }
  return flags;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Every file name that could exist for the given range. */
function candidates(subject: string, papers: string[], from: number, to: number): string[] {
  const names: string[] = [];
  for (let year = from; year <= to; year++) {
    const yy = String(year % 100).padStart(2, '0');
    for (const session of ['m', 's', 'w']) {
      // Feb/March has a single variant (2); May/June and Oct/Nov have three.
      const variants = session === 'm' ? ['2'] : ['1', '2', '3'];
      for (const paper of papers) {
        for (const variant of variants) {
          for (const type of ['qp', 'ms']) names.push(`${subject}_${session}${yy}_${type}_${paper}${variant}.pdf`);
        }
      }
    }
  }
  return names;
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const subject = flags.get('subject');
  const papers = (flags.get('papers') ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  if (!subject || papers.length === 0) {
    console.error('Usage: download-papers --subject=9702 --papers=2,4 [--from=2015] [--to=2025]');
    process.exit(1);
  }
  const from = Number(flags.get('from') ?? '2015');
  const to = Number(flags.get('to') ?? new Date().getFullYear());
  const delay = Number(flags.get('delay') ?? '600');
  const outDir = resolve(process.cwd(), flags.get('dir') ?? 'papers', subject);
  const names = candidates(subject, papers, from, to);

  console.log(`\n${subject} papers ${papers.join(', ')}, ${from}-${to}: ${names.length} possible files -> ${outDir}`);
  if (flags.has('dry-run')) return;
  await mkdir(outDir, { recursive: true });

  let saved = 0;
  let skipped = 0;
  let bytes = 0;
  const missing: string[] = [];
  const failed: string[] = [];

  for (const name of names) {
    const dest = join(outDir, name);
    if (await exists(dest)) {
      skipped++;
      continue;
    }
    try {
      const res = await fetch(`${BASE}/${name}`, { headers: { 'User-Agent': UA, Accept: 'application/pdf' } });
      const buf = Buffer.from(await res.arrayBuffer());
      // The site answers a missing paper with an HTML page, so check the content itself.
      if (res.ok && buf.subarray(0, 5).toString('latin1') === '%PDF-' && buf.subarray(-1024).includes('%%EOF')) {
        await writeFile(dest, buf);
        saved++;
        bytes += buf.length;
      } else if (res.ok || res.status === 404) {
        missing.push(name);
      } else {
        failed.push(`${name} (HTTP ${res.status})`);
        if (res.status === 403 || res.status === 429) {
          console.error(`\nThe site refused the request (HTTP ${res.status}). Stopping; re-run later to continue.`);
          break;
        }
      }
    } catch (err) {
      failed.push(`${name} (${(err as Error).message})`);
    }
    if ((saved + missing.length + failed.length) % 25 === 0) {
      console.log(`  ...${saved} saved, ${missing.length} not on site, ${failed.length} failed`);
    }
    await new Promise((r) => setTimeout(r, delay));
  }

  console.log(`\nSaved ${saved} (${(bytes / 1024 / 1024).toFixed(1)} MB), already had ${skipped}, not on site ${missing.length}, failed ${failed.length}.`);
  if (missing.length) console.log(`Not on site: ${missing.join(', ')}`);
  if (failed.length) console.log(`Failed: ${failed.join(', ')}`);
}

main().catch((err) => {
  console.error('\nDownloader failed:', err);
  process.exit(1);
});
