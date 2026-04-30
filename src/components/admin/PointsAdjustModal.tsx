import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { performAdminAction } from '@/services/admin';
import { toast } from 'sonner';

export default function PointsAdjustModal({
  open,
  onOpenChange,
  userId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const n = Number(amount);
    if (!userId || !Number.isFinite(n) || n === 0) {
      toast.error('הזן/י סכום חוקי (לא אפס)');
      return;
    }
    setLoading(true);
    try {
      await performAdminAction('adjust_user_points', 'user', userId, {
        amount: Math.trunc(n),
        reason: reason.trim() || 'התאמה ידנית',
      });
      toast.success('הנקודות עודכנו');
      onOpenChange(false);
      setAmount('');
      setReason('');
      onDone();
    } catch {
      toast.error('שגיאה בעדכון הנקודות');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>התאמת נקודות</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <label className="text-xs text-muted-foreground">סכום (+ או −)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full h-11 rounded-xl border bg-background px-3 text-sm"
            placeholder="למשל 50 או -20"
          />
          <label className="text-xs text-muted-foreground">סיבה</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full min-h-[72px] rounded-xl border bg-background px-3 py-2 text-sm resize-none"
            placeholder="תיאור קצר ללוח הנקודות"
          />
        </div>
        <DialogFooter className="gap-2 sm:justify-start flex-row-reverse">
          <button
            type="button"
            disabled={loading}
            onClick={submit}
            className="h-11 px-5 rounded-xl gradient-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin w-4 h-4" /> : null}
            שמור
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-11 px-5 rounded-xl border border-border text-sm font-medium"
          >
            ביטול
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
