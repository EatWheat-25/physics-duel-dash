import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { MathText } from '@/components/math/MathText'
import { SmilesDiagram } from '@/components/chem/SmilesDiagram'

type Token =
  | { type: 'text'; content: string }
  | { type: 'smiles'; content: string }
  | { type: 'img'; content: string }

const TOKEN_RE = /\[\[(smiles|img):([\s\S]*?)\]\]/g

function tokenizeScience(text: string): Token[] {
  const out: Token[] = []
  let lastIdx = 0

  for (let m = TOKEN_RE.exec(text); m; m = TOKEN_RE.exec(text)) {
    const full = m[0]
    const kind = m[1]
    const payload = m[2]
    const start = m.index

    if (start > lastIdx) {
      out.push({ type: 'text', content: text.slice(lastIdx, start) })
    }

    const content = String(payload ?? '').trim()
    if (kind === 'smiles') out.push({ type: 'smiles', content })
    else if (kind === 'img') out.push({ type: 'img', content })
    else out.push({ type: 'text', content: full })

    lastIdx = start + full.length
  }

  if (lastIdx < text.length) {
    out.push({ type: 'text', content: text.slice(lastIdx) })
  }

  return out
}

export function ScienceText({
  text,
  className,
  smilesSize = 'md',
  imageClassName,
}: {
  text: string | null | undefined
  className?: string
  smilesSize?: 'sm' | 'md' | 'lg'
  imageClassName?: string
}) {
  const raw = String(text ?? '')
  const tokens = useMemo(() => tokenizeScience(raw), [raw])

  if (!raw.trim()) return null

  return (
    <span className={cn('whitespace-pre-wrap', className)}>
      {tokens.map((t, idx) => {
        if (t.type === 'text') {
          return <MathText key={idx} text={t.content} />
        }

        if (t.type === 'img') {
          // Render as an inline-block so this can be used inside buttons/options too.
          return (
            <span key={idx} className="inline-block w-full my-3">
              <img
                src={t.content}
                alt=""
                loading="lazy"
                className={cn(
                  'block max-w-full rounded-xl border border-white/10',
                  imageClassName
                )}
              />
            </span>
          )
        }

        // SMILES
        return (
          <span key={idx} className="inline-block w-full my-3">
            <SmilesDiagram smiles={t.content} size={smilesSize} />
          </span>
        )
      })}
    </span>
  )
}


