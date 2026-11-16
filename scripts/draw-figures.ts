/**
 * Figure redraw pilot: the AI step.
 *
 * For each figure chosen by `python scripts/figures_pilot.py select`, sends
 * the original PDF page image plus the figure's description to Claude and
 * asks for a matplotlib script that redraws it. The script is saved next to
 * the page image; `figures_pilot.py render` then runs it.
 *
 * The output is the same kind of script the admin Diagram Studio accepts
 * (matplotlib, saving an SVG), so approved ones can go into the diagram library.
 *
 * Usage:
 *   npx tsx scripts/draw-figures.ts [--model=claude-haiku-5-5] [--redo]
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { readFile, writeFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

interface Item {
  id: string;
  label: string;
  type: string;
  description: string;
  context: string;
  part_text: string;
}

const Drawing = z.object({
  script: z.string().describe('Complete, self-contained Python script.'),
  notes: z.string().describe('One or two sentences on anything simplified, approximated or left out. Empty string if nothing.'),
});

const SYSTEM = `You redraw figures from physics exam papers as clean vector drawings, by writing matplotlib code.

You are given an image of a paper page, the label of one figure on it, and a written description of that figure. Write a Python script that redraws that one figure.

Requirements:
- Import only matplotlib, numpy and math. No file reading, no network, no other libraries.
- Save exactly one file: fig.savefig("figure.svg", bbox_inches="tight"). Do not call plt.show().
- Match the original's content: same axes, scales, tick values, labels, units, plotted shape, components, dimensions and annotations. Read values from the image carefully.
- Plain exam style: black lines on a white background, no title, no colour unless the original uses it. Use a serif font and mathtext for symbols and units, e.g. r"$v$ / m s$^{-1}$".
- For graphs: draw the grid if the original has one, with matching major gridlines. If the original shows empty axes for the candidate to sketch on, draw the empty axes.
- For diagrams: use lines, patches and text. Turn the axes off, keep the aspect ratio equal, and keep labels clear of lines.
- Draw only the figure. Leave out the caption, the question text, answer lines, page furniture and any watermark.
- Keep the figure compact, about 5 inches wide.`;

async function main(): Promise<void> {
  const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, ...v] = a.slice(2).split('=');
    return [k, v.join('=') || 'true'] as const;
  }));
  const model = flags.get('model') ?? 'claude-haiku-5-5';
  const dir = resolve(process.cwd(), 'papers', '_figures');
  const items = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as Item[];

  const client = new Anthropic({ maxRetries: 6 });
  let input = 0;
  let output = 0;
  let done = 0;
  let cursor = 0;

  const worker = async () => {
    for (let item = items[cursor++]; item; item = items[cursor++]) {
      const fdir = join(dir, item.id);
      if (!flags.has('redo')) {
        try {
          await access(join(fdir, 'script.py'));
          continue;
        } catch {
          /* not done yet */
        }
      }
      try {
        const page = (await readFile(join(fdir, 'page.png'))).toString('base64');
        const response = await client.beta.messages.parse({
          model,
          max_tokens: 16000,
          // Server-side refusal fallback is not offered on Haiku models.
          ...(model.includes('haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
          system: SYSTEM,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: 'image/png', data: page } },
                {
                  type: 'text',
                  text: `Redraw ${item.label} (a ${item.type}).\n\nDescription: ${item.description}\n\nQuestion context: ${item.context || '(none)'}\n${item.part_text ? `Part that uses it: ${item.part_text}` : ''}`,
                },
              ],
            },
          ],
          output_config: { effort: 'medium', format: betaZodOutputFormat(Drawing) },
        });
        input += response.usage.input_tokens;
        output += response.usage.output_tokens;
        if (!response.parsed_output) {
          console.warn(`  ! ${item.id}: no usable output (stop_reason=${response.stop_reason})`);
          continue;
        }
        await writeFile(join(fdir, 'script.py'), response.parsed_output.script);
        await writeFile(join(fdir, 'notes.txt'), response.parsed_output.notes);
        done++;
        console.log(`  ${item.id}`);
      } catch (err) {
        if (err instanceof Anthropic.APIError) console.warn(`  ! ${item.id}: API error ${err.status}: ${err.message}`);
        else console.warn(`  ! ${item.id}: ${(err as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log(`\nWrote ${done} script(s) with ${model}. Tokens used: ${input} in, ${output} out.`);
}

main().catch((err) => {
  console.error('\nFailed:', err);
  process.exit(1);
});
