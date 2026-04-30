import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedBackgroundProps {
  children: ReactNode;
  className?: string;
}

export default function AnimatedBackground({ children, className }: AnimatedBackgroundProps) {
  return (
    <div className={cn('relative min-h-screen overflow-hidden gradient-bg', className)}>
      {/* Blob 1 */}
      <div
        className="pointer-events-none absolute top-10 -end-20 w-[300px] h-[300px] rounded-full animate-blob-1"
        style={{ background: 'rgba(124, 58, 237, 0.06)', filter: 'blur(80px)' }}
      />
      {/* Blob 2 */}
      <div
        className="pointer-events-none absolute top-1/2 -start-16 w-[250px] h-[250px] rounded-full animate-blob-2"
        style={{ background: 'rgba(167, 139, 250, 0.08)', filter: 'blur(80px)' }}
      />
      {/* Blob 3 */}
      <div
        className="pointer-events-none absolute bottom-20 start-1/3 w-[350px] h-[350px] rounded-full animate-blob-3"
        style={{ background: 'rgba(91, 33, 182, 0.05)', filter: 'blur(80px)' }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
