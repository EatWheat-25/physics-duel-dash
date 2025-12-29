import katex from 'katex'
import { cn } from '@/lib/utils'

type Token =
  | { type: 'text'; content: string }
  | { type: 'inlineMath'; content: string }
  | { type: 'blockMath'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'italic'; content: string }
  | { type: 'newline' }

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

function processMarkdown(text: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let textStart = i

  while (i < text.length) {
    // Check for newlines first (support both \n and :/n)
    if (text[i] === '\n' || (i < text.length - 2 && text.slice(i, i + 3) === ':/n')) {
      // Flush any accumulated text
      if (i > textStart) {
        tokens.push({ type: 'text', content: text.slice(textStart, i) })
      }
      tokens.push({ type: 'newline' })
      i += text[i] === '\n' ? 1 : 3
      textStart = i
      continue
    }

    // Check for bold **text**
    if (i < text.length - 1 && text[i] === '*' && text[i + 1] === '*' && !isEscaped(text, i)) {
      const endIdx = text.indexOf('**', i + 2)
      if (endIdx !== -1 && !isEscaped(text, endIdx)) {
        // Flush any accumulated text
        if (i > textStart) {
          tokens.push({ type: 'text', content: text.slice(textStart, i) })
        }
        tokens.push({ type: 'bold', content: text.slice(i + 2, endIdx) })
        i = endIdx + 2
        textStart = i
        continue
      }
    }

    // Check for italic *text* (but not **text**)
    if (text[i] === '*' && !isEscaped(text, i)) {
      // Make sure it's not part of **
      if (i === text.length - 1 || text[i + 1] !== '*') {
        const endIdx = text.indexOf('*', i + 1)
        if (endIdx !== -1 && (endIdx === text.length - 1 || text[endIdx + 1] !== '*') && !isEscaped(text, endIdx)) {
          // Flush any accumulated text
          if (i > textStart) {
            tokens.push({ type: 'text', content: text.slice(textStart, i) })
          }
          tokens.push({ type: 'italic', content: text.slice(i + 1, endIdx) })
          i = endIdx + 1
          textStart = i
          continue
        }
      }
    }

    i++
  }

  // Flush any remaining text
  if (i > textStart) {
    tokens.push({ type: 'text', content: text.slice(textStart, i) })
  }

  return tokens
}

function tokenizeMath(text: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < text.length) {
    const next = findNextStart(text, i)
    if (!next) {
      // Process remaining text for markdown
      const remaining = text.slice(i)
      if (remaining) {
        tokens.push(...processMarkdown(remaining))
      }
      break
    }

    const { idx, delim } = next
    if (idx > i) {
      // Process text before math for markdown
      const beforeMath = text.slice(i, idx)
      tokens.push(...processMarkdown(beforeMath))
    }

    const afterStart = idx + delim.start.length
    const endIdx = findEnd(text, delim, afterStart)

    // No matching end delimiter → treat start as literal and continue scanning.
    if (endIdx === -1) {
      tokens.push(...processMarkdown(delim.start))
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
        
        if (t.type === 'bold') {
          return <strong key={idx}>{t.content}</strong>
        }
        
        if (t.type === 'italic') {
          return <em key={idx}>{t.content}</em>
        }
        
        if (t.type === 'newline') {
          return <br key={idx} />
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



