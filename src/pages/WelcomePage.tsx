import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import ClicksLogo from '@/components/ui/ClicksLogo';

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <AnimatedBackground className="flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <motion.div
        className="z-10"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <ClicksLogo size={180} glow />
      </motion.div>

      {/* Tagline */}
      <motion.p
        className="text-lg md:text-[22px] text-muted-foreground mt-3 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        הקליק הבא שלך מתחיל כאן
      </motion.p>

      {/* Primary CTA */}
      <motion.button
        className="w-[280px] md:w-[320px] h-14 rounded-full font-semibold text-lg text-primary-foreground mt-10 z-10"
        style={{
          background: 'linear-gradient(135deg, hsl(263 84% 55%), hsl(271 81% 56%))',
          boxShadow: '0 4px 16px rgba(124, 58, 237, 0.3)',
        }}
        whileTap={{ scale: 0.97 }}
        onClick={() => navigate('/onboarding/credentials')}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, type: 'spring', damping: 20 }}
      >
        בואו נתחיל
      </motion.button>

      {/* Terms */}
      <motion.p
        className="text-[13px] text-muted-foreground mt-4 text-center z-10 max-w-xs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        בהמשך השימוש את/ה מסכים/ה ל
        <button className="underline text-primary-light mx-0.5">תנאי השימוש</button>
        ו
        <button className="underline text-primary-light mx-0.5">מדיניות הפרטיות</button>
      </motion.p>

      {/* Secondary CTA */}
      <motion.button
        className="text-base font-medium mt-2 z-10"
        style={{ color: 'hsl(var(--color-primary))' }}
        whileTap={{ scale: 0.97 }}
        onClick={() => navigate('/login')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        יש לי כבר חשבון
      </motion.button>
    </AnimatedBackground>
  );
}
