import { ReactNode, useRef, useState, MouseEvent, CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';

interface Ripple { id: number; x: number; y: number; }

interface PremiumButtonProps {
  children: ReactNode;
  tier?: 'primary' | 'secondary' | 'tertiary';
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  ariaLabel?: string;
  style?: CSSProperties;
}

/**
 * 3-tier premium button system.
 * - primary: gradient + shine sweep + ripple + magnetic (desktop)
 * - secondary: glass tint + gradient border
 * - tertiary: text + animated underline on hover
 */
export default function PremiumButton({
  children,
  tier = 'primary',
  onClick,
  className,
  type = 'button',
  disabled,
  ariaLabel,
  style,
}: PremiumButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const handleMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (reduce || tier !== 'primary') return;
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    setPos({ x: dx * 0.12, y: dy * 0.18 });
  };
  const reset = () => setPos({ x: 0, y: 0 });

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!reduce && tier === 'primary') {
      const el = ref.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const id = Date.now();
        setRipples((rs) => [...rs, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
        setTimeout(() => setRipples((rs) => rs.filter((rr) => rr.id !== id)), 700);
      }
    }
    onClick?.(e);
  };

  if (tier === 'tertiary') {
    return (
      <button
        ref={ref}
        type={type}
        onClick={handleClick}
        disabled={disabled}
        aria-label={ariaLabel}
        style={style}
        className={cn(
          'relative inline-flex items-center justify-center px-2 py-1 text-button font-medium text-primary',
          'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px]',
          'after:bg-gradient-to-r after:from-primary after:to-accent',
          'after:scale-x-0 after:origin-right after:transition-transform after:duration-300',
          'hover:after:scale-x-100 hover:after:origin-left',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
      >
        {children}
      </button>
    );
  }

  if (tier === 'secondary') {
    return (
      <motion.button
        ref={ref}
        type={type}
        onClick={handleClick}
        disabled={disabled}
        aria-label={ariaLabel}
        whileTap={!disabled ? { scale: 0.97 } : undefined}
        transition={springs.snappy}
        style={style}
        className={cn(
          'relative overflow-hidden inline-flex items-center justify-center px-5 py-2.5 rounded-xl',
          'text-button font-semibold text-primary-dark',
          'border border-transparent backdrop-blur-md',
          'transition-colors duration-200',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
      >
        <span
          className="absolute inset-0 rounded-xl"
          style={{ background: 'rgba(124, 58, 237, 0.08)' }}
        />
        <span
          aria-hidden
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            padding: '1px',
            background:
              'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(167,139,250,0.15))',
            WebkitMask:
              'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />
        <span className="relative z-10">{children}</span>
      </motion.button>
    );
  }

  // primary
  return (
    <motion.button
      ref={ref}
      type={type}
      onClick={handleClick}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      disabled={disabled}
      aria-label={ariaLabel}
      animate={{ x: pos.x, y: pos.y }}
      transition={springs.snappy}
      whileTap={!disabled ? { scale: 0.97 } : undefined}
      style={style}
      className={cn(
        'btn-shine-loop relative overflow-hidden inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl',
        'text-button font-semibold text-white',
        'shadow-[0_8px_24px_rgba(124,58,237,0.35),0_2px_4px_rgba(124,58,237,0.2)]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
        className
      )}
    >
      {/* gradient base */}
      <span
        className="absolute inset-0 rounded-xl"
        style={{
          background:
            'linear-gradient(135deg, #7C3AED 0%, #9333EA 50%, #A78BFA 100%)',
        }}
      />
      {/* inner shine */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%)',
        }}
      />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: r.x, top: r.y, width: 0, height: 0,
            background: 'rgba(255,255,255,0.45)',
            transform: 'translate(-50%, -50%)',
            animation: 'ripple-grow 700ms ease-out forwards',
          }}
        />
      ))}
      <style>{`@keyframes ripple-grow{to{width:520px;height:520px;opacity:0;}}`}</style>
    </motion.button>
  );
}