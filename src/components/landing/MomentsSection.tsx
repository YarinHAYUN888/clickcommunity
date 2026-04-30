import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  motion,
  AnimatePresence,
  useInView,
  useReducedMotion,
  type PanInfo,
} from 'framer-motion';
import {
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  Mic,
  Sparkles,
  MousePointerClick,
} from 'lucide-react';

import moment1 from '@/assets/moments/moment-1.png';
import moment2 from '@/assets/moments/moment-2.png';
import moment3 from '@/assets/moments/moment-3.png';
import moment4 from '@/assets/moments/moment-4.png';
import moment5 from '@/assets/moments/moment-5.png';
import moment6 from '@/assets/moments/moment-6.png';
import moment7 from '@/assets/moments/moment-7.png';
import moment8 from '@/assets/moments/moment-8.png';
import moment9 from '@/assets/moments/moment-9.png';
import moment10 from '@/assets/moments/moment-10.png';
import moment11 from '@/assets/moments/moment-11.png';
import moment12 from '@/assets/moments/moment-12.png';

/* -------------------- Types & Data -------------------- */

type Post = { src: string; alt: string };

type Highlight = {
  id: string;
  title: string;
  cover: string | null;
  status: 'filled' | 'soon';
  icon?: 'mic' | 'sparkles';
  posts: Post[];
};

const CLICK_PEOPLE_POSTS: Post[] = [
  { src: moment1, alt: 'רגע מאירוע 1' },
  { src: moment2, alt: 'רגע מאירוע 2' },
  { src: moment3, alt: 'רגע מאירוע 3' },
  { src: moment4, alt: 'רגע מאירוע 4' },
  { src: moment5, alt: 'רגע מאירוע 5' },
  { src: moment6, alt: 'רגע מאירוע 6' },
  { src: moment7, alt: 'רגע מאירוע 7' },
  { src: moment8, alt: 'רגע מאירוע 8' },
  { src: moment9, alt: 'רגע מאירוע 9' },
  { src: moment10, alt: 'רגע מאירוע 10' },
  { src: moment11, alt: 'רגע מאירוע 11' },
  { src: moment12, alt: 'רגע מאירוע 12' },
];

const HIGHLIGHTS: Highlight[] = [
  {
    id: 'click-people',
    title: 'Click People',
    cover: moment1,
    status: 'filled',
    posts: CLICK_PEOPLE_POSTS,
  },
  {
    id: 'interviews',
    title: 'ראיונות',
    cover: null,
    status: 'soon',
    icon: 'mic',
    posts: [],
  },
  {
    id: 'soon-1',
    title: '',
    cover: null,
    status: 'soon',
    icon: 'sparkles',
    posts: [],
  },
  {
    id: 'soon-2',
    title: '',
    cover: null,
    status: 'soon',
    icon: 'sparkles',
    posts: [],
  },
  {
    id: 'soon-3',
    title: '',
    cover: null,
    status: 'soon',
    icon: 'sparkles',
    posts: [],
  },
  {
    id: 'soon-4',
    title: '',
    cover: null,
    status: 'soon',
    icon: 'sparkles',
    posts: [],
  },
];

/* -------------------- HighlightCircle -------------------- */

function HighlightCircle({
  highlight,
  index,
  onOpen,
}: {
  highlight: Highlight;
  index: number;
  onOpen: (id: string) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15%' });
  const reduced = useReducedMotion();

  const isFilled = highlight.status === 'filled';
  const Icon = highlight.icon === 'mic' ? Mic : Sparkles;

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={() => onOpen(highlight.id)}
      aria-label={`פתח ${highlight.title || 'בקרוב'}`}
      initial={{ opacity: 0, y: 16, scale: 0.92 }}
      animate={
        inView
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: 16, scale: 0.92 }
      }
      transition={
        reduced
          ? { duration: 0.2, ease: 'easeOut' }
          : { type: 'spring', damping: 22, stiffness: 200, delay: index * 0.07 }
      }
      whileHover={reduced ? undefined : { scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      className="group flex flex-col items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-full"
    >
      {/* Outer gradient ring (or dashed border for soon) */}
      <div
        className="relative flex items-center justify-center rounded-full transition-shadow duration-300"
        style={{
          width: 88,
          height: 88,
          padding: isFilled ? 3 : 0,
          background: isFilled
            ? 'linear-gradient(135deg, #7C3AED 0%, #EC4899 50%, #A78BFA 100%)'
            : 'transparent',
          border: isFilled ? 'none' : '2px dashed rgba(124,58,237,0.30)',
          boxShadow: isFilled
            ? '0 6px 20px rgba(124,58,237,0.18)'
            : '0 2px 6px rgba(124,58,237,0.06)',
        }}
      >
        {/* Subtle pulsing halo — clarifies "tap to open" affordance (filled only) */}
        {isFilled && !reduced && (
          <>
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                border: '2px solid rgba(124,58,237,0.45)',
              }}
              animate={{ scale: [1, 1.22], opacity: [0.55, 0] }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: 'easeOut',
              }}
            />
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                border: '2px solid rgba(236,72,153,0.40)',
              }}
              animate={{ scale: [1, 1.22], opacity: [0.5, 0] }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: 'easeOut',
                delay: 1.1,
              }}
            />
          </>
        )}
        {/* Hover tap indicator — appears on group hover/focus */}
        <span
          aria-hidden
          className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 rounded-full opacity-0 scale-75 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 group-focus-visible:opacity-100 group-focus-visible:scale-100"
          style={{
            background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
            boxShadow: '0 4px 10px rgba(124,58,237,0.35)',
          }}
        >
          <MousePointerClick size={11} className="text-white" strokeWidth={2.4} />
        </span>
        {/* Inner circle */}
        <div
          className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
          style={{
            background: isFilled
              ? '#FFFFFF'
              : 'linear-gradient(135deg, rgba(124,58,237,0.10) 0%, rgba(236,72,153,0.06) 100%)',
            opacity: isFilled ? 1 : 0.85,
          }}
        >
          {isFilled && highlight.cover ? (
            <img
              src={highlight.cover}
              alt={highlight.title}
              loading="lazy"
              draggable={false}
              className="w-full h-full object-cover select-none transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
              style={{
                background:
                  'linear-gradient(135deg, rgba(124,58,237,0.16), rgba(236,72,153,0.10))',
              }}
            >
              <Icon size={20} className="text-primary" />
            </div>
          )}
        </div>
      </div>

      {/* Caption */}
      <div className="flex flex-col items-center gap-1 min-h-[42px]">
        <span
          className="text-[13px] md:text-[14px] font-medium leading-tight"
          style={{
            color: isFilled ? '#1A1A2E' : '#374151',
            fontFamily: 'Rubik, sans-serif',
          }}
        >
          {highlight.title || '\u00A0'}
        </span>
        {!isFilled && (
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(124,58,237,0.12)',
              color: '#7C3AED',
              fontFamily: 'Rubik, sans-serif',
            }}
          >
            בקרוב
          </span>
        )}
      </div>
    </motion.button>
  );
}

/* -------------------- HighlightModalFilled -------------------- */

function HighlightModalFilled({
  highlight,
  onClose,
}: {
  highlight: Highlight;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape key — only when inner Lightbox is closed (otherwise it handles its own Escape)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxIndex === null) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, lightboxIndex]);

  const stop = (e: ReactMouseEvent) => e.stopPropagation();

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0.15 : 0.25 }}
        onClick={onClose}
        className="fixed inset-0 z-[9000] flex items-center justify-center p-4 sm:p-6"
        style={{
          background: 'rgba(10,10,20,0.88)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={highlight.title}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 8 }}
          transition={
            reduced
              ? { duration: 0.2, ease: 'easeOut' }
              : { type: 'spring', damping: 28, stiffness: 240 }
          }
          onClick={stop}
          className="glass-premium rounded-3xl w-full max-w-[920px] max-h-[88vh] overflow-hidden flex flex-col relative"
        >
          {/* Top bar — title + avatar on the visual right (first in RTL), close X on the visual left (last in RTL) */}
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-primary/10 shrink-0">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-full overflow-hidden shrink-0"
                style={{
                  padding: 2,
                  background:
                    'linear-gradient(135deg, #7C3AED 0%, #EC4899 50%, #A78BFA 100%)',
                }}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-white">
                  {highlight.cover && (
                    <img
                      src={highlight.cover}
                      alt={highlight.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              </div>
              <span
                className="font-bold text-[15px] sm:text-[16px]"
                style={{ color: '#1A1A2E', fontFamily: 'Rubik, sans-serif' }}
              >
                {highlight.title}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="סגור"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(124,58,237,0.10)',
                color: '#7C3AED',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Posts grid */}
          <div className="overflow-y-auto p-3 sm:p-4">
            <div className="grid grid-cols-3 gap-1.5 md:gap-2">
              {highlight.posts.map((post, i) => (
                <motion.button
                  key={i}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={
                    reduced
                      ? { duration: 0.15, ease: 'easeOut' }
                      : { duration: 0.35, delay: i * 0.03, ease: 'easeOut' }
                  }
                  whileHover={reduced ? undefined : { scale: 1.01 }}
                  className="group relative aspect-square overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  aria-label={post.alt}
                >
                  <img
                    src={post.src}
                    alt={post.alt}
                    loading="lazy"
                    draggable={false}
                    className="w-full h-full object-cover select-none transition-transform duration-300 group-hover:scale-[1.05]"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                    style={{
                      background:
                        'linear-gradient(to top, rgba(124,58,237,0.45), rgba(124,58,237,0.10) 50%, transparent 70%)',
                    }}
                  >
                    <Maximize2
                      size={20}
                      className="text-white"
                      style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))' }}
                    />
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Inner Lightbox for individual zoom — keeps existing UX (keyboard, swipe, counter) */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <Lightbox
            posts={highlight.posts}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* -------------------- HighlightModalSoon -------------------- */

function HighlightModalSoon({
  highlight,
  onClose,
}: {
  highlight: Highlight;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const isInterviews = highlight.id === 'interviews';
  const Icon = highlight.icon === 'mic' ? Mic : Sparkles;
  const stop = (e: ReactMouseEvent) => e.stopPropagation();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.15 : 0.25 }}
      onClick={onClose}
      className="fixed inset-0 z-[9000] flex items-center justify-center p-4"
      style={{
        background: 'rgba(10,10,20,0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={isInterviews ? 'ראיונות — בקרוב' : 'בקרוב'}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 8 }}
        transition={
          reduced
            ? { duration: 0.2, ease: 'easeOut' }
            : { type: 'spring', damping: 26, stiffness: 230 }
        }
        onClick={stop}
        className="glass-premium rounded-3xl w-full max-w-[480px] p-8 md:p-10 text-center relative"
      >
        {/* Close X — top-left */}
        <button
          type="button"
          onClick={onClose}
          aria-label="סגור"
          className="absolute top-4 left-4 inline-flex items-center justify-center w-9 h-9 rounded-full transition-all hover:scale-105 active:scale-95"
          style={{
            background: 'rgba(124,58,237,0.10)',
            color: '#7C3AED',
          }}
        >
          <X size={18} />
        </button>

        {/* Centered gradient icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={
            reduced
              ? { duration: 0.2 }
              : { type: 'spring', damping: 18, stiffness: 220, delay: 0.05 }
          }
          className="mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-6"
          style={{
            background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
            boxShadow: '0 16px 40px rgba(124,58,237,0.35)',
          }}
        >
          <Icon size={36} className="text-white" strokeWidth={2.2} />
        </motion.div>

        {/* Soon pill */}
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-3"
          style={{
            background: 'rgba(124,58,237,0.10)',
            color: '#7C3AED',
            fontFamily: 'Rubik, sans-serif',
          }}
        >
          <Sparkles size={12} />
          בקרוב
        </div>

        {/* Headline */}
        <h3
          className="text-[24px] md:text-[28px] font-extrabold leading-tight text-gradient-premium mb-3"
          style={{ fontFamily: 'Rubik, sans-serif' }}
        >
          {isInterviews ? 'ראיונות מרגשים בדרך' : 'תוכן חדש בדרך'}
        </h3>

        {/* Sub */}
        <p
          className="text-[15px] text-muted-foreground"
          style={{ fontFamily: 'Rubik, sans-serif' }}
        >
          אנחנו מכינים משהו מיוחד.
        </p>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="mt-7 inline-flex items-center justify-center h-11 px-6 rounded-full text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95"
          style={{
            background: 'rgba(124,58,237,0.10)',
            color: '#7C3AED',
            border: '1px solid rgba(124,58,237,0.18)',
            fontFamily: 'Rubik, sans-serif',
          }}
        >
          סגור
        </button>
      </motion.div>
    </motion.div>
  );
}

/* -------------------- Lightbox (preserved, accepts posts) -------------------- */

function Lightbox({
  posts,
  index,
  onClose,
  onNavigate,
}: {
  posts: Post[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const reduced = useReducedMotion();
  const total = posts.length;

  const goPrev = useCallback(() => {
    if (index > 0) onNavigate(index - 1);
  }, [index, onNavigate]);
  const goNext = useCallback(() => {
    if (index < total - 1) onNavigate(index + 1);
  }, [index, onNavigate, total]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goNext();
      else if (e.key === 'ArrowRight') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, goNext, goPrev]);

  // Preload neighbors
  useEffect(() => {
    if (index > 0) {
      const img = new Image();
      img.src = posts[index - 1].src;
    }
    if (index < total - 1) {
      const img = new Image();
      img.src = posts[index + 1].src;
    }
  }, [index, total, posts]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120) onClose();
    else if (info.offset.x < -80) goNext();
    else if (info.offset.x > 80) goPrev();
  };

  const stop = (e: ReactMouseEvent) => e.stopPropagation();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.15 : 0.3 }}
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: 'rgba(10,10,20,0.92)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
      }}
      role="dialog"
      aria-modal="true"
    >
      {/* Close — top-left */}
      <button
        onClick={(e) => {
          stop(e);
          onClose();
        }}
        aria-label="סגור"
        className="fixed top-6 left-6 z-10 flex h-11 w-11 items-center justify-center rounded-full text-white transition-all hover:scale-105 active:scale-95"
        style={{
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.2)',
        }}
      >
        <X size={24} />
      </button>

      {/* Prev (right side in RTL) */}
      <button
        onClick={(e) => {
          stop(e);
          goPrev();
        }}
        disabled={index === 0}
        aria-label="הקודם"
        className="fixed top-1/2 right-6 z-10 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full text-white transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 md:flex"
        style={{
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.2)',
        }}
      >
        <ChevronRight size={28} />
      </button>

      {/* Next (left side in RTL) */}
      <button
        onClick={(e) => {
          stop(e);
          goNext();
        }}
        disabled={index === total - 1}
        aria-label="הבא"
        className="fixed top-1/2 left-6 z-10 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full text-white transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 md:flex"
        style={{
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.2)',
        }}
      >
        <ChevronLeft size={28} />
      </button>

      {/* Image */}
      <motion.img
        key={posts[index].src}
        src={posts[index].src}
        alt={posts[index].alt}
        onClick={stop}
        drag={!reduced}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          reduced
            ? { duration: 0.2, ease: 'easeOut' }
            : { type: 'spring', damping: 30, stiffness: 300 }
        }
        className="max-h-[85vh] max-w-[90vw] cursor-grab rounded-2xl object-contain active:cursor-grabbing"
        style={{
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          touchAction: 'none',
        }}
        draggable={false}
      />

      {/* Counter */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        onClick={stop}
        className="fixed bottom-8 left-1/2 z-10 -translate-x-1/2 rounded-full px-5 py-2 text-sm font-medium text-white"
        style={{
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.15)',
          fontFamily: 'Rubik, sans-serif',
        }}
      >
        {index + 1} / {total}
      </motion.div>
    </motion.div>
  );
}

/* -------------------- Section -------------------- */

export default function MomentsSection() {
  const [openId, setOpenId] = useState<string | null>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const titleInView = useInView(titleRef, { once: true, amount: 0.3 });
  const reduced = useReducedMotion();

  const active = openId
    ? HIGHLIGHTS.find((h) => h.id === openId) || null
    : null;

  return (
    <section
      id="moments"
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #FAFAFA 0%, #F5F3FF 100%)',
        padding: '120px 24px',
      }}
    >
      {/* Subtle noise overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative mx-auto max-w-[1200px]">
        {/* Header */}
        <motion.div
          ref={titleRef}
          initial={{ opacity: 0, y: 20 }}
          animate={titleInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={
            reduced
              ? { duration: 0.2, ease: 'easeOut' }
              : { type: 'spring', damping: 22, stiffness: 110 }
          }
          className="text-center"
        >
          <h2
            className="text-[40px] leading-tight md:text-[56px]"
            style={{
              fontFamily: 'Rubik, sans-serif',
              fontWeight: 700,
              color: '#1A1A2E',
              letterSpacing: '-1px',
            }}
          >
            Click’s peoples
          </h2>
          <p
            className="mx-auto mt-4 max-w-[700px] text-[18px] md:text-[22px]"
            style={{
              fontFamily: 'Rubik, sans-serif',
              fontWeight: 500,
              color: '#374151',
            }}
          >
            החלטנו לתת הצצה לאירועים אצלנו בקליק!
          </p>
        </motion.div>

        {/* Highlights row */}
        <div className="mt-14">
          {/* Tablet+ : 6-column grid */}
          <div className="hidden sm:grid grid-cols-6 gap-4 max-w-[820px] mx-auto justify-items-center">
            {HIGHLIGHTS.map((h, i) => (
              <HighlightCircle
                key={h.id}
                highlight={h}
                index={i}
                onOpen={setOpenId}
              />
            ))}
          </div>

          {/* Mobile : horizontal snap-scroll */}
          <div className="sm:hidden -mx-6 px-6 overflow-x-auto pb-2">
            <div className="flex gap-5 snap-x snap-mandatory">
              {HIGHLIGHTS.map((h, i) => (
                <div
                  key={h.id}
                  className="snap-start shrink-0"
                >
                  <HighlightCircle
                    highlight={h}
                    index={i}
                    onOpen={setOpenId}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Click-affordance hint */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={titleInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={
              reduced
                ? { duration: 0.2, ease: 'easeOut' }
                : { duration: 0.5, delay: 0.55, ease: 'easeOut' }
            }
            className="mt-9 sm:mt-10 flex items-center justify-center"
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
              style={{
                background: 'rgba(124,58,237,0.06)',
                border: '1px solid rgba(124,58,237,0.14)',
                boxShadow: '0 2px 10px rgba(124,58,237,0.06)',
              }}
            >
              <MousePointerClick
                size={15}
                className="text-primary"
                strokeWidth={2.3}
              />
              <span
                className="text-[13px] sm:text-[14px] font-medium"
                style={{
                  color: '#374151',
                  fontFamily: 'Rubik, sans-serif',
                  letterSpacing: '-0.1px',
                }}
              >
                לחצו על כל מעגל וגלו את התוכן בפנים
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {active && active.status === 'filled' && (
          <HighlightModalFilled
            key={`filled-${active.id}`}
            highlight={active}
            onClose={() => setOpenId(null)}
          />
        )}
        {active && active.status === 'soon' && (
          <HighlightModalSoon
            key={`soon-${active.id}`}
            highlight={active}
            onClose={() => setOpenId(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
