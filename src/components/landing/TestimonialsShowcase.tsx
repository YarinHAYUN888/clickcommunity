import { motion } from "framer-motion";

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
        <div className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-3 -mx-1 px-1 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:snap-none">
          {testimonials.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              animate={{ y: [0, -2 - (index % 3), 0] }}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{
                opacity: { delay: index * 0.1, duration: 0.5 },
                y: {
                  duration: 4.6 + (index % 2) * 0.35,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.2,
                },
                scale: { duration: 0.35, ease: "easeOut" },
              }}
              viewport={{ once: true }}
              className={`group relative rounded-3xl overflow-hidden shrink-0 basis-[86%] snap-center md:basis-auto ${
                index % 2 === 0 ? "mt-0" : "mt-2 md:mt-5"
              }`}
            >
              {/* Glass Card */}
              <div
                className="
                  relative
                  rounded-3xl
                  border border-black/10
                  bg-gradient-to-br from-[#7C3AED]/92 via-[#8B5CF6]/88 to-[#A78BFA]/84
                  backdrop-blur-3xl
                  shadow-[0_14px_42px_rgba(124,58,237,0.30),0_0_0_1px_rgba(255,255,255,0.20)_inset]
                  transition-all duration-300
                  group-hover:shadow-[0_18px_52px_rgba(124,58,237,0.36),0_0_34px_rgba(124,58,237,0.32),0_0_0_1px_rgba(255,255,255,0.26)_inset]
                "
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-3xl"
                  style={{
                    background:
                      "radial-gradient(80% 60% at 20% 0%, rgba(255,255,255,0.18), transparent 65%), radial-gradient(80% 60% at 100% 100%, rgba(167,139,250,0.18), transparent 70%)",
                  }}
                />
                {/* Soft light sweep */}
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-[1]"
                  style={{
                    background:
                      "linear-gradient(120deg, transparent 40%, rgba(255,255,255,0.08), transparent 60%)",
                  }}
                  animate={{ x: ["-120%", "140%"] }}
                  transition={{
                    duration: 6.2,
                    repeat: Infinity,
                    ease: "linear",
                    delay: index * 0.35,
                  }}
                />

                {/* Image */}
                <div className="p-3 relative z-[2]">
                  <div className="rounded-2xl overflow-hidden bg-white/95 aspect-[3/4] md:aspect-[4/5] ring-1 ring-black/5">
                    <img
                      src={item.image}
                      alt="review"
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
