import { useEffect, useRef, useState, ReactNode, CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface Props {
  children: ReactNode;
  radius?: number;
  strength?: number;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  type?: 'button' | 'submit';
}

interface Ripple { id: number; x: number; y: number; }

export default function MagneticButton({
  children,
  radius = 90,
  strength = 6,
  onClick,
  className,
  style,
  ariaLabel,
  type = 'button',
}: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [ripples, setRipples] = useState<Ripple[]>([]);

  useEffect(() => {
    if (reduce) return;
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (!isDesktop) return;
    const handle = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < radius) {
        const f = (radius - dist) / radius;
        setPos({ x: (dx / radius) * strength * f * 4, y: (dy / radius) * strength * f * 4 });
      } else {
        setPos({ x: 0, y: 0 });
      }
    };
    window.addEventListener('mousemove', handle);
    return () => window.removeEventListener('mousemove', handle);
  }, [radius, strength, reduce]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (el && !reduce) {
      const r = el.getBoundingClientRect();
      const id = Date.now();
      setRipples((rs) => [...rs, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
      setTimeout(() => setRipples((rs) => rs.filter((rr) => rr.id !== id)), 700);
    }
    onClick?.(e);
  };

  return (
    <motion.button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      data-cursor="button"
      onClick={handleClick}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: 'spring', stiffness: 200, damping: 15, mass: 0.5 }}
      whileTap={{ scale: 0.97 }}
      className={`relative overflow-hidden ${className ?? ''}`}
      style={style}
    >
      {children}
      {/* inner shine */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 50%)',
        }}
      />
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