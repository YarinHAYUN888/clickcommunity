import { motion } from 'framer-motion';
import { Instagram } from 'lucide-react';
import RevealOnScroll from './RevealOnScroll';

// TikTok inline svg (lucide doesn't ship one consistently)
const TikTokIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.69a8.16 8.16 0 0 0 4.77 1.52V6.81a4.85 4.85 0 0 1-1.84-.12z"/>
  </svg>
);

const SOCIALS = [
  {
    name: 'Instagram',
    url: 'https://www.instagram.com/click_communityy?igsh=d2RpbDJmbm1zMzB6&utm_source=qr',
    hover: 'linear-gradient(135deg, #833AB4, #FD1D1D, #FCB045)',
  },
  {
    name: 'TikTok',
    url: 'https://www.tiktok.com/@click_community_?_r=1&_t=ZS-95tZ0lTbzzJ',
    hover: 'linear-gradient(135deg, #25F4EE, #000000, #FE2C55)',
  },
];

export default function SocialSection() {
  return (
    <section
      id="social"
      className="relative scroll-mt-[72px] py-[100px] px-6"
      style={{ background: 'linear-gradient(180deg, #0F0F1A 0%, #08080F 100%)' }}
    >
      <div className="max-w-[900px] mx-auto text-center">
        <RevealOnScroll>
          <h2
            className="font-bold text-[36px] md:text-[48px]"
            style={{ color: '#FFFFFF' }}
          >
            חפשו אותנו
          </h2>
          <p
            className="mt-3 text-[17px] md:text-[19px]"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            עקבו, שתפו, הצטרפו
          </p>
        </RevealOnScroll>

        <RevealOnScroll delay={0.15}>
          <div className="mt-10 flex items-center justify-center gap-5">
            {SOCIALS.map((s) => (
              <motion.a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                data-cursor="button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="group relative flex items-center justify-center transition-all overflow-hidden"
                style={{
                  width: 64, height: 64, borderRadius: 999,
                  background: 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#FFFFFF',
                }}
              >
                <span
                  aria-hidden
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: s.hover }}
                />
                <span className="relative" style={{ color: '#FFFFFF' }}>
                  {s.name === 'Instagram' && <Instagram size={28} />}
                  {s.name === 'TikTok' && <TikTokIcon />}
                </span>
              </motion.a>
            ))}
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}