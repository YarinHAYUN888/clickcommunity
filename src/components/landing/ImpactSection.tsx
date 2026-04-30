import RevealOnScroll from './RevealOnScroll';
import AnimatedBlobs from './AnimatedBlobs';
import Starfield from './Starfield';
import WaveDivider from './WaveDivider';
import GradientText from './GradientText';

export default function ImpactSection() {
  return (
    <section
      id="impact"
      className="relative scroll-mt-[72px] overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #1A1A2E 0%, #2D1B69 50%, #5B21B6 100%)' }}
    >
      <div className="absolute -top-px inset-x-0">
        <WaveDivider topColor="#F5F3FF" />
      </div>
      <Starfield count={70} />
      <AnimatedBlobs variant="dark" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)' }}
      />
      <div className="relative z-10 max-w-[820px] mx-auto px-6 md:px-10 py-[120px] md:py-[160px]">
        <RevealOnScroll>
          <h2
            className="text-center font-bold text-[34px] md:text-[48px]"
            style={{ color: '#FFFFFF', lineHeight: 1.2, letterSpacing: '-1px' }}
          >
            לאנשים שמקיפים אותך יש{' '}
            <span style={{ textShadow: '0 0 30px rgba(167,139,250,0.5)' }}>השפעה עצומה</span>{' '}
            על חייך
          </h2>
        </RevealOnScroll>

        <RevealOnScroll delay={0.2} y={30}>
          <div className="mt-10 max-w-[720px] mx-auto">
            <p
              data-cursor="text"
              className="text-right text-[18px] md:text-[22px]"
              style={{ color: 'rgba(255,255,255,0.88)', lineHeight: 1.8 }}
            >
              אנשים עם סביבה חברתית עשירה ומגוונת -{' '}
              <GradientText className="font-semibold" style={{ fontSize: '1.15em' }}>
                מצליחים יותר, מאושרים יותר, בריאים יותר
              </GradientText>
              , ופשוט חיים חיים טובים יותר.
            </p>
            <p
              data-cursor="text"
              className="mt-6 text-right text-[18px] md:text-[22px]"
              style={{ color: 'rgba(255,255,255,0.88)', lineHeight: 1.8 }}
            >
              והאמת הכי פשוטה? הכל מחכה לך בצד השני של אזור הנוחות שלך. ברגע שאת/ה יוצא/ת מהדלת, הולך/ת לאירוע שלא הכרת בו אף אחד, מתיישב/ת ליד מישהו חדש ומתחיל/ה שיחה -{' '}
              <GradientText className="font-semibold" style={{ fontSize: '1.15em' }}>
                שם מתחילים החיים האמיתיים
              </GradientText>
              .
            </p>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}