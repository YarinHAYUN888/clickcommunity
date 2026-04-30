import { motion } from 'framer-motion';

interface OnboardingProgressProps {
  progress: number; // 0-100
}

export default function OnboardingProgress({ progress }: OnboardingProgressProps) {
  return (
    <div className="w-full h-[3px] bg-primary-ultra-light relative">
      <motion.div
        className="h-full rounded-full"
        style={{ background: 'hsl(var(--color-primary))' }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
        style={{
          background: 'hsl(var(--color-primary))',
          boxShadow: '0 0 8px rgba(124, 58, 237, 0.5)',
        }}
        animate={{ left: `${progress}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  );
}
