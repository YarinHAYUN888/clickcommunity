import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';

export interface HaydevPoweredCardProps {
  logo: ReactNode;
  title: string;
  subtitle?: string;
  buttonText: string;
  whatsappLink: string;
  /** `landing` — dark hero/footer context; `in-app` — subscription & themed pages */
  variant?: 'landing' | 'in-app';
  className?: string;
}

export default function HaydevPoweredCard({
  logo,
  title,
  subtitle,
  buttonText,
  whatsappLink,
  variant = 'in-app',
  className,
}: HaydevPoweredCardProps) {
  const isLanding = variant === 'landing';

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={springs.gentle}
      className={cn(
        'rounded-3xl border text-center',
        'p-6 sm:p-8 md:p-10',
        isLanding
          ? 'border-white/10 bg-white/[0.06] shadow-[0_12px_48px_rgba(124,58,237,0.18)] backdrop-blur-xl'
          : 'glass-premium border-primary/20 shadow-[0_12px_40px_rgba(124,58,237,0.12)] bg-card/60 backdrop-blur-md',
        className,
      )}
      dir="rtl"
    >
      <div className="flex flex-col items-center gap-4 sm:gap-5 max-w-md mx-auto">
        <div className="flex justify-center">{logo}</div>

        <div className="space-y-2">
          <h3
            className={cn(
              'text-base sm:text-lg font-bold leading-snug',
              isLanding ? 'text-white' : 'text-foreground',
            )}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              className={cn(
                'text-sm sm:text-[15px] leading-relaxed',
                isLanding ? 'text-white/65' : 'text-muted-foreground',
              )}
            >
              {subtitle}
            </p>
          )}
        </div>

        <motion.a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.98 }}
          transition={springs.snappy}
          className={cn(
            'inline-flex items-center justify-center gap-2',
            'min-h-12 px-6 sm:px-8 rounded-full font-semibold text-sm sm:text-base',
            'gradient-primary text-primary-foreground',
            'shadow-[0_8px_24px_rgba(124,58,237,0.35)]',
            'transition-shadow hover:shadow-[0_12px_32px_rgba(124,58,237,0.45)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            isLanding && 'focus-visible:ring-offset-[#08080F]',
          )}
        >
          {buttonText}
        </motion.a>
      </div>
    </motion.article>
  );
}
