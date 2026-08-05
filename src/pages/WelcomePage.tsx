import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import ClicksLogo from '@/components/ui/ClicksLogo';

/**
 * Splash / welcome entry. Centering is explicit so global `html { direction:rtl; text-align:right }`
 * and shrink-to-fit controls cannot drift the stack toward the inline-start (right) edge.
 */
export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <AnimatedBackground className="items-center justify-center pt-[max(12px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]">
      <div
        data-welcome="content"
        className="z-10"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          maxWidth: '28rem',
          marginInline: 'auto',
          paddingInline: '1.5rem',
          boxSizing: 'border-box',
          textAlign: 'center',
        }}
      >
        {/* Logo */}
        <motion.div
          data-welcome="logo"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            display: 'flex',
            width: '100%',
            alignSelf: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            marginInline: 'auto',
            lineHeight: 0,
          }}
        >
          {/* `tight` keeps the artwork optically centred; 162 matches the previous rendered size. */}
          <ClicksLogo size={162} variant="tight" glow />
        </motion.div>

        {/* Tagline */}
        <motion.p
          data-welcome="tagline"
          className="mt-3 text-lg text-muted-foreground md:text-[22px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          style={{
            width: '100%',
            alignSelf: 'stretch',
            marginInline: 'auto',
            textAlign: 'center',
          }}
        >
          הקליק הבא שלך מתחיל כאן
        </motion.p>

        {/* Primary CTA */}
        <motion.button
          data-welcome="cta"
          className="z-10 mt-10 h-14 w-[280px] max-w-full rounded-full text-lg font-semibold text-primary-foreground md:w-[320px]"
          style={{
            display: 'flex',
            alignSelf: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            marginInline: 'auto',
            textAlign: 'center',
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
          data-welcome="terms"
          className="mt-4 text-[13px] text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{
            width: '100%',
            maxWidth: '20rem',
            alignSelf: 'center',
            marginInline: 'auto',
            textAlign: 'center',
            textWrap: 'balance',
          }}
        >
          בהמשך השימוש את/ה מסכים/ה ל
          <button type="button" className="mx-0.5 text-primary-light underline">
            תנאי השימוש
          </button>
          ו
          <button type="button" className="mx-0.5 text-primary-light underline">
            מדיניות הפרטיות
          </button>
        </motion.p>

        {/* Secondary CTA */}
        <motion.button
          data-welcome="signin"
          type="button"
          className="mt-2 text-base font-medium"
          style={{
            display: 'flex',
            width: '100%',
            alignSelf: 'stretch',
            alignItems: 'center',
            justifyContent: 'center',
            marginInline: 'auto',
            textAlign: 'center',
            color: 'hsl(var(--color-primary))',
            background: 'transparent',
            border: 'none',
            paddingInline: 0,
          }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/login')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          יש לי כבר חשבון
        </motion.button>
      </div>
    </AnimatedBackground>
  );
}
