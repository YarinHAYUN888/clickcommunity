import { useEffect, useState } from 'react';

const SECTIONS = [
  { id: 'hero', label: 'בית' },
  { id: 'stats', label: 'מספרים' },
  { id: 'who-we-are', label: 'מי אנחנו' },
  { id: 'concept', label: 'הקונספט' },
  { id: 'impact', label: 'השפעה' },
  { id: 'for-whom', label: 'למי' },
  { id: 'testimonials', label: 'המלצות' },
  { id: 'subscription', label: 'המנוי' },
  { id: 'moments', label: 'רגעים' },
  { id: 'bottom-line', label: 'השורה' },
  { id: 'social', label: 'עקבו' },
];

export default function SectionIndicators() {
  const [active, setActive] = useState('hero');

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { threshold: [0.3, 0.5, 0.7], rootMargin: '-30% 0px -30% 0px' },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <nav
      aria-label="ניווט בין מקטעים"
      className="hidden lg:flex fixed left-6 top-1/2 -translate-y-1/2 z-40 flex-col gap-4"
    >
      {SECTIONS.map((s) => {
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            aria-label={s.label}
            className="rounded-full transition-all"
            style={{
              width: isActive ? 12 : 8,
              height: isActive ? 12 : 8,
              background: isActive ? '#7C3AED' : 'rgba(124,58,237,0.3)',
              boxShadow: isActive ? '0 0 12px rgba(124,58,237,0.5)' : 'none',
            }}
          />
        );
      })}
    </nav>
  );
}