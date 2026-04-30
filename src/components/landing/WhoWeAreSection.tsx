import RevealOnScroll from './RevealOnScroll';
import WaveDivider from './WaveDivider';

const P1_PRE = ' היא קהילה חברתית לצעירים בשנות ה-20, שנוצרה מתוך תובנה אחת פשוטה אבל עמוקה: בגיל הכי מבלבל בחיים - שבו אנחנו עדיין מחפשים את עצמנו וזקוקים יותר מתמיד לקשרים אמיתיים - רובנו מוצאים את עצמנו בודדים, תקועים באותה חבורה קבועה, או פשוט מרגישים שלא "קלקנו" בול עם האנשים סביבנו.';
const P2_PRE = ' באה לשנות את זה. אנחנו קהילה של אנשים איכותיים, סקרנים ופתוחים, שבאים לדייק את הסביבה החברתית שלהם - ולבחור בעצמם מי ילווה אותם בפרק החיים הזה.';

export default function WhoWeAreSection() {
  return (
    <section
      id="who-we-are"
      className="relative scroll-mt-[72px]"
      style={{
        background: 'linear-gradient(180deg, #FAFAFA 0%, #F5F3FF 50%, #FAFAFA 100%)',
      }}
    >
      {/* wave from dark stats above */}
      <div className="absolute -top-px inset-x-0">
        <WaveDivider topColor="#1A1A2E" />
      </div>
      {/* dot pattern */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(124,58,237,0.06) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="relative max-w-[860px] mx-auto px-6 md:px-10 py-[120px] md:py-[160px]">
        <RevealOnScroll>
          <h2
            className="text-center font-bold text-[40px] md:text-[56px]"
            style={{ color: '#1A1A2E', letterSpacing: '-1px' }}
          >
            מי אנחנו
          </h2>
        </RevealOnScroll>

        <RevealOnScroll delay={0.15} y={30}>
          <div
            className="mt-12"
            style={{
              background: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(124,58,237,0.12)',
              borderRadius: 24,
              boxShadow: '0 20px 60px rgba(124,58,237,0.08), 0 4px 12px rgba(0,0,0,0.04)',
              padding: '40px',
            }}
          >
            <p
              data-cursor="text"
              className="text-right text-[17px] md:text-[19px]"
              style={{ color: '#1A1A2E', lineHeight: 1.8 }}
            >
              <span className="font-bold" style={{ color: '#5B21B6' }}>CLICK</span>
              {P1_PRE}
            </p>
            <p
              data-cursor="text"
              className="mt-5 text-right text-[17px] md:text-[19px]"
              style={{ color: '#1A1A2E', lineHeight: 1.8 }}
            >
              <span className="font-bold" style={{ color: '#5B21B6' }}>CLICK</span>
              {P2_PRE}
            </p>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}