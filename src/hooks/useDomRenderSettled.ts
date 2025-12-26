import { useEffect, useState } from 'react'

type UseDomRenderSettledOptions = {
  /**
   * How long the DOM must be mutation-quiet before we consider it "settled".
   * KaTeX/font swaps can cause multiple quick mutations.
   */
  quietWindowMs?: number
  /**
   * Whether to await font readiness when available (helps with KaTeX rendering stability).
   */
  waitForFonts?: boolean
}

/**
 * Returns true once a DOM subtree has "settled" (no mutations for quietWindowMs),
 * plus a couple of RAF ticks. Designed to gate opening animations until KaTeX-heavy
 * content is actually visible and stable.
 */
export function useDomRenderSettled(
  node: Element | null,
  key: string,
  options?: UseDomRenderSettledOptions
): boolean {
  const quietWindowMs = options?.quietWindowMs ?? 160
  const waitForFonts = options?.waitForFonts ?? true

  const [settled, setSettled] = useState<boolean>(false)

  useEffect(() => {
    setSettled(false)
  }, [key])

  useEffect(() => {
    if (!node) return

    let cancelled = false
    let timerId: number | null = null

    const clearTimer = () => {
      if (timerId != null) {
        window.clearTimeout(timerId)
        timerId = null
      }
    }

    const waitRaf = () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })

    const markSettled = async () => {
      if (cancelled) return

      if (waitForFonts) {
        try {
          const fonts = (document as any).fonts
          if (fonts?.ready && typeof fonts.ready.then === 'function') {
            await fonts.ready
          }
        } catch {
          // ignore
        }
      }

      // Let layout/paint catch up for at least two frames.
      await waitRaf()
      await waitRaf()

      if (cancelled) return
      setSettled(true)
    }

    const schedule = () => {
      clearTimer()
      timerId = window.setTimeout(() => {
        markSettled().catch(() => {})
      }, quietWindowMs)
    }

    // Start immediately in case the subtree is already stable.
    schedule()

    const observer = new MutationObserver(() => {
      if (cancelled) return
      schedule()
    })

    observer.observe(node, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    })

    return () => {
      cancelled = true
      clearTimer()
      observer.disconnect()
    }
  }, [node, key, quietWindowMs, waitForFonts])

  return settled
}




