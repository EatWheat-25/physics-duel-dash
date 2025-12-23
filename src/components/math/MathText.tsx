import katex from 'katex'
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

  const tokens = tokenizeMath(text)

  return (
    <span className={cn('whitespace-pre-wrap', className)}>
      {tokens.map((t, idx) => {
        if (t.type === 'text') {
          return <span key={idx}>{t.content}</span>
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


