import RevealOnScroll from './RevealOnScroll';
import TiltCard from './TiltCard';
import WaveDivider from './WaveDivider';

const ITEMS = [
  'נמאס לך להרגיש שכולם סביבך כבר מצאו את "האנשים שלהם"',
  'את/ה מרגיש/ה שכבר לא מתחבר/ת לחבורה הקבועה',
  'רוצה להפסיק לחכות ל"עוד מסגרת" שתחבר אותך לאנשים חדשים',
  'רוצה לאתגר את עצמך ולצאת מאזור הנוחות',
  'מחפש/ת להרגיש חלק ממשהו גדול יותר',
  'רוצה לצבור את החוויות האמיתיות של שנות ה-20',
  'עברת תקופה מבלבלת וצריך/ה שינוי',
  'רוצה להכיר את השותף/ה, הזוגיות או החבורה הבאה שלך',
  'מאמין/ה באינטראקציות פנים מול פנים - לא במסכים',
];

export default function ForWhomSection() {
  return (
    <section
      id="for-whom"
      className="relative scroll-mt-[72px] overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #FAFAFA 0%, #F5F3FF 100%)' }}
    >
      <div className="absolute -top-px inset-x-0">
        <WaveDivider topColor="#5B21B6" />
      </div>
      <div className="relative max-w-[1100px] mx-auto px-6 md:px-10 py-[120px] md:py-[160px]">
        <RevealOnScroll>
          <h2
            className="text-center font-bold text-[40px] md:text-[56px]"
            style={{ color: '#1A1A2E', letterSpacing: '-1px' }}
          >
            למי זה מתאים
          </h2>
        </RevealOnScroll>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {ITEMS.map((text, i) => (
            <RevealOnScroll key={i} delay={i * 0.06} y={20} duration={0.5}>
              <TiltCard
                className="rounded-[20px] h-full"
                style={{
                  background: 'rgba(255,255,255,0.8)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(124,58,237,0.1)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                }}
              >
                <div className="p-6 flex items-start gap-4">
                  <span
                    className="mt-1 block flex-shrink-0 rounded-full"
                    style={{
                      width: 12, height: 12,
                      background: 'linear-gradient(135deg, #7C3AED, #EC4899)',
                      boxShadow: '0 0 8px rgba(124,58,237,0.4)',
                    }}
                  />
                  <p
                    className="text-right flex-1 font-medium text-[16px] md:text-[17px]"
                    style={{ color: '#1A1A2E', lineHeight: 1.5 }}
                  >
                    {text}
                  </p>
                </div>
              </TiltCard>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}