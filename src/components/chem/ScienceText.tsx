import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { MathText } from '@/components/math/MathText'
import { SmilesDiagram } from '@/components/chem/SmilesDiagram'
import { Molecule } from '@/components/chem/Molecule'
import { parseMolTag } from '@/lib/chem/draw'

type Token =
  | { type: 'text'; content: string }
  | { type: 'smiles'; content: string }
  | { type: 'img'; content: string }
  | { type: 'mol'; content: string }

// The (?!\]) lets a payload end in "]" (e.g. a SMILES bracket atom) without being cut short.
const TOKEN_RE = /\[\[(smiles|img|mol):([\s\S]*?)\]\](?!\])/g

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
    else if (kind === 'mol') out.push({ type: 'mol', content })
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
    <span className={cn('whitespace-pre-line', className)}>
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

        if (t.type === 'mol') {
          const tag = parseMolTag(t.content)
          // Inline-flex, not full width, so several labelled structures can sit side by side.
          return (
            <Molecule
              key={idx}
              input={tag.input}
              style={tag.style}
              kind={tag.kind}
              label={tag.label}
              rotate={tag.rotate}
              flip={tag.flip}
              size={smilesSize}
              className="m-1.5"
            />
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


