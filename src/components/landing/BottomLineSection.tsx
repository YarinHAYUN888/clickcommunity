import { useNavigate } from 'react-router-dom';
import RevealOnScroll from './RevealOnScroll';
import AnimatedBlobs from './AnimatedBlobs';
import Starfield from './Starfield';
import WaveDivider from './WaveDivider';
import MagneticButton from './MagneticButton';
import GradientText from './GradientText';

export default function BottomLineSection() {
  const navigate = useNavigate();

  return (
    <section
      id="bottom-line"
      className="relative scroll-mt-[72px] overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #5B21B6 0%, #1A1A2E 50%, #0F0F1A 100%)' }}
    >
      <div className="absolute -top-px inset-x-0">
        <WaveDivider topColor="#FAFAFA" />
      </div>
      <Starfield count={90} />
      <AnimatedBlobs variant="final" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)' }}
      />
      <div className="relative z-10 max-w-[820px] mx-auto px-6 md:px-10 py-[160px] md:py-[200px]">
        <RevealOnScroll>
          <h2
            className="text-center font-bold text-[40px] md:text-[56px]"
            style={{ color: '#FFFFFF', letterSpacing: '-1px', textShadow: '0 0 40px rgba(167,139,250,0.3)' }}
          >
            השורה התחתונה
          </h2>
        </RevealOnScroll>

        <RevealOnScroll delay={0.15} y={30}>
          <p
            data-cursor="text"
            className="mt-10 text-right text-[18px] md:text-[22px]"
            style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.85 }}
          >
            <GradientText className="font-bold" style={{ fontSize: '1.25em' }}>
              שנות ה-20 קורות פעם אחת
            </GradientText>
            . הקשרים שתיצור/י עכשיו - הם אלה שיעצבו את כל החיים שלך הלאה. כל הזדמנות, כל סיפור טוב, כל דבר באמת משמעותי שיקרה לך בחיים - יגיע דרך אנשים.
          </p>
          <p
            data-cursor="text"
            className="mt-6 text-right text-[18px] md:text-[22px]"
            style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.85 }}
          >
            אז בואו,{' '}
            <GradientText className="font-bold" style={{ fontSize: '1.2em' }}>
              צאו מאזור הנוחות
            </GradientText>
            . תנו לעצמכם צ'אנס להכיר{' '}
            <GradientText className="font-bold" style={{ fontSize: '1.2em' }}>
              אנשים שישנו לכם את החיים
            </GradientText>
            . ומחכים כבר לפגוש אתכם. 💜
          </p>
        </RevealOnScroll>

        <div className="mt-14 flex justify-center">
          <MagneticButton
            onClick={() => navigate('/onboarding/credentials')}
            className="rounded-full font-bold animate-glow-pulse"
            style={{
              background: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 50%, #EC4899 100%)',
              color: '#FFFFFF',
              height: 72, minWidth: 360, padding: '0 56px', fontSize: 20,
              boxShadow: '0 16px 60px rgba(167,139,250,0.6)',
            }}
          >
            Click with your people — תתחילו כאן
          </MagneticButton>
        </div>
      </div>
    </section>
  );
}