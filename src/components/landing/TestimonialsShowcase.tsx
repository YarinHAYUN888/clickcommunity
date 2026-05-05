import { motion, useReducedMotion } from "framer-motion";

const testimonials = [
  { image: "/reviews/review-1.png" },
  { image: "/reviews/review-2.png" },
  { image: "/reviews/review-3.png" },
  { image: "/reviews/review-4.png" },
  { image: "/reviews/review-5.png" },
  { image: "/reviews/review-6.png" },
  { image: "/reviews/review-7.png" },
  { image: "/reviews/review-8.png" },
  { image: "/reviews/review-9.png" },
];

export default function TestimonialsShowcase() {
  const reduceMotion = useReducedMotion();

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
        <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 -mx-1 px-1 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:snap-none">
          {testimonials.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              animate={reduceMotion ? false : { y: [0, -3, 0] }}
              whileHover={{ scale: reduceMotion ? 1 : 1.015, y: reduceMotion ? 0 : -3 }}
              transition={{
                opacity: { delay: index * 0.1, duration: 0.5 },
                y: reduceMotion
                  ? undefined
                  : {
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: index * 0.18,
                      duration: 4.75 + (index % 3) * 0.15,
                      repeatType: "loop",
                    },
                scale: { duration: 0.35, ease: "easeOut" },
              }}
              viewport={{ once: true }}
              className="group relative shrink-0 basis-[86%] snap-center md:basis-auto"
            >
              {/* Outer halo + neon frame (reference SVG: stroke glow, dark inner bezel) */}
              <div
                className={`relative rounded-[26px] p-[3px]
                  shadow-[0_0_36px_rgba(179,136,255,0.42),0_18px_50px_rgba(124,58,237,0.18)]
                  transition-[box-shadow,transform] duration-300
                  md:rounded-[28px]
                  group-hover:shadow-[0_0_44px_rgba(217,70,239,0.52),0_22px_60px_rgba(124,58,237,0.22)] ${
                    index % 2 === 1 ? "md:translate-y-2.5" : ""
                  }
                bg-gradient-to-b from-[#b388ff]/75 via-[#7C3AED]/45 to-[#4c1d95]/55`}
              >
                {/* Inner bezel — dark purple stripe like reference */}
                <div className="relative rounded-[23px] overflow-hidden md:rounded-[25px] border border-black/10 bg-[linear-gradient(180deg,#150826,#2a1248)]">
                  {/* Image slot — sits “inside” the card */}
                  <div className="m-2 rounded-[18px] overflow-hidden bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] md:m-3 md:rounded-[20px]">
                    <div className="aspect-[3/4] md:aspect-[4/5]">
                      <img
                        src={item.image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover select-none pointer-events-none"
                        draggable={false}
                      />
                    </div>
                  </div>

                  {/* Very subtle sweeping highlight on bezel only */}
                  {!reduceMotion && (
                    <motion.div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 mix-blend-soft-light opacity-55"
                      style={{
                        background:
                          "linear-gradient(120deg, transparent 42%, rgba(255,255,255,0.09), transparent 58%)",
                      }}
                      animate={{ x: ["-115%", "130%"] }}
                      transition={{
                        duration: 6.5,
                        repeat: Infinity,
                        ease: "linear",
                        delay: index * 0.4,
                      }}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
