import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DISCOUNT_TIERS,
  PROFILE_COMPLETION_BONUS,
  REFERRAL_SIGNUP_POINTS,
  TENURE_POINTS_PER_30_DAYS,
} from '@/config/points';
import { invokeAwardTenurePoints, getPointsHistory } from '@/services/points';

const tierBadge: Record<string, string> = {
  new: 'חבר/ה חדש/ה',
  veteran: 'ותיק/ה',
  ambassador: 'שגריר/ה',
};

function MilestoneBar({
  label,
  current,
  target,
}: {
  label: string;
  current: number;
  target: number;
}) {
  const pct = target <= 0 ? 100 : Math.min(100, Math.round((current / target) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="text-foreground font-medium tabular-nums">
          {current} / {target}
        </span>
      </div>
      <div className="h-2 rounded-full bg-primary/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, hsl(263 84% 55%), hsl(258 95% 76%))' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export default function PointsCard({
  userId,
  status,
  points,
  onRefreshStats,
}: {
  userId: string;
  status: string;
  points: number;
  onRefreshStats: () => Promise<void>;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [earnOpen, setEarnOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState<Awaited<ReturnType<typeof getPointsHistory>>>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await invokeAwardTenurePoints();
        if (!cancelled) await onRefreshStats();
      } catch (e) {
        console.warn('award-tenure-points', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, onRefreshStats]);

  useEffect(() => {
    if (!historyOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await getPointsHistory(userId, 15);
        if (!cancelled) setHistoryRows(rows);
      } catch (e) {
        console.warn('getPointsHistory', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [historyOpen, userId]);

  const nextDiscount = useMemo(
    () => DISCOUNT_TIERS.find((t) => points < t.points),
    [points],
  );

  const milestoneTarget = nextDiscount?.points ?? DISCOUNT_TIERS[DISCOUNT_TIERS.length - 1].points;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">הנקודות שלך</p>
          <motion.span
            className="inline-block text-5xl font-black tracking-tight bg-gradient-to-br from-primary via-accent to-primary bg-clip-text text-transparent"
            initial={{ opacity: 0.88 }}
            animate={{ opacity: [0.88, 1, 0.88] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {points.toLocaleString('he-IL')}
          </motion.span>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/15 text-primary whitespace-nowrap">
          {tierBadge[status] ?? tierBadge.new}
        </span>
      </div>

      <MilestoneBar
        label={nextDiscount ? `אבן דרך הבאה — ₪${nextDiscount.ils_off} הנחה` : 'כל אבני הדרך נפתחו 🎉'}
        current={points}
        target={milestoneTarget}
      />

      <Collapsible open={earnOpen} onOpenChange={setEarnOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-primary w-full py-1">
          <Sparkles size={16} />
          איך מרוויחים נקודות?
          {earnOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          <div className="rounded-xl bg-muted/40 border border-border/40 p-3 text-sm">
            <p className="font-semibold text-foreground mb-1">ותק חברות פעילה</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              +{TENURE_POINTS_PER_30_DAYS} נקודות על כל 30 יום רצופים במנוי פעיל (מחושב אוטומטית כשנכנסים לכאן).
            </p>
          </div>
          <div className="rounded-xl bg-muted/40 border border-border/40 p-3 text-sm">
            <p className="font-semibold text-foreground mb-1">הזמנת חברים</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              +{REFERRAL_SIGNUP_POINTS} נקודות על חבר שמצטרף דרך הקישור האישי שלך (עד תקרת ההזמנות החודשית).
            </p>
          </div>
          <div className="rounded-xl bg-muted/40 border border-border/40 p-3 text-sm">
            <p className="font-semibold text-foreground mb-1">השלמת פרופיל</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              חד־פעמי: +{PROFILE_COMPLETION_BONUS} נקודות אחרי סיום ההרשמה.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground w-full py-1">
          פירוט אחרון מהלוח
          {historyOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-2 max-h-48 overflow-y-auto">
          {historyRows.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">עדיין אין תנועות.</p>
          ) : (
            historyRows.map((row) => (
              <div
                key={row.id}
                className="flex justify-between gap-2 text-[11px] border-b border-border/30 pb-1 last:border-0"
              >
                <span className="text-muted-foreground truncate">{row.description || row.type}</span>
                <span className={`tabular-nums shrink-0 ${row.amount >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {row.amount >= 0 ? '+' : ''}
                  {row.amount}
                </span>
              </div>
            ))
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
