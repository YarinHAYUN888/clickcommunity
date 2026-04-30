import RevealOnScroll from './RevealOnScroll';

const NODES = [
  { cx: 80, cy: 90, r: 36, c1: '#7C3AED', c2: '#A78BFA' },
  { cx: 250, cy: 60, r: 28, c1: '#EC4899', c2: '#A78BFA' },
  { cx: 360, cy: 160, r: 40, c1: '#7C3AED', c2: '#EC4899' },
  { cx: 200, cy: 220, r: 32, c1: '#6366F1', c2: '#A78BFA' },
  { cx: 60, cy: 260, r: 26, c1: '#A78BFA', c2: '#7C3AED' },
  { cx: 320, cy: 290, r: 30, c1: '#EC4899', c2: '#7C3AED' },
];
const LINES = [
  [0, 1], [1, 2], [0, 3], [2, 3], [3, 4], [3, 5], [2, 5], [4, 5],
];

function Constellation() {
  return (
    <svg viewBox="0 0 420 360" className="w-full h-auto max-w-[480px] mx-auto animate-dash-flow" aria-hidden>
      <defs>
        {NODES.map((n, i) => (
          <linearGradient key={i} id={`node-${i}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={n.c1} />
            <stop offset="100%" stopColor={n.c2} />
          </linearGradient>
        ))}
      </defs>
      {LINES.map(([a, b], i) => (
        <line
          key={i}
          x1={NODES[a].cx} y1={NODES[a].cy}
          x2={NODES[b].cx} y2={NODES[b].cy}
          stroke="rgba(124,58,237,0.35)"
          strokeWidth="2"
          strokeDasharray="4 6"
        />
      ))}
      {NODES.map((n, i) => (
        <circle key={i} cx={n.cx} cy={n.cy} r={n.r} fill={`url(#node-${i})`} opacity="0.95" />
      ))}
    </svg>
  );
}

export default function ConceptSection() {
  return (
    <section
      id="concept"
      className="relative scroll-mt-[72px] py-[120px] md:py-[160px] px-6 md:px-10"
      style={{ background: 'linear-gradient(180deg, #FAFAFA 0%, #F5F3FF 100%)' }}
    >
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <RevealOnScroll>
            <h2
              className="font-bold text-[40px] md:text-[56px] text-center lg:text-right"
              style={{ color: '#1A1A2E', letterSpacing: '-1px' }}
            >
              הקונספט
            </h2>
          </RevealOnScroll>
          <RevealOnScroll delay={0.15} y={20}>
            <p
              data-cursor="text"
              className="mt-8 text-right text-[17px] md:text-[19px]"
              style={{ color: '#1A1A2E', lineHeight: 1.8 }}
            >
              אנחנו יוצרים מרחבים ואירועים שמחברים בין אנשים פנים מול פנים - לא דרך מסך, אלא באמת. הפוקוס שלנו הוא יצירת קשרים אמיתיים בעולם האמיתי: שיחות עומק, חברויות חדשות, זוגיות, הזדמנויות עסקיות, שותפויות, וכיף טהור.
            </p>
            <p
              data-cursor="text"
              className="mt-5 text-right text-[17px] md:text-[19px]"
              style={{ color: '#1A1A2E', lineHeight: 1.8 }}
            >
              כל אירוע מתוכנן כך שכולם יוצאים ממנו עם היכרויות חדשות משמעותיות - דרך שאלות עומק על השולחנות, ועצם המרחב שהקונספט שלו הוא "להכיר" זה פשוט עושה את שלו ותרגישו את זה מהשניה הראשונה, כל חשש פשוט יעלם.
            </p>
          </RevealOnScroll>
        </div>
        <RevealOnScroll delay={0.2} y={30}>
          <Constellation />
        </RevealOnScroll>
      </div>
    </section>
  );
}