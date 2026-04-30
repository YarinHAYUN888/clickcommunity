import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import ClicksLogo from '@/components/ui/ClicksLogo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const LINKS = [
  { label: 'מה זה Click', id: 'who-we-are' },
  { label: 'מי אנחנו', id: 'who-we-are' },
  { label: 'למי זה מתאים', id: 'for-whom' },
  { label: 'המנוי', id: 'subscription' },
  { label: 'עקבו אחרינו', id: 'social' },
];

export default function MobileMenuOverlay({ isOpen, onClose }: Props) {
  const navigate = useNavigate();

  const scrollTo = (id: string) => {
    onClose();
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-40 flex flex-col items-center justify-center px-6"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
          }}
        >
          <div className="absolute top-6 start-6">
            <ClicksLogo size={52} glow />
          </div>
          <motion.nav
            className="flex flex-col items-center gap-8"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
            }}
          >
            {LINKS.map((link) => (
              <motion.button
                key={link.label}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
                onClick={() => scrollTo(link.id)}
                className="text-[22px] font-semibold"
                style={{ color: 'hsl(var(--foreground))' }}
              >
                {link.label}
              </motion.button>
            ))}
          </motion.nav>

          <div className="absolute bottom-12 start-6 end-6 flex flex-col gap-3">
            <button
              onClick={() => { onClose(); navigate('/login'); }}
              className="w-full h-12 rounded-full font-medium text-base border-2"
              style={{ borderColor: 'hsl(var(--color-primary))', color: 'hsl(var(--color-primary))' }}
            >
              התחברות
            </button>
            <button
              onClick={() => { onClose(); navigate('/onboarding/credentials'); }}
              className="w-full h-12 rounded-full font-semibold text-base text-white"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)' }}
            >
              הרשמה
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}