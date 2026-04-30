import { motion, useScroll, useSpring } from 'framer-motion';

export default function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scale = useSpring(scrollYProgress, { stiffness: 120, damping: 25, mass: 0.3 });
  return (
    <motion.div
      aria-hidden
      className="fixed top-0 inset-x-0 h-[3px] z-[150] origin-right"
      style={{
        scaleX: scale,
        background: 'linear-gradient(90deg, #7C3AED, #EC4899)',
      }}
    />
  );
}