import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

type StatusType = 'new' | 'veteran' | 'ambassador';
type EventStatusType = 'open' | 'almost_full' | 'full' | 'past' | 'cancelled';

interface StatusBadgeProps {
  status: StatusType | EventStatusType;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  new: { label: '🌱 חדש', className: 'bg-success/10 text-success' },
  veteran: { label: '⭐ ותיק', className: 'bg-warning/10 text-warning' },
  ambassador: { label: '👑 שגריר', className: 'bg-primary/10 text-primary' },
  open: { label: 'הרשמה פתוחה', className: 'bg-success/10 text-success' },
  almost_full: { label: 'כמעט מלא', className: 'bg-warning/10 text-warning' },
  full: { label: 'מלא — רשימת המתנה', className: 'bg-destructive/10 text-destructive' },
  past: { label: 'הסתיים', className: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'בוטל', className: 'bg-destructive/10 text-destructive' },
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  if (!config) return null;
  const isAmbassador = status === 'ambassador';
  const isAlmostFull = status === 'almost_full';
  return (
    <motion.span
      className={cn('relative inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-medium', config.className, className)}
      animate={isAlmostFull ? { rotate: [-1, 1, -1], opacity: [0.85, 1, 0.85] } : undefined}
      transition={isAlmostFull ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
    >
      {config.label}
      {isAmbassador && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute pointer-events-none"
              style={{
                top: '-2px',
                left: `${20 + i * 25}%`,
                width: 3,
                height: 3,
                borderRadius: '999px',
                background: 'radial-gradient(circle, #FCD34D 0%, transparent 70%)',
                filter: 'blur(0.5px)',
              }}
              animate={{ y: [-2, -10, -2], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2.4 + i * 0.3, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
            />
          ))}
        </>
      )}
    </motion.span>
  );
}
