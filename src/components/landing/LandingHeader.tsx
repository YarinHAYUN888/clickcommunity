import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import MobileMenuOverlay from './MobileMenuOverlay';
import MagneticButton from './MagneticButton';
import ClicksLogo from '@/components/ui/ClicksLogo';

const NAV_LINKS = [
  { label: 'מה זה Click', id: 'who-we-are' },
  { label: 'מי אנחנו', id: 'who-we-are' },
  { label: 'למי זה מתאים', id: 'for-whom' },
  { label: 'המנוי', id: 'subscription' },
  { label: 'עקבו אחרינו', id: 'social' },
];

export default function LandingHeader() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const navColor = scrolled ? '#374151' : 'rgba(255,255,255,0.85)';
  const logoColor = scrolled ? '#7C3AED' : '#FFFFFF';

  return (
    <>
      <motion.header
        className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(255,255,255,0.78)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(124,58,237,0.08)' : '1px solid transparent',
        }}
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="max-w-[1200px] mx-auto h-16 lg:h-[72px] flex items-center justify-between px-4 lg:px-10">
          <button
            data-cursor="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="transition-colors flex items-center gap-2"
            style={{ color: logoColor }}
            aria-label="Clicks - חזור למעלה"
          >
            <ClicksLogo size={48} glow={!scrolled} />
          </button>

          <nav className="hidden lg:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <button
                key={l.label}
                data-cursor="button"
                onClick={() => scrollTo(l.id)}
                className="relative text-[15px] font-medium transition-colors group"
                style={{ color: navColor }}
              >
                <span className="transition-colors group-hover:text-[#7C3AED]">{l.label}</span>
                <span
                  aria-hidden
                  className="absolute -bottom-1 left-1/2 h-[2px] w-0 -translate-x-1/2 transition-all duration-300 group-hover:w-full"
                  style={{ background: 'linear-gradient(90deg, #7C3AED, #EC4899)' }}
                />
              </button>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <button
              data-cursor="button"
              onClick={() => navigate('/login')}
              className="h-10 px-5 rounded-full font-medium text-sm transition-colors"
              style={{
                color: scrolled ? '#7C3AED' : '#FFFFFF',
              }}
            >
              התחברות
            </button>
            <MagneticButton
              onClick={() => navigate('/onboarding/credentials')}
              className="h-10 px-5 rounded-full font-semibold text-sm text-white"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)', color: '#FFFFFF' }}
            >
              הרשמה
            </MagneticButton>
          </div>

          <button
            data-cursor="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'סגור תפריט' : 'פתח תפריט'}
            className="lg:hidden relative w-8 h-8 flex items-center justify-center"
          >
            <motion.span
              className="absolute block w-6 h-[2px] rounded-full"
              style={{ background: scrolled ? '#7C3AED' : '#FFFFFF' }}
              animate={menuOpen ? { rotate: 45, y: 0 } : { rotate: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            />
            <motion.span
              className="absolute block w-6 h-[2px] rounded-full"
              style={{ background: scrolled ? '#7C3AED' : '#FFFFFF' }}
              animate={menuOpen ? { scaleX: 0, opacity: 0 } : { scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
            <motion.span
              className="absolute block w-6 h-[2px] rounded-full"
              style={{ background: scrolled ? '#7C3AED' : '#FFFFFF' }}
              animate={menuOpen ? { rotate: -45, y: 0 } : { rotate: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            />
          </button>
        </div>
      </motion.header>

      <MobileMenuOverlay isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}