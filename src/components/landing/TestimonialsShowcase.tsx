import { motion } from "framer-motion";

const testimonials = [
  { image: "/reviews/review-1.png" },
  { image: "/reviews/review-2.png" },
  { image: "/reviews/review-3.png" },
  { image: "/reviews/review-4.png" },
  { image: "/reviews/review-5.png" },
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
          <p className="text-gray-600 text-sm md:text-base">
            לקוחות אמיתיים. תוצאות אמיתיות.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
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
                  duration: 4 + (index % 2) * 0.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.2,
                },
                scale: { duration: 0.35, ease: "easeOut" },
              }}
              viewport={{ once: true }}
              className={`group relative rounded-3xl overflow-hidden ${index % 2 === 0 ? "mt-0" : "mt-4 md:mt-6"}`}
            >
              {/* Glass Card */}
              <div
                className="
                  relative
                  rounded-3xl
                  border border-black/10
                  bg-gradient-to-br from-purple-600/90 to-purple-400/90
                  backdrop-blur-2xl
                  shadow-[0_12px_42px_rgba(124,58,237,0.26),inset_0_1px_0_rgba(255,255,255,0.25)]
                  transition-all duration-300
                  group-hover:shadow-[0_0_28px_rgba(124,58,237,0.42),inset_0_1px_0_rgba(255,255,255,0.3)]
                "
              >
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
                    duration: 5.5,
                    repeat: Infinity,
                    ease: "linear",
                    delay: index * 0.35,
                  }}
                />

                {/* Badge */}
                <div className="absolute top-3 right-3 z-10">
                  <span
                    className="
                    text-xs font-medium text-white
                    px-3 py-1 rounded-full
                    bg-black/20 backdrop-blur
                    border border-white/20
                  "
                  >
                    לקוח מאומת
                  </span>
                </div>

                {/* Image */}
                <div className="p-3 relative z-[2]">
                  <div className="rounded-2xl overflow-hidden bg-white">
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
