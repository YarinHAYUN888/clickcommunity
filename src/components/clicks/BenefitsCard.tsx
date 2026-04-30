import { Lock, Unlock } from 'lucide-react';
import GlassCard from '@/components/clicks/GlassCard';
import { DISCOUNT_TIERS } from '@/config/points';

export default function BenefitsCard({ points }: { points: number }) {
  return (
    <GlassCard variant="strong" className="p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-1">הטבות הנחה</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          הנקודות פותחות שער לפיצוי הנחה בעתיד — השלב הבא יחובר למערכת התשלום.
        </p>
      </div>
      <ul className="space-y-3">
        {DISCOUNT_TIERS.map((tier) => {
          const unlocked = points >= tier.points;
          return (
            <li
              key={tier.points}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                unlocked ? 'border-success/30 bg-success/5' : 'border-border/50 bg-muted/20 opacity-70'
              }`}
            >
              {unlocked ? (
                <Unlock size={18} className="text-success shrink-0" />
              ) : (
                <Lock size={18} className="text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">
                  ₪{tier.ils_off} הנחה
                  {!unlocked && (
                    <span className="text-muted-foreground font-normal text-xs mr-2">
                      ({tier.points.toLocaleString('he-IL')} נק׳)
                    </span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-center text-[11px] text-muted-foreground pt-1 border-t border-border/40">
        הטבות נוספות בקרוב
      </p>
    </GlassCard>
  );
}
