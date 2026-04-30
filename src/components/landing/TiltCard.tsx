import { ReactNode, useRef, useState, CSSProperties } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';

interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  max?: number;
}

export default function TiltCard({ children, className, style, max = 6 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const [shine, setShine] = useState({ x: 50, y: 50 });

  const rx = useSpring(useTransform(my, [-0.5, 0.5], [max, -max]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-max, max]), { stiffness: 200, damping: 20 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    mx.set(px - 0.5);
    my.set(py - 0.5);
    setShine({ x: px * 100, y: py * 100 });
  };

  const handleLeave = () => {
    mx.set(0);
    my.set(0);
    setShine({ x: 50, y: 50 });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        rotateX: reduce ? 0 : rx,
        rotateY: reduce ? 0 : ry,
        transformPerspective: 1000,
        transformStyle: 'preserve-3d',
        ...style,
      }}
      className={`relative ${className ?? ''}`}
    >
      {children}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 lg:opacity-100"
        style={{
          background: `radial-gradient(400px circle at ${shine.x}% ${shine.y}%, rgba(167,139,250,0.18), transparent 40%)`,
          mixBlendMode: 'screen',
        }}
      />
    </motion.div>
  );
}