import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

const testimonials = [
  { image: "/reviews/user-frame-1.png" },
  { image: "/reviews/user-frame-2.png" },
  { image: "/reviews/user-frame-3.png" },
  { image: "/reviews/user-frame-4.png" },
  { image: "/reviews/user-frame-5.png" },
  { image: "/reviews/user-frame-6.png" },
  { image: "/reviews/user-frame-7.png" },
];

export default function TestimonialsShowcase() {
  const reduceMotion = useReducedMotion();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const closeLightbox = useCallback(() => setLightboxSrc(null), []);

  useEffect(() => {
    if (!lightboxSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxSrc, closeLightbox]);

  return (
    <section className="w-full py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold text-black mb-3">
            הם מדברים לבד
          </h2>
        </div>

        {/* Carousel on mobile / Grid on desktop */}
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:snap-none">
          {testimonials.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 22, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={reduceMotion ? undefined : { y: -2 }}
              transition={{
                duration: 0.45,
                delay: index * 0.06,
                ease: "easeOut",
              }}
              viewport={{ once: true, amount: 0.2 }}
              className="shrink-0 basis-[86%] snap-center md:basis-auto"
            >
              <button
                type="button"
                onClick={() => setLightboxSrc(item.image)}
                className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label="הגדלת צילום המסך לקריאה"
              >
                <img
                  src={item.image}
                  alt=""
                  loading="lazy"
                  className="block w-full h-auto object-contain select-none"
                  draggable={false}
                />
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {lightboxSrc && (
        <button
          type="button"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-3 sm:p-6"
          onClick={closeLightbox}
          aria-label="סגירת תצוגה מוגדלת"
        >
          <span className="sr-only">לחץ מחוץ לתמונה או Escape לסגירה</span>
          <img
            src={lightboxSrc}
            alt=""
            className="max-h-[min(92vh,1400px)] w-auto max-w-[min(96vw,1100px)] object-contain"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        </button>
      )}
    </section>
  );
}
