#!/usr/bin/env node
/**
 * One-off cleanup: rewrite "shorthand" slash fractions like `1/\cos^2 x` into
 * proper LaTeX `\frac{1}{\cos^2 x}` inside string literals of the hardcoded
 * question pools.
 *
 * The renderer in `src/components/math/MathText.tsx` already does this
 * transform at display time; this script makes the source consistent with
 * what's actually rendered.
 *
 * Patterns mirror `convertSlashFractions` in MathText.tsx. Derivative
 * notation (dy/dx), unit ratios (m/s), and function composition
 * (\sin x/\cos x) are intentionally NOT converted.
 *
 * Usage:  node scripts/fix-slash-fractions.mjs [--dry]
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

const TARGET_FILES = [
  'src/data/questionPools/a2OnlyQuestions.ts',
  'src/data/questionPools/questionGenerator.ts',
]

const dryRun = process.argv.includes('--dry')

/** Mirrors convertSlashFractions() in src/components/math/MathText.tsx. */
function convertSlashFractions(input) {
  let s = input

  // Trailing Unicode superscripts captured as part of the denominator so
  // "1/x²" becomes \frac{1}{x²}, not \frac{1}{x}².
  const SUP = '\u00B2\u00B3\u00B9\u2070\u2074\u2075\u2076\u2077\u2078\u2079'

  // 1. Parenthesized fractions:  (a+b)/(c-d)  ->  \frac{a+b}{c-d}
  //    Skip "(a)/(b)(c)" so we don't drop a multiplicative factor.
  s = s.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)(?!\s*\()/g, '\\frac{$1}{$2}')

  // 2. digit / \trigfunc[^n][ var]   e.g. 1/\cos^2 x  or  1/\sin x
  //    Lookbehind excludes √∛∜ so "√3/x" stays as (√3)/x.
  s = s.replace(
    /(?<![\\A-Za-z\d.\u221A\u221B\u221C])(\d+)\s*\/\s*(\\(?:sin|cos|tan|cot|sec|csc|ln|log)(?:\^(?:\d+|\{[^}]+\}))?(?:\s*[a-zA-Z])?)/g,
    '\\frac{$1}{$2}',
  )

  // 3. digit / \command          e.g. 1/\pi, 2/\sqrt{3}
  s = s.replace(
    /(?<![\\A-Za-z\d.\u221A\u221B\u221C])(\d+)\s*\/\s*(\\[A-Za-z]+(?:\{[^}]+\})?)/g,
    '\\frac{$1}{$2}',
  )

  // 4. digit / letter[^power]    e.g. 1/x, 1/n^2, 1/x^{n+1}, 1/x²
  s = s.replace(
    new RegExp(
      `(?<![\\\\A-Za-z\\d.\\u221A\\u221B\\u221C])(\\d+)\\s*/\\s*([a-zA-Z](?:\\^(?:\\d+|\\{[^}]+\\})|[${SUP}])?)(?![A-Za-z])`,
      'g',
    ),
    '\\frac{$1}{$2}',
  )

  // 5. digit / digit             e.g. 1/2, 3/4   (skips decimals like 2.5/3.1)
  //    Lookbehind excludes √∛∜ so "√3/2" stays as (√3)/2.
  s = s.replace(
    /(?<![\d.\u221A\u221B\u221C])(\d+)\s*\/\s*(\d+)(?![\d.])/g,
    '\\frac{$1}{$2}',
  )

  return s
}

/**
 * Walk TS source and apply `transform` to the bodies of string literals only.
 * Comments and code outside string literals are passed through untouched.
 */
function rewriteStringLiteralsInTS(src, transform) {
  let out = ''
  let i = 0
  const n = src.length

  while (i < n) {
    const ch = src[i]

    // line comment
    if (ch === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i)
      const end = nl === -1 ? n : nl
      out += src.slice(i, end)
      i = end
      continue
    }

    // block comment
    if (ch === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2)
      const stop = close === -1 ? n : close + 2
      out += src.slice(i, stop)
      i = stop
      continue
    }

    // string literal
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch
      let j = i + 1
      let templateBailout = false

      while (j < n && src[j] !== quote) {
        if (src[j] === '\\') {
          j += 2
          continue
        }
        if (quote === '`' && src[j] === '$' && src[j + 1] === '{') {
          // Templates with ${...} interpolation: bail out and copy raw to
          // avoid mangling expressions.
          templateBailout = true
          break
        }
        j += 1
      }

      if (templateBailout) {
        const closeBacktick = src.indexOf('`', i + 1)
        const stop = closeBacktick === -1 ? n : closeBacktick + 1
        out += src.slice(i, stop)
        i = stop
        continue
      }

      if (j >= n) {
        out += src.slice(i)
        i = n
        continue
      }

      const body = src.slice(i + 1, j)
      out += quote + transform(body) + quote
      i = j + 1
      continue
    }

    out += ch
    i += 1
  }

  return out
}

let touchedFiles = 0
let totalReplacements = 0

for (const rel of TARGET_FILES) {
  const abs = join(repoRoot, rel)
  let original
  try {
    original = readFileSync(abs, 'utf8')
  } catch (err) {
    console.warn(`skip: cannot read ${rel}: ${err.message}`)
    continue
  }

  // Count slash patterns inside string literals before/after for reporting.
  const before = original
  const updated = rewriteStringLiteralsInTS(original, convertSlashFractions)

  if (updated === before) {
    console.log(`unchanged: ${rel}`)
    continue
  }

  const beforeFracs = (before.match(/\\frac\b/g) ?? []).length
  const afterFracs = (updated.match(/\\frac\b/g) ?? []).length
  const added = afterFracs - beforeFracs
  totalReplacements += added
  touchedFiles += 1

  if (dryRun) {
    console.log(`would update: ${rel}  (+${added} \\frac)`)
  } else {
    writeFileSync(abs, updated, 'utf8')
    console.log(`updated:     ${rel}  (+${added} \\frac)`)
  }
}

console.log('')
console.log(
  `${dryRun ? 'dry run: ' : ''}${touchedFiles} file(s) ${
    dryRun ? 'would be' : ''
  } touched, +${totalReplacements} new \\frac calls`,
)
if (!dryRun && touchedFiles > 0) {
  console.log(`review with: git diff ${TARGET_FILES.join(' ')}`)
}
