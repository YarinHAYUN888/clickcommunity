import type { Transition } from 'framer-motion';

/**
 * Spring presets for premium motion design.
 * - gentle: smooth, slow transitions (page-level, layout)
 * - snappy: fast, responsive (taps, scale, indicators)
 * - wobble: playful, alive (entrances, celebrations)
 */
export const springs = {
  gentle: { type: 'spring', damping: 20, stiffness: 100 } as Transition,
  snappy: { type: 'spring', damping: 25, stiffness: 400 } as Transition,
  wobble: { type: 'spring', damping: 12, stiffness: 200 } as Transition,
};