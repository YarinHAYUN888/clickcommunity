import { cn } from '@/lib/utils';

interface LumaSpinProps {
  size?: number;
  className?: string;
}

export function LumaSpin({ size = 65, className }: LumaSpinProps) {
  return (
    <div
      className={cn('relative aspect-square', className)}
      style={{ width: size, height: size }}
    >
      <span
        className="absolute rounded-[50px] animate-luma-spin"
        style={{
          boxShadow: 'inset 0 0 0 3px hsl(var(--primary))',
          filter: 'drop-shadow(0 0 6px hsl(var(--primary) / 0.6))',
        }}
      />
      <span
        className="absolute rounded-[50px] animate-luma-spin-delay"
        style={{
          boxShadow: 'inset 0 0 0 3px hsl(var(--color-primary-light))',
          filter: 'drop-shadow(0 0 6px hsl(var(--color-primary-light) / 0.5))',
        }}
      />
    </div>
  );
}

interface SpinnerOverlayProps {
  label?: string;
}

export function SpinnerOverlay({ label }: SpinnerOverlayProps) {
  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg">
      <div
        className="flex flex-col items-center gap-6 px-10 py-8 rounded-2xl"
        style={{
          background: 'hsl(var(--primary) / 0.08)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid hsl(var(--primary) / 0.2)',
          boxShadow: '0 8px 32px hsl(var(--primary) / 0.15)',
        }}
      >
        <LumaSpin size={65} />
        {label && (
          <p className="text-sm font-medium" style={{ color: 'hsl(var(--primary))' }}>
            {label}
          </p>
        )}
      </div>
    </div>
  );
}
