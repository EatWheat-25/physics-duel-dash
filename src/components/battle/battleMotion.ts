import type { Transition, Variants } from 'framer-motion'

export function battleTransition(reduceMotion: boolean, base?: Transition): Transition {
  if (reduceMotion) return { duration: 0 }
  return {
    duration: 0.22,
    ease: 'easeOut',
    ...base,
  }
}

export function panelEnterVariants(reduceMotion: boolean): Variants {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    }
  }

  return {
    initial: { opacity: 0, y: 14, scale: 0.992 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -14, scale: 0.992, filter: 'blur(10px)' },
  }
}

export function stampPopVariants(reduceMotion: boolean): Variants {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    }
  }

  return {
    initial: { opacity: 0, scale: 0.92, rotate: -6 },
    animate: { opacity: 1, scale: 1, rotate: -2 },
    exit: { opacity: 0, scale: 0.98, rotate: -10, filter: 'blur(10px)' },
  }
}

export function sideEnterVariants(reduceMotion: boolean, side: 'left' | 'right'): Variants {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    }
  }

  const x = side === 'left' ? -18 : 18
  return {
    initial: { opacity: 0, x, scale: 0.992 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -x, scale: 0.992, filter: 'blur(10px)' },
  }
}

export function buttonPressMotion(reduceMotion: boolean) {
  if (reduceMotion) return { whileHover: undefined, whileTap: undefined }
  return {
    whileHover: { y: -2 },
    whileTap: { y: 0, scale: 0.985 },
  }
}


