import { motion, AnimatePresence } from 'framer-motion';
import { springs } from '@/lib/motion';

interface FlipNumberProps {
  value: number | string;
  className?: string;
}

/**
 * Animated flip-style number — each digit transitions when value changes.
 */
export default function FlipNumber({ value, className }: FlipNumberProps) {
  const str = String(value);
  return (
    <span className={className} style={{ display: 'inline-flex' }}>
      {str.split('').map((ch, i) => (
        <span key={i} style={{ display: 'inline-block', position: 'relative', overflow: 'hidden', height: '1em', minWidth: '0.5em', textAlign: 'center' }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={ch + '-' + i}
              initial={{ y: '-100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={springs.snappy}
              style={{ display: 'inline-block' }}
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}