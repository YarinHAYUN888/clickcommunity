import CountUp from './CountUp';

const STATS: { value: number; label: string; suffix?: string }[] = [
  { value: 100, suffix: '%', label: 'חוויה בלתי נשכחת' },
  { value: 100, suffix: '+', label: 'קליקים' },
  { value: 52, label: 'אירועים השנה' },
  { value: 100, suffix: '+', label: 'חברי קהילה' },
];

export default function StatsStrip() {
  return (
    <section
      id="stats"
      className="relative w-full overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0F0F1A 0%, #1A1A2E 100%)', padding: '48px 24px' }}
    >
      <svg className="pointer-events-none absolute inset-0 w-full h-full opacity-40" aria-hidden>
        <filter id="stats-noise"><feTurbulence baseFrequency="0.85" numOctaves="2" /></filter>
        <rect width="100%" height="100%" filter="url(#stats-noise)" opacity="0.04" />
      </svg>
      <div className="relative max-w-[1100px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0">
        {STATS.map((s, i) => (
          <div
            key={s.label}
            className="text-center md:px-6"
            style={{
              borderLeft: i > 0 ? '1px solid rgba(167,139,250,0.2)' : undefined,
            }}
          >
            <div
              className="font-bold text-[40px] md:text-[56px] leading-none"
              style={{ color: '#FFFFFF' }}
            >
              <span dir="ltr" style={{ unicodeBidi: 'isolate', display: 'inline-block' }}>
                <CountUp to={s.value} />
                {s.suffix}
              </span>
            </div>
            <div
              className="mt-2 text-[13px] md:text-[15px]"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}