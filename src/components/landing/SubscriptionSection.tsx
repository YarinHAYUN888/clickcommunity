import { Calendar, Sparkles, Users, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RevealOnScroll from './RevealOnScroll';
import TiltCard from './TiltCard';
import MagneticButton from './MagneticButton';
import GradientText from './GradientText';

const CARDS = [
  {
    icon: Calendar,
    title: '3 כניסות לאירועים המרכזיים',
    body: 'ערב חיבורים בבר סגור שהופך למסיבה',
  },
  {
    icon: Sparkles,
    title: 'אירועי קונספט גדולים',
    body: 'כנסים, טיולים, מסיבות - במחירים מיוחדים לחברי הקהילה',
  },
  {
    icon: Users,
    title: 'גישה למערכת חברתית מלאה',
    body: "צ'אטים פנימיים, התאמות לפי תחומי עניין, אפשרות לתקשר עם חברי קהילה אחרים, ולהיות סביב חברה בכל רגע נתון - גם בין האירועים",
  },
  {
    icon: Crown,
    title: 'האפשרות ליצור אירועים משלך',
    body: 'כחבר/ת קהילה, את/ה לא רק מגיע/ה לאירועים - את/ה יוצר/ת אותם. רוצה לארגן ארוחת שישי? ערב משחקים? יציאה לחוף? טיול ספונטני? את/ה יכול/ה ליזום אירוע משלך, להחליט מי נכנס אליו, ולבנות לעצמך את החבורה המדויקת שתמיד חלמת עליה',
  },
];

export default function SubscriptionSection() {
  const navigate = useNavigate();

  return (
    <section
      id="subscription"
      className="relative scroll-mt-[72px] py-[120px] md:py-[160px] px-6 md:px-10"
      style={{ background: 'linear-gradient(180deg, #EDE9FE 0%, #F5F3FF 50%, #FAFAFA 100%)' }}
    >
      <div className="max-w-[1200px] mx-auto">
        <RevealOnScroll>
          <h2
            className="text-center font-bold text-[40px] md:text-[56px]"
            style={{ color: '#1A1A2E', letterSpacing: '-1px' }}
          >
            הדיל מנוי חודשי ב-
            <GradientText gradient="linear-gradient(135deg, #7C3AED, #EC4899)">₪120</GradientText>
          </h2>
          <p
            className="mt-4 text-center text-[18px] md:text-[22px] font-medium max-w-[700px] mx-auto"
            style={{ color: '#374151' }}
          >
            במחיר של ערב יציאה אחד - את/ה מקבל/ת חודש שלם של קהילה:
          </p>
        </RevealOnScroll>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
          {CARDS.map((card, i) => {
            const Icon = card.icon;
            const isPremium = i === 3;
            return (
              <RevealOnScroll key={i} delay={i * 0.12} y={30}>
                <TiltCard
                  className={`rounded-[24px] h-full ${isPremium ? 'conic-border' : ''}`}
                  style={{
                    background: '#FFFFFF',
                    border: isPremium ? '0' : '1px solid rgba(124,58,237,0.08)',
                    boxShadow: '0 10px 40px rgba(124,58,237,0.08)',
                  }}
                >
                  <div className="p-10 text-right">
                    <div
                      className="rounded-full flex items-center justify-center"
                      style={{
                        width: 72, height: 72,
                        background: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)',
                        border: '1px solid rgba(124,58,237,0.15)',
                        marginInlineStart: 'auto',
                      }}
                    >
                      <Icon size={32} style={{ color: '#5B21B6' }} aria-hidden />
                    </div>
                    <h3
                      className="mt-5 font-bold text-[22px]"
                      style={{ color: '#1A1A2E', lineHeight: 1.3 }}
                    >
                      {card.title}
                    </h3>
                    <p
                      data-cursor="text"
                      className="mt-3 text-[16px]"
                      style={{ color: '#374151', lineHeight: 1.6 }}
                    >
                      {card.body}
                    </p>
                  </div>
                </TiltCard>
              </RevealOnScroll>
            );
          })}
        </div>

        <RevealOnScroll delay={0.2}>
          <p
            className="mt-16 text-center font-semibold text-[22px] md:text-[28px] max-w-[800px] mx-auto"
            style={{ color: '#1A1A2E', lineHeight: 1.5 }}
          >
            זה אומר שאת/ה לא תלוי/ה באף אחד -
            <br />
            יש לך{' '}
            <span
              className="relative font-bold"
              style={{ color: '#5B21B6' }}
            >
              את הכלים, את הקהילה, ואת החופש
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 right-0 h-[2px]"
                style={{ background: 'linear-gradient(90deg, #A78BFA, #7C3AED)' }}
              />
            </span>
            {' '}ליצור לעצמך את חיי החברה שתמיד רצית.
          </p>
        </RevealOnScroll>

        <div className="mt-12 flex flex-col items-center gap-5">
          <MagneticButton
            onClick={() => navigate('/onboarding/credentials')}
            className="rounded-full font-bold animate-glow-pulse"
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #9333EA, #A78BFA)',
              color: '#FFFFFF',
              height: 64, minWidth: 320, padding: '0 48px', fontSize: 19,
              boxShadow: '0 12px 40px rgba(124,58,237,0.5)',
            }}
          >
            הצטרפו עכשיו — ₪120 לחודש
          </MagneticButton>
          <div
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px]"
            style={{ color: '#6B7280' }}
          >
            <span><span style={{ color: '#10B981' }}>✓</span> ביטול בכל עת</span>
            <span><span style={{ color: '#10B981' }}>✓</span> ללא התחייבות</span>
            <span><span style={{ color: '#10B981' }}>✓</span> הצטרפות מיידית</span>
          </div>
        </div>
      </div>
    </section>
  );
}