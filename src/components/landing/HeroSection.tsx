import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import MagneticButton from './MagneticButton';
import GradientText from './GradientText';
import CursorFollower from './CursorFollower';
import clickHeroLogo from '@/assets/click-hero-logo.png';

const HERO_VIDEO_URL =
  'https://lwprevqahebqenpzdvle.supabase.co/storage/v1/object/public/hero-videos/copy_01EEA577-1BF7-4FA5-9F19-92175F9217B6.mov';

const HEAD_LINE_2_PRE = 'הסביבה החדשה ';
const HEAD_LINE_2_HL = 'שלכם';
const HEAD_LINE_3_PRE = 'ממש ';
const HEAD_LINE_3_OUTLINE_PRE = 'כאן';
const SUB_PRE = 'Click with your people';
const SUB_POST = ' — תתחילו כאן';

function SplitText({ text, baseDelay = 0, color, gradient, outline }: { text: string; baseDelay?: number; color?: string; gradient?: string; outline?: boolean; }) {
  const reduce = useReducedMotion();
  const chars = Array.from(text);

  const charStyle = (c: string): React.CSSProperties => ({
    display: 'inline-block',
    whiteSpace: c === ' ' ? 'pre' : 'normal',
    ...(gradient ? {
      backgroundImage: gradient,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      color: 'transparent',
    } : {}),
    ...(outline ? {
      color: 'transparent',
      WebkitTextStroke: '2px #FFFFFF',
    } : {}),
    ...(color && !gradient && !outline ? { color } : {}),
  });

  const renderChar = (c: string, i: number) => (
    <motion.span
      key={i}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce
        ? { duration: 0.4, delay: baseDelay }
        : { type: 'spring', damping: 15, stiffness: 200, delay: baseDelay + i * 0.02 }}
      style={charStyle(c)}
    >
      {c}
    </motion.span>
  );

  // Group consecutive non-space chars into a nowrap span so words stay together,
  // while still allowing line breaks at the spaces between words.
  const segments: Array<{ chars: { c: string; i: number }[]; isSpace: boolean }> = [];
  let buf: { c: string; i: number }[] = [];
  chars.forEach((c, i) => {
    if (c === ' ') {
      if (buf.length) { segments.push({ chars: buf, isSpace: false }); buf = []; }
      segments.push({ chars: [{ c, i }], isSpace: true });
    } else {
      buf.push({ c, i });
    }
  });
  if (buf.length) segments.push({ chars: buf, isSpace: false });

  return (
    <>
      {segments.map((seg, sIdx) =>
        seg.isSpace
          ? renderChar(seg.chars[0].c, seg.chars[0].i)
          : (
            <span
              key={`w-${sIdx}`}
              style={{ display: 'inline-block', whiteSpace: 'nowrap' }}
            >
              {seg.chars.map(({ c, i }) => renderChar(c, i))}
            </span>
          )
      )}
    </>
  );
}

export default function HeroSection() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Respect prefers-reduced-motion: pause the video so a static frame is shown
  useEffect(() => {
    if (reduce && videoRef.current) videoRef.current.pause();
  }, [reduce]);

  return (
    <section
      id="hero"
      className="relative min-h-screen w-full flex flex-col items-center justify-center px-6 pt-20 lg:pt-24 pb-32 overflow-hidden isolate"
      style={{ background: '#0F0F1A' }}
    >
      <CursorFollower />

      {/* Layer 0: Hero video (deepest background) */}
      <video
        ref={videoRef}
        src={HERO_VIDEO_URL}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
        tabIndex={-1}
        className="absolute inset-0 -z-20 w-full h-full object-cover pointer-events-none select-none"
      />

      {/* Layer 0.5: Black overlay — keeps the text crisp over the video */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ zIndex: -15, background: 'rgba(0, 0, 0, 0.55)' }}
      />

      {/* Layer 1: Dimmed grid (drifts gently) — only static visual overlay on top of the shader */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 animate-grid-drift"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          opacity: 0.45,
        }}
      />

      {/* Layer 2: Subtle noise texture */}
      <svg className="pointer-events-none absolute inset-0 -z-10 w-full h-full" aria-hidden>
        <filter id="hero-noise">
          <feTurbulence baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#hero-noise)" opacity="0.04" />
      </svg>

      {/* Layer 3: Vignette + readability scrim — keeps text crisp over the shader */}
      <div className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(ellipse at center, rgba(15,15,26,0.35) 0%, transparent 55%, rgba(0,0,0,0.45) 100%)' }} />

      <div className="relative z-10 max-w-[1000px] w-full text-center">
        <h1
          className="font-extrabold"
          style={{ color: '#FFFFFF', lineHeight: 1.15, letterSpacing: '-1.5px', fontWeight: 900 }}
        >
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={reduce
              ? { duration: 0.5, delay: 0.5 }
              : { type: 'spring', damping: 14, stiffness: 180, delay: 0.5 }}
            className="flex justify-center mb-2 md:mb-4"
          >
            <img
              src={clickHeroLogo}
              alt="Click"
              width={591}
              height={422}
              decoding="async"
              loading="eager"
              draggable={false}
              className="h-[80px] sm:h-[100px] md:h-[130px] lg:h-[160px] w-auto select-none"
              style={{
                objectFit: 'contain',
                filter: 'drop-shadow(0 8px 28px rgba(124,58,237,0.5)) drop-shadow(0 3px 10px rgba(236,72,153,0.22))',
              }}
            />
          </motion.div>
          <div className="text-[30px] sm:text-[52px] md:text-[68px] lg:text-[88px] whitespace-normal sm:whitespace-nowrap mb-1 md:mb-2 px-2">
            <SplitText text={HEAD_LINE_2_PRE} baseDelay={0.7} color="#FFFFFF" />
            <SplitText text={HEAD_LINE_2_HL} baseDelay={0.7 + HEAD_LINE_2_PRE.length * 0.02} gradient="linear-gradient(135deg, #A78BFA, #EC4899)" />
          </div>
          <div className="text-[30px] sm:text-[52px] md:text-[68px] lg:text-[88px] whitespace-normal sm:whitespace-nowrap px-2">
            <SplitText text={HEAD_LINE_3_PRE} baseDelay={0.95} color="#FFFFFF" />
            <SplitText text={HEAD_LINE_3_OUTLINE_PRE} baseDelay={0.95 + HEAD_LINE_3_PRE.length * 0.02} outline />
          </div>
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: reduce ? 0 : 1.5 }}
          className="mt-8 font-medium text-[18px] md:text-[26px] max-w-[700px] mx-auto"
          style={{ color: 'rgba(255,255,255,0.85)' }}
        >
          <span className="relative inline-block">
            <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>{SUB_PRE}</span>
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: reduce ? 0 : 1.9 }}
              className="absolute bottom-[-4px] left-0 right-0 h-[2px] origin-left"
              style={{ background: 'linear-gradient(90deg, #A78BFA, #EC4899)' }}
              aria-hidden
            />
          </span>
          {SUB_POST}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: reduce ? 0 : 1.8 }}
          className="mt-8 flex flex-col md:flex-row items-center justify-center gap-3 md:gap-4"
        >
          <MagneticButton
            onClick={() => navigate('/onboarding/credentials')}
            className="rounded-full font-semibold text-white"
            style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 50%, #A78BFA 100%)',
              boxShadow: '0 8px 32px rgba(124,58,237,0.5)',
              height: 60, minWidth: 240, fontSize: 18, color: '#FFFFFF',
            }}
          >
            בואו נתחיל
          </MagneticButton>
          <button
            data-cursor="button"
            onClick={() => navigate('/login')}
            className="rounded-full font-medium transition-all"
            style={{
              height: 60, minWidth: 240, fontSize: 16,
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#FFFFFF',
            }}
          >
            יש לי כבר חשבון
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: reduce ? 0 : 2.0 }}
          className="mt-4 mb-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px]"
          style={{ color: 'rgba(255,255,255,0.65)' }}
        >
          <span><span style={{ color: '#10B981' }}>✓</span> ₪120 לחודש</span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
          <span><span style={{ color: '#10B981' }}>✓</span> ביטול בכל עת</span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
          <span><span style={{ color: '#10B981' }}>✓</span> ללא התחייבות</span>
        </motion.div>
      </div>

      {/* Scroll mouse indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: reduce ? 0 : 2.2 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
        aria-hidden
      >
        <div
          className="relative rounded-[12px] flex justify-center pt-2"
          style={{ width: 24, height: 40, border: '1px solid rgba(255,255,255,0.3)' }}
        >
          <span className="block rounded-full animate-scroll-mouse-dot" style={{ width: 4, height: 4, background: '#FFFFFF' }} />
        </div>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>גלול/י לגלות</span>
      </motion.div>
    </section>
  );
}