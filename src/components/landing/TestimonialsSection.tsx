import { useState } from 'react';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import RevealOnScroll from './RevealOnScroll';

interface T { quote: string; name: string; age: number; label: string; initial: string; }
const TESTIMONIALS: T[] = [
  { quote: 'הגעתי לאירוע הראשון עם כפרפרים בבטן, וגיליתי שזה הכי הטבעי שיש. פגשתי אנשים שהפכו לחברים הכי טובים שלי בתוך חודש.', name: 'שיר', age: 26, label: 'חברת קהילה', initial: 'ש' },
  { quote: "אחרי שנים של 'לא הכרתי אף אחד חדש', Click היה בדיוק מה שחיפשתי. השאלות על השולחנות שוברות את הקרח מיד.", name: 'נועם', age: 27, label: 'חבר קהילה', initial: 'נ' },
  { quote: 'לא ציפיתי למצוא את החברה הטובה ביותר שלי באירוע של Click. עכשיו אני לא מחמיצה אירוע.', name: 'מעיין', age: 25, label: 'חברת קהילה', initial: 'מ' },
];

function Stars() {
  return (
    <div className="flex gap-1" aria-label="חמישה כוכבים">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ color: '#7C3AED' }}>★</span>
      ))}
    </div>
  );
}

function Card({ t }: { t: T }) {
  return (
    <div
      className="relative h-full p-8 rounded-[20px]"
      style={{ background: '#FFFFFF', boxShadow: '0 20px 60px rgba(124,58,237,0.1)' }}
    >
      <Quote size={32} className="absolute top-5 right-5" style={{ color: '#5B21B6' }} aria-hidden />
      <p className="mt-8 text-right text-[16px]" style={{ color: '#1A1A2E', lineHeight: 1.7 }}>
        {t.quote}
      </p>
      <div className="mt-5"><Stars /></div>
      <div className="mt-6 flex items-center gap-3 flex-row-reverse">
        <div
          className="rounded-full flex items-center justify-center font-bold text-white"
          style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #7C3AED, #A78BFA)', color: '#FFFFFF' }}
          aria-hidden
        >
          {t.initial}
        </div>
        <div className="text-right">
          <div style={{ color: '#1A1A2E', fontWeight: 600, fontSize: 15 }}>{t.name}, {t.age}</div>
          <div style={{ color: '#6B7280', fontSize: 13 }}>{t.label}</div>
        </div>
      </div>
    </div>
  );
}

export default function TestimonialsSection() {
  const [idx, setIdx] = useState(0);

  return (
    <section
      id="testimonials"
      className="relative scroll-mt-[72px] py-[120px] md:py-[160px] px-6 md:px-10"
      style={{ background: 'linear-gradient(180deg, #F5F3FF 0%, #EDE9FE 100%)' }}
    >
      <div className="max-w-[1200px] mx-auto">
        <RevealOnScroll>
          <h2
            className="text-center font-bold text-[40px] md:text-[56px]"
            style={{ color: '#1A1A2E', letterSpacing: '-1px' }}
          >
            מה אומרים עלינו
          </h2>
        </RevealOnScroll>

        {/* Desktop grid */}
        <div className="hidden md:grid mt-16 grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <RevealOnScroll key={i} delay={i * 0.12} y={30}>
              <Card t={t} />
            </RevealOnScroll>
          ))}
        </div>

        {/* Mobile carousel */}
        <div className="md:hidden mt-12 overflow-hidden">
          <motion.div
            className="flex"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.x > 60 && idx > 0) setIdx(idx - 1);
              else if (info.offset.x < -60 && idx < TESTIMONIALS.length - 1) setIdx(idx + 1);
            }}
            animate={{ x: `${idx * -100}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 30 }}
          >
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="flex-shrink-0 w-full px-1">
                <Card t={t} />
              </div>
            ))}
          </motion.div>
          <div className="mt-6 flex items-center justify-center gap-2">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`עבור להמלצה ${i + 1}`}
                className="rounded-full transition-all"
                style={{
                  width: idx === i ? 16 : 8,
                  height: 8,
                  background: idx === i ? '#7C3AED' : 'rgba(167,139,250,0.4)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}