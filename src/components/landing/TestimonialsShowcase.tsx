import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const testimonials = [
  { src: '/reviews/user-frame-1.png', alt: 'המלצות קליקרים 1' },
  { src: '/reviews/user-frame-2.png', alt: 'המלצות קליקרים 2' },
  { src: '/reviews/user-frame-3.png', alt: 'המלצות קליקרים 3' },
  { src: '/reviews/user-frame-4.png', alt: 'המלצות קליקרים 4' },
  { src: '/reviews/user-frame-5.png', alt: 'המלצות קליקרים 5' },
  { src: '/reviews/user-frame-6.png', alt: 'המלצות קליקרים 6' },
  { src: '/reviews/user-frame-7.png', alt: 'המלצות קליקרים 7' },
];

export default function TestimonialsShowcase() {
  const [currentIndex, setCurrentIndex] = useState(Math.floor(testimonials.length / 2));
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const closeLightbox = useCallback(() => setLightboxSrc(null), []);

  const handleNext = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + testimonials.length) % testimonials.length);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(handleNext, 4000);
    return () => window.clearInterval(timer);
  }, [handleNext]);

  useEffect(() => {
    if (!lightboxSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxSrc, closeLightbox]);

  const computedSlides = useMemo(() => {
    return testimonials.map((image, index) => {
      const offset = index - currentIndex;
      const total = testimonials.length;
      let pos = (offset + total) % total;
      if (pos > Math.floor(total / 2)) pos -= total;
      const isCenter = pos === 0;
      const isAdjacent = Math.abs(pos) === 1;
      return { image, pos, isCenter, isAdjacent };
    });
  }, [currentIndex]);

  return (
    <section className="relative w-full overflow-hidden bg-white py-24">
      <div className="absolute inset-0 z-0 opacity-25" aria-hidden="true">
        <div className="absolute top-[-12%] right-[-18%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(124,58,237,0.24),rgba(255,255,255,0))]" />
        <div className="absolute top-[-10%] left-[-20%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(236,72,153,0.18),rgba(255,255,255,0))]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4">
        <div className="mb-10 space-y-3 text-center md:mb-14">
          <h2
            className="text-[42px] font-extrabold leading-none tracking-tight text-foreground md:text-[56px]"
            style={{
              fontFamily: 'Assistant, Rubik, sans-serif',
              textShadow: '0 0 16px rgba(124,58,237,0.22), 0 0 28px rgba(236,72,153,0.14)',
            }}
          >
            הם מדברים לבד
          </h2>
          <p
            className="mx-auto max-w-2xl text-sm md:text-base"
            style={{
              fontFamily: 'Assistant, Rubik, sans-serif',
              color: 'rgba(124,58,237,0.86)',
              textShadow: '0 0 12px rgba(124,58,237,0.16)',
            }}
          >
            הנה מה שהקליקרים שלנו אומרים
          </p>
        </div>

        <div className="relative mx-auto flex h-[480px] w-full items-center justify-center md:h-[620px]">
          <div className="relative flex h-full w-full items-center justify-center [perspective:1100px]">
            {computedSlides.map(({ image, pos, isCenter, isAdjacent }) => (
              <div
                key={image.src}
                className="absolute flex h-[430px] w-[250px] items-center justify-center transition-all duration-700 ease-out md:h-[560px] md:w-[320px]"
                style={{
                  transform: `translateX(${pos * 50}%) scale(${isCenter ? 1 : isAdjacent ? 0.86 : 0.72}) rotateY(${pos * -11}deg)`,
                  zIndex: isCenter ? 10 : isAdjacent ? 6 : 1,
                  opacity: isCenter ? 1 : isAdjacent ? 0.52 : 0,
                  filter: isCenter ? 'blur(0px)' : 'blur(3px)',
                  visibility: Math.abs(pos) > 1 ? 'hidden' : 'visible',
                }}
              >
                <button
                  type="button"
                  onClick={() => setLightboxSrc(image.src)}
                  className="block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  aria-label={`הגדלת ${image.alt}`}
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    loading="lazy"
                    className="h-full w-full object-cover object-top select-none"
                    draggable={false}
                  />
                </button>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            className={cn(
              'absolute left-1 top-1/2 z-20 h-10 w-10 -translate-y-1/2 rounded-full border-primary/20 bg-white/65 text-primary backdrop-blur-sm',
              'sm:left-6',
            )}
            onClick={handlePrev}
            aria-label="הקודם"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              'absolute right-1 top-1/2 z-20 h-10 w-10 -translate-y-1/2 rounded-full border-primary/20 bg-white/65 text-primary backdrop-blur-sm',
              'sm:right-6',
            )}
            onClick={handleNext}
            aria-label="הבא"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {lightboxSrc && (
        <button
          type="button"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-6"
          onClick={closeLightbox}
          aria-label="סגירת תצוגה מוגדלת"
        >
          <span className="sr-only">לחץ מחוץ לתמונה או Escape לסגירה</span>
          <img
            src={lightboxSrc}
            alt=""
            className="max-h-[min(94vh,1600px)] w-auto max-w-[min(97vw,1200px)] object-contain"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        </button>
      )}
    </section>
  );
}
