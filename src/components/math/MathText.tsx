import React, { useMemo } from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import type { KatexOptions } from 'katex';

export type MathTextMode = 'inline' | 'block' | 'auto';

type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'inline'; math: string; raw: string }
  | { kind: 'block'; math: string; raw: string };

const INLINE_OPEN = '\\(';
const INLINE_CLOSE = '\\)';
const BLOCK_OPEN = '\\[';
const BLOCK_CLOSE = '\\]';

const KATEX_OPTIONS: KatexOptions = {
  // We want to detect bad LaTeX and fall back to raw text
  throwOnError: true,
  // Avoid hard failures for unknown commands; warn in console
  strict: 'warn',
  // Security: do NOT trust HTML-like macros (prevents arbitrary HTML injection)
  trust: false,
  // Prevent runaway macro expansion
  maxExpand: 1000,
};

function stripOuterDelimiters(input: string): { math: string; raw: string } {
  const raw = input;
  const trimmed = input.trim();

  if (trimmed.startsWith(INLINE_OPEN) && trimmed.endsWith(INLINE_CLOSE)) {
    return {
      raw,
      math: trimmed.slice(INLINE_OPEN.length, trimmed.length - INLINE_CLOSE.length),
    };
  }

  if (trimmed.startsWith(BLOCK_OPEN) && trimmed.endsWith(BLOCK_CLOSE)) {
    return {
      raw,
      math: trimmed.slice(BLOCK_OPEN.length, trimmed.length - BLOCK_CLOSE.length),
    };
  }

  return { raw, math: input };
}

function findNextDelimiter(text: string, fromIndex: number): { kind: 'inline' | 'block'; start: number } | null {
  const iInline = text.indexOf(INLINE_OPEN, fromIndex);
  const iBlock = text.indexOf(BLOCK_OPEN, fromIndex);

  if (iInline === -1 && iBlock === -1) return null;
  if (iInline === -1) return { kind: 'block', start: iBlock };
  if (iBlock === -1) return { kind: 'inline', start: iInline };
  return iInline < iBlock ? { kind: 'inline', start: iInline } : { kind: 'block', start: iBlock };
}

function parseMixedMath(text: string): Segment[] {
  const out: Segment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const next = findNextDelimiter(text, cursor);
    if (!next) {
      const tail = text.slice(cursor);
      if (tail) out.push({ kind: 'text', text: tail });
      break;
    }

    if (next.start > cursor) {
      const before = text.slice(cursor, next.start);
      if (before) out.push({ kind: 'text', text: before });
    }

    const closeDelim = next.kind === 'inline' ? INLINE_CLOSE : BLOCK_CLOSE;
    const openLen = 2; // both \\( and \\[ are length 2
    const closeIdx = text.indexOf(closeDelim, next.start + openLen);

    // Malformed/unclosed delimiter: treat the rest as plain text
    if (closeIdx === -1) {
      const rest = text.slice(next.start);
      if (rest) out.push({ kind: 'text', text: rest });
      break;
    }

    const raw = text.slice(next.start, closeIdx + closeDelim.length);
    const math = text.slice(next.start + openLen, closeIdx);

    if (!math.trim()) {
      // Empty math segment: render as plain text
      out.push({ kind: 'text', text: raw });
    } else {
      out.push({ kind: next.kind, math, raw } as Segment);
    }

    cursor = closeIdx + closeDelim.length;
  }

  return out;
}

export function MathText({
  text,
  mode = 'auto',
  className,
}: {
  text: string | null | undefined;
  mode?: MathTextMode;
  className?: string;
}) {
  const safeText = text ?? '';

  const renderError = (raw: string, err: unknown) => {
    // eslint-disable-next-line no-console
    console.warn('[MathText] KaTeX render failed; falling back to raw text:', { raw, err });
    return <span className={className}>{raw}</span>;
  };

  if (mode === 'inline') {
    const { math, raw } = stripOuterDelimiters(safeText);
    return (
      <span className={className}>
        <InlineMath
          math={math}
          {...KATEX_OPTIONS}
          renderError={(err) => renderError(raw, err)}
        />
      </span>
    );
  }

  if (mode === 'block') {
    const { math, raw } = stripOuterDelimiters(safeText);
    return (
      <span className={className}>
        <BlockMath
          math={math}
          {...KATEX_OPTIONS}
          renderError={(err) => renderError(raw, err)}
        />
      </span>
    );
  }

  const segments = useMemo(() => parseMixedMath(safeText), [safeText]);

  return (
    <span className={className}>
      {segments.map((seg, idx) => {
        if (seg.kind === 'text') {
          return <React.Fragment key={`t-${idx}`}>{seg.text}</React.Fragment>;
        }

        if (seg.kind === 'inline') {
          return (
            <InlineMath
              key={`i-${idx}`}
              math={seg.math}
              {...KATEX_OPTIONS}
              renderError={(err) => renderError(seg.raw, err)}
            />
          );
        }

        // seg.kind === 'block'
        return (
          <span key={`b-${idx}`} className="block my-2">
            <BlockMath
              math={seg.math}
              {...KATEX_OPTIONS}
              renderError={(err) => renderError(seg.raw, err)}
            />
          </span>
        );
      })}
    </span>
  );
}


