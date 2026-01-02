import katex from 'katex'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Token =
  | { type: 'text'; content: string }
  | { type: 'inlineMath'; content: string }
  | { type: 'blockMath'; content: string }

type Delim = {
  start: string
  end: string
  type: 'inlineMath' | 'blockMath'
  requireUnescaped?: boolean
}

const DELIMS: Delim[] = [
  // Order matters: longer delimiters first to avoid $$ being consumed as $
  { start: '$$', end: '$$', type: 'blockMath', requireUnescaped: true },
  { start: '\\[', end: '\\]', type: 'blockMath' },
  { start: '\\(', end: '\\)', type: 'inlineMath' },
  { start: '$', end: '$', type: 'inlineMath', requireUnescaped: true },
]

function isEscaped(text: string, idx: number): boolean {
  // True if the character at idx is preceded by an odd number of backslashes.
  let slashCount = 0
  for (let i = idx - 1; i >= 0 && text[i] === '\\'; i--) slashCount++
  return slashCount % 2 === 1
}

/**
 * Normalize legacy formatting conventions found in seeded/admin-entered question text.
 *
 * Important: we do NOT convert "\n" or "/n" to real newlines here, because doing so
 * would break valid LaTeX commands inside math mode (e.g. \nu, \nabla). Newline
 * normalization is applied only to plain-text tokens after math tokenization.
 *
 * Repairs:
 * - Windows newlines -> \n
 * - JSON-escape artifacts from unescaped LaTeX in JSON (e.g. "\text" -> tab + "ext")
 *   - \t (tab char) becomes "\\t" so "\text", "\theta", "\times" recover.
 *   - \b (backspace char) becomes "\\b" so "\beta", "\begin" recover.
 *   - \f (form feed char) becomes "\\f" so "\frac" recovers.
 */
function normalizeBeforeMathTokenize(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '\\t')
    .replace(/\u0008/g, '\\b')
    .replace(/\u000c/g, '\\f')
}

/**
 * Plain-text normalization (safe to apply AFTER math has been tokenized out).
 * This keeps KaTeX/LaTeX intact inside math segments while fixing legacy content
 * patterns in the rest of the text.
 */
function normalizePlainText(input: string): string {
  return (
    input
      // Convert literal "\n" (two chars) -> newline
      .replace(/\\n/g, '\n')
      // Convert common typo "/n" -> newline (only when used like a delimiter, not in 1/n)
      .replace(/(^|[\s.,;:!?])\/n(?=$|[\s])/g, '$1\n')
      // If someone typed \text{...} outside math mode, show readable text
      .replace(/\\text\s*\{([^}]*)\}/g, '$1')
      .replace(/\\mathrm\s*\{([^}]*)\}/g, '$1')
  )
}

// ---------------------------------------------------------------------------
// Markdown-lite renderer (bold/italic) for legacy content like **bold** or _italics_
// ---------------------------------------------------------------------------

type MdKind = 'text' | 'bold' | 'italic' | 'bolditalic'
type MdToken = { kind: MdKind; content: string }

const MD_DELIMS = [
  { start: '***', end: '***', kind: 'bolditalic' as const },
  { start: '**', end: '**', kind: 'bold' as const },
  { start: '__', end: '__', kind: 'bold' as const },
  { start: '_', end: '_', kind: 'italic' as const },
  { start: '*', end: '*', kind: 'italic' as const },
] as const

type MdDelim = (typeof MD_DELIMS)[number]

function isWordChar(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z0-9]/.test(ch)
}

function isIntraword(text: string, idx: number, delimLen: number): boolean {
  const prev = idx > 0 ? text[idx - 1] : undefined
  const next = text[idx + delimLen] ?? undefined
  return isWordChar(prev) && isWordChar(next)
}

function findNextMdStart(text: string, from: number): { idx: number; delim: MdDelim } | null {
  let bestIdx = -1
  let bestDelim: MdDelim | null = null

  for (const delim of MD_DELIMS) {
    const startLen = delim.start.length
    let idx = text.indexOf(delim.start, from)

    while (idx !== -1) {
      if (isEscaped(text, idx)) {
        idx = text.indexOf(delim.start, idx + startLen)
        continue
      }

      // Avoid turning subscripts like v_t / H_2 or multiplications like 2*3 into emphasis.
      if (startLen === 1) {
        const nextChar = text[idx + startLen]
        // Prevent matching "a * b" multiplications or list bullets "* item"
        if (nextChar == null || /\s/.test(nextChar)) {
          idx = text.indexOf(delim.start, idx + startLen)
          continue
        }
        if (isIntraword(text, idx, startLen)) {
          idx = text.indexOf(delim.start, idx + startLen)
          continue
        }
      }

      // Avoid turning subscripts like v_t / H_2 into emphasis (also for __ / **, rare but safer).
      if (startLen > 1 && isIntraword(text, idx, startLen)) {
        idx = text.indexOf(delim.start, idx + startLen)
        continue
      }

      // Choose earliest, tie-break by longer delimiter
      if (
        bestIdx === -1 ||
        idx < bestIdx ||
        (idx === bestIdx && bestDelim && startLen > bestDelim.start.length)
      ) {
        bestIdx = idx
        bestDelim = delim
      }
      break
    }
  }

  return bestDelim ? { idx: bestIdx, delim: bestDelim } : null
}

function findMdEnd(text: string, delim: MdDelim, from: number): number {
  const len = delim.end.length
  let idx = text.indexOf(delim.end, from)

  while (idx !== -1) {
    if (isEscaped(text, idx)) {
      idx = text.indexOf(delim.end, idx + len)
      continue
    }
    if (len === 1) {
      const prevChar = idx > 0 ? text[idx - 1] : undefined
      // Prevent matching "a * b" multiplications
      if (prevChar == null || /\s/.test(prevChar)) {
        idx = text.indexOf(delim.end, idx + len)
        continue
      }
      if (isIntraword(text, idx, len)) {
        idx = text.indexOf(delim.end, idx + len)
        continue
      }
    } else if (isIntraword(text, idx, len)) {
      idx = text.indexOf(delim.end, idx + len)
      continue
    }
    return idx
  }

  return -1
}

function tokenizeMarkdownLite(text: string): MdToken[] {
  const tokens: MdToken[] = []
  let i = 0

  while (i < text.length) {
    const next = findNextMdStart(text, i)
    if (!next) {
      tokens.push({ kind: 'text', content: text.slice(i) })
      break
    }

    const { idx, delim } = next
    if (idx > i) tokens.push({ kind: 'text', content: text.slice(i, idx) })

    const afterStart = idx + delim.start.length
    const endIdx = findMdEnd(text, delim, afterStart)

    // No matching end delimiter → treat start as literal.
    if (endIdx === -1) {
      tokens.push({ kind: 'text', content: delim.start })
      i = afterStart
      continue
    }

    tokens.push({ kind: delim.kind, content: text.slice(afterStart, endIdx) })
    i = endIdx + delim.end.length
  }

  return tokens
}

function renderMarkdownLite(text: string): ReactNode {
  const toks = tokenizeMarkdownLite(text)
  return toks.map((t, idx) => {
    if (t.kind === 'text') return <span key={idx}>{t.content}</span>
    if (t.kind === 'bold') return <strong key={idx}>{renderMarkdownLite(t.content)}</strong>
    if (t.kind === 'italic') return <em key={idx}>{renderMarkdownLite(t.content)}</em>
    return (
      <strong key={idx}>
        <em>{renderMarkdownLite(t.content)}</em>
      </strong>
    )
  })
}

function findNextStart(text: string, from: number): { idx: number; delim: Delim } | null {
  let bestIdx = -1
  let bestDelim: Delim | null = null

  for (const delim of DELIMS) {
    const startLen = delim.start.length
    let idx = text.indexOf(delim.start, from)
    while (idx !== -1) {
      // If delimiter requires unescaped start, enforce it (helps for $ / $$ / \$)
      if (delim.requireUnescaped && isEscaped(text, idx)) {
        idx = text.indexOf(delim.start, idx + startLen)
        continue
      }
      // Choose earliest, tie-break by longer delimiter
      if (
        bestIdx === -1 ||
        idx < bestIdx ||
        (idx === bestIdx && bestDelim && delim.start.length > bestDelim.start.length)
      ) {
        bestIdx = idx
        bestDelim = delim
      }
      break
    }
  }

  return bestDelim ? { idx: bestIdx, delim: bestDelim } : null
}

function findEnd(text: string, delim: Delim, from: number): number {
  const endLen = delim.end.length
  let idx = text.indexOf(delim.end, from)
  while (idx !== -1) {
    if (delim.requireUnescaped && isEscaped(text, idx)) {
      idx = text.indexOf(delim.end, idx + endLen)
      continue
    }
    return idx
  }
  return -1
}

function tokenizeMath(text: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < text.length) {
    const next = findNextStart(text, i)
    if (!next) {
      tokens.push({ type: 'text', content: text.slice(i) })
      break
    }

    const { idx, delim } = next
    if (idx > i) {
      tokens.push({ type: 'text', content: text.slice(i, idx) })
    }

    const afterStart = idx + delim.start.length
    const endIdx = findEnd(text, delim, afterStart)

    // No matching end delimiter → treat start as literal and continue scanning.
    if (endIdx === -1) {
      tokens.push({ type: 'text', content: delim.start })
      i = afterStart
      continue
    }

    const mathContent = text.slice(afterStart, endIdx)
    tokens.push({ type: delim.type, content: mathContent })
    i = endIdx + delim.end.length
  }

  return tokens
}

function renderKatex(math: string, displayMode: boolean): string {
  try {
    return katex.renderToString(math, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
    })
  } catch {
    // Even with throwOnError=false, katex can still throw on extreme edge cases.
    return math
  }
}

export function MathText({
  text,
  className,
}: {
  text: string | null | undefined
  className?: string
}) {
  if (text == null || text === '') return null

  // Normalize only what's safe for math BEFORE tokenizing math, so delimiters and LaTeX commands recover.
  const normalized = normalizeBeforeMathTokenize(text)
  const tokens = tokenizeMath(normalized)

  return (
    <span className={cn('whitespace-pre-wrap', className)}>
      {tokens.map((t, idx) => {
        if (t.type === 'text') {
          // Render markdown-lite formatting for legacy question content.
          const cleanText = normalizePlainText(t.content)
          return <span key={idx}>{renderMarkdownLite(cleanText)}</span>
        }

        const html = renderKatex(t.content, t.type === 'blockMath')
        return (
          <span
            key={idx}
            // KaTeX returns safe HTML; source strings are user-authored question text.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
      })}
    </span>
  )
}


