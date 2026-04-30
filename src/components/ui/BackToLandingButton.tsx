import { motion } from 'framer-motion';
import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BackToLandingButtonProps {
  /** Optional override for click destination. Defaults to '/'. */
  to?: string;
  /** Optional className override. */
  className?: string;
}

/**
 * Small floating button positioned at the top-LEFT of the screen
 * that navigates back to the landing page (`/`).
 *
 * Visually fixed to the left edge regardless of RTL/LTR direction
 * (uses `left-3` literally, not `start-3`).
 */
export default function BackToLandingButton({ to = '/', className = '' }: BackToLandingButtonProps) {
  const navigate = useNavigate();

  return (
    <motion.button
      type="button"
      onClick={() => navigate(to)}
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.05 }}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      aria-label="חזרה לדף הבית"
      title="חזרה לדף הבית"
      className={
        'fixed left-3 z-50 inline-flex items-center justify-center w-10 h-10 rounded-full ' +
        'bg-white/70 backdrop-blur-md border border-primary/20 text-primary ' +
        'shadow-[0_2px_10px_rgba(124,58,237,0.10)] ' +
        'transition-all duration-200 ' +
        'hover:bg-white/95 hover:border-primary/40 hover:shadow-[0_6px_18px_rgba(124,58,237,0.22)] ' +
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ' +
        (className || '')
      }
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      <Home size={18} strokeWidth={2.2} />
    </motion.button>
  );
}
