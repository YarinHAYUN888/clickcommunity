import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface GlassOverlayProps {
  children: ReactNode;
  className?: string;
}

export default function GlassOverlay({ children, className }: GlassOverlayProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex items-center justify-center rounded-[inherit] z-10',
        className
      )}
      style={{
        background: 'hsl(var(--glass-purple-bg))',
        backdropFilter: `blur(var(--glass-blur-heavy))`,
        WebkitBackdropFilter: `blur(var(--glass-blur-heavy))`,
      }}
    >
      {children}
    </div>
  );
}
