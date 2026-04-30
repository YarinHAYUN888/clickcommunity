import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface GlassSurfaceProps {
  children: ReactNode;
  className?: string;
  position?: 'top' | 'bottom';
}

export default function GlassSurface({ children, className, position = 'bottom' }: GlassSurfaceProps) {
  return (
    <div
      className={cn(
        'glass',
        position === 'top' && 'border-t-0 border-x-0 border-b',
        position === 'bottom' && 'border-b-0 border-x-0 border-t',
        className
      )}
      style={{ boxShadow: 'none' }}
    >
      {children}
    </div>
  );
}
