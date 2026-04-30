import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

export default function CursorFollower() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<'default' | 'button' | 'text'>('default');

  useEffect(() => {
    if (reduce) return;
    const mq = window.matchMedia('(min-width: 1024px) and (pointer: fine)');
    setEnabled(mq.matches);
    const onChange = () => setEnabled(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [reduce]);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let tx = 0, ty = 0, x = 0, y = 0;
    let inHero = true;
    const heroEl = document.getElementById('hero');
    let observer: IntersectionObserver | null = null;
    if (heroEl) {
      observer = new IntersectionObserver(
        ([entry]) => { inHero = entry.isIntersecting; if (ref.current) ref.current.style.opacity = inHero ? '1' : '0'; },
        { threshold: 0.05 }
      );
      observer.observe(heroEl);
    }
    const onMove = (e: MouseEvent) => { tx = e.clientX; ty = e.clientY; };
    const onOver = (e: MouseEvent) => {
      const t = (e.target as HTMLElement)?.closest('[data-cursor]');
      const v = t?.getAttribute('data-cursor');
      setMode(v === 'button' ? 'button' : v === 'text' ? 'text' : 'default');
    };
    const tick = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      if (ref.current) ref.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseover', onOver);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      observer?.disconnect();
    };
  }, [enabled]);

  if (!enabled) return null;
  const size = mode === 'button' ? 56 : mode === 'text' ? 6 : 20;
  const bg = mode === 'button' ? 'rgba(124,58,237,0.15)' : 'rgba(124,58,237,0.4)';
  return (
    <div
      ref={ref}
      className="fixed top-0 left-0 z-[200] pointer-events-none rounded-full"
      style={{
        width: size, height: size,
        background: bg,
        mixBlendMode: 'difference',
        transition: 'width 200ms ease, height 200ms ease, background 200ms ease, opacity 250ms ease',
      }}
      aria-hidden
    />
  );
}