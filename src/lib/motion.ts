import type { Transition, Variants } from 'framer-motion';

/** Signature ease for the premium lobby feel (fast start, long soft settle). */
export const PREMIUM_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Soft spring used for hover/press micro-interactions. */
export const SOFT_SPRING: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 30,
  mass: 0.9,
};

/** Slightly snappier spring for the hero (player card) entrance. */
export const HERO_SPRING: Transition = {
  type: 'spring',
  stiffness: 180,
  damping: 24,
  mass: 1,
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: PREMIUM_EASE },
  },
};

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: PREMIUM_EASE },
  },
};

export const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -22 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.55, ease: PREMIUM_EASE },
  },
};

export const fadeRight: Variants = {
  hidden: { opacity: 0, x: 22 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.55, ease: PREMIUM_EASE },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: HERO_SPRING,
  },
};

/** Parent container that staggers its variant children. */
export function staggerContainer(stagger = 0.06, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren },
    },
  };
}

/** Consistent spring-based hover lift + tap press for tiles/buttons. */
export const hoverLift = { y: -3, transition: SOFT_SPRING };
export const tapPress = { scale: 0.985, transition: SOFT_SPRING };

/** Crossfade with blur for step transitions (premium "focus pull" feel). */
export const blurCrossfade = {
  initial: { opacity: 0, scale: 0.98, filter: 'blur(8px)' },
  animate: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.45, ease: PREMIUM_EASE },
  },
  exit: {
    opacity: 0,
    scale: 1.01,
    filter: 'blur(8px)',
    transition: { duration: 0.28, ease: PREMIUM_EASE },
  },
} as const;
