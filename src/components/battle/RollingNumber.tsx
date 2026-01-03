import { motion, useReducedMotion } from 'framer-motion'

function DigitColumn({
  digit,
  duration,
  delay,
  cycles,
  className,
}: {
  digit: number
  duration: number
  delay: number
  cycles: number
  className?: string
}) {
  const prefersReducedMotion = useReducedMotion()

  const safeDigit = Number.isFinite(digit) ? Math.max(0, Math.min(9, Math.floor(digit))) : 0
  const totalRows = (cycles + 1) * 10
  const finalIndex = cycles * 10 + safeDigit
  const finalY = `-${finalIndex}em`

  return (
    <span
      className={`inline-block overflow-hidden align-baseline tabular-nums ${className ?? ''}`}
      style={{ height: '1em', lineHeight: '1em' }}
      aria-hidden="true"
    >
      <motion.span
        className="block"
        initial={prefersReducedMotion ? { y: finalY } : { y: '0em' }}
        animate={{ y: finalY }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : {
                duration,
                delay,
                ease: [0.22, 1, 0.36, 1],
              }
        }
      >
        {Array.from({ length: totalRows }).map((_, i) => (
          <span key={i} className="block" style={{ height: '1em', lineHeight: '1em' }}>
            {i % 10}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

export function RollingNumber({
  value,
  className,
  digitClassName,
  duration = 1.05,
  delay = 0,
  cycles = 2,
  stagger = 0.06,
}: {
  value: number
  className?: string
  digitClassName?: string
  duration?: number
  delay?: number
  cycles?: number
  stagger?: number
}) {
  const prefersReducedMotion = useReducedMotion()
  const v = Number.isFinite(value) ? value : 0
  const abs = Math.abs(Math.trunc(v))
  const str = String(abs)

  return (
    <span className={`inline-flex items-baseline ${className ?? ''}`}>
      {v < 0 && <span className={digitClassName}>-</span>}
      {prefersReducedMotion ? (
        <span className={digitClassName}>{str}</span>
      ) : (
        str.split('').map((ch, i) => (
          <DigitColumn
            key={`${i}-${ch}`}
            digit={Number(ch)}
            duration={duration}
            delay={delay + i * stagger}
            cycles={cycles}
            className={digitClassName}
          />
        ))
      )}
    </span>
  )
}


