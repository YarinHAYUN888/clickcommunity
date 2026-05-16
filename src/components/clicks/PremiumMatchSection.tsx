import { motion } from 'framer-motion';
import { springs } from '@/lib/motion';
import type { CompatibilityHighlights } from '@/services/matching';

interface PremiumMatchSectionProps {
  compatibilityReason: string | null;
  aiSummary: string | null;
  highlights: CompatibilityHighlights | null;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-[11px] font-medium text-foreground/90 backdrop-blur-sm">
      {children}
    </span>
  );
}

export default function PremiumMatchSection({
  compatibilityReason,
  aiSummary,
  highlights,
}: PremiumMatchSectionProps) {
  const hasPremium = !!(compatibilityReason || aiSummary || highlights?.other_energy_type);
  if (!hasPremium) return null;

  const lines = (compatibilityReason || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.gentle}
      className="rounded-2xl border border-white/10 bg-gradient-to-br from-primary/[0.08] via-card/80 to-accent/[0.06] p-4 shadow-[0_12px_40px_rgba(124,58,237,0.12)] backdrop-blur-md space-y-4"
    >
      <p className="text-center text-xs font-semibold text-primary tracking-wide">התאמה חכמה</p>

      {lines.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">למה התאמה</p>
          <ul className="space-y-1 text-[13px] leading-snug text-muted-foreground">
            {lines.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="text-primary shrink-0">✦</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(highlights?.other_energy_type || highlights?.other_lifestyle || highlights?.other_communication) && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">אותות אישיות</p>
          <div className="flex flex-wrap gap-1.5">
            {highlights.other_energy_type && <Chip>אנרגיה: {highlights.other_energy_type}</Chip>}
            {highlights.other_lifestyle && <Chip>לייף: {highlights.other_lifestyle}</Chip>}
            {highlights.other_communication && <Chip>תקשורת: {highlights.other_communication}</Chip>}
          </div>
        </div>
      )}

      {aiSummary && (
        <div className="rounded-xl bg-background/40 border border-border/40 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-muted-foreground mb-1">סיכום AI</p>
          <p className="text-[12px] leading-relaxed text-foreground/90">{aiSummary}</p>
        </div>
      )}
    </motion.div>
  );
}
