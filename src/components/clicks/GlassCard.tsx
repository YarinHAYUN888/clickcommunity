import { cn } from '@/lib/utils';
import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { springs } from '@/lib/motion';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: 'default' | 'strong' | 'solid';
  padding?: string;
}

export default function GlassCard({ children, className, onClick, variant = 'default', padding }: GlassCardProps) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={onClick ? { y: -4, scale: 1.005 } : undefined}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      transition={springs.snappy}
      className={cn(
        'rounded-2xl shine-sweep',
        variant === 'default' && 'glass-premium',
        variant === 'strong' && 'glass-premium',
        variant === 'solid' && 'bg-card',
        onClick && 'cursor-pointer is-interactive',
        className
      )}
      style={{ padding: padding || undefined }}
    >
      {children}
    </motion.div>
  );
}
