import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, MapPin, CalendarDays, Clock, Users } from 'lucide-react';
import { SpinnerOverlay } from '@/components/ui/luma-spin';
import PremiumButton from '@/components/ui/PremiumButton';
import { PremiumDatePicker, PremiumTimePicker } from '@/components/admin/PremiumDateTimePickers';
import { createMemberEvent } from '@/services/events';
import { MEMBER_EVENT_MIN_POINTS } from '@/config/points';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';

export default function MemberEventFormPage() {
  const navigate = useNavigate();
  const { profile, authId, role, loading: userLoading } = useCurrentUser();
  const points = (profile as { points?: number | null } | null)?.points ?? 0;
  const canCreate = role === 'member' && points >= MEMBER_EVENT_MIN_POINTS;

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    date: '',
    time: '',
    location_name: '',
    location_address: '',
    description: '',
    max_capacity: 15,
    reserved_new_spots: 0,
  });

  useEffect(() => {
    if (userLoading) return;
    if (!authId || role !== 'member') {
      navigate('/events', { replace: true });
      return;
    }
    if (points < MEMBER_EVENT_MIN_POINTS) {
      navigate('/events', { replace: true });
    }
  }, [userLoading, authId, role, points, navigate]);

  const toOptional = (value: string) => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const date = form.date.trim();
    const time = form.time.trim();
    const locationName = form.location_name.trim();
    if (!name || !date || !time || !locationName) {
      toast.error('יש למלא שם, תאריך, שעה ומיקום');
      return;
    }
    if (!canCreate) {
      toast.error(`נדרשות לפחות ${MEMBER_EVENT_MIN_POINTS} נקודות ליצירת אירוע`);
      return;
    }

    setSaving(true);
    try {
      const maxCapacity = Math.min(30, Math.max(5, Math.round(form.max_capacity) || 15));
      const reservedNewSpots = Math.min(5, Math.max(0, Math.round(form.reserved_new_spots) || 0));
      const event = await createMemberEvent({
        name,
        date,
        time,
        location_name: locationName,
        location_address: toOptional(form.location_address),
        description: toOptional(form.description),
        max_capacity: maxCapacity,
        reserved_new_spots: reservedNewSpots,
      });
      toast.success('האירוע נוצר!');
      navigate(`/events/${event.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'יצירת אירוע נכשלה');
    } finally {
      setSaving(false);
    }
  };

  if (userLoading || !canCreate) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const inputClass =
    'w-full rounded-2xl border border-border/60 bg-white/80 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50';

  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-40 glass-strong px-4 pt-[env(safe-area-inset-top)] pb-3 border-b border-border/30">
        <div className="flex items-center gap-2 pt-4">
          <button type="button" onClick={() => navigate('/events')} className="p-1">
            <ArrowRight size={20} />
          </button>
          <h1 className="text-xl text-h1-premium text-foreground">יצירת אירוע</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-2 px-1">
          אירוע פרטי עם עד {form.max_capacity} משתתפים · פתוח לקהילה
        </p>
      </div>

      <div className="px-4 py-6 max-w-[640px] mx-auto space-y-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">שם האירוע</span>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="לדוגמה: ערב קליקים בתל אביב"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground flex items-center gap-1">
              <CalendarDays size={14} /> תאריך
            </span>
            <PremiumDatePicker
              value={form.date}
              onChange={(date) => setForm((f) => ({ ...f, date }))}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground flex items-center gap-1">
              <Clock size={14} /> שעה
            </span>
            <PremiumTimePicker
              value={form.time}
              onChange={(time) => setForm((f) => ({ ...f, time }))}
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground flex items-center gap-1">
            <MapPin size={14} /> מיקום
          </span>
          <input
            className={inputClass}
            value={form.location_name}
            onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))}
            placeholder="שם המקום"
          />
          <input
            className={inputClass}
            value={form.location_address}
            onChange={(e) => setForm((f) => ({ ...f, location_address: e.target.value }))}
            placeholder="כתובת (אופציונלי)"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">תיאור</span>
          <textarea
            className={`${inputClass} min-h-[100px] resize-none`}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="מה מחכה למשתתפים?"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground flex items-center gap-1">
            <Users size={14} /> מקסימום משתתפים (5–30)
          </span>
          <input
            type="number"
            min={5}
            max={30}
            className={inputClass}
            value={form.max_capacity}
            onChange={(e) => setForm((f) => ({ ...f, max_capacity: Number(e.target.value) }))}
          />
        </label>

        <PremiumButton
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="w-full"
        >
          {saving ? 'יוצר אירוע…' : 'פרסום האירוע'}
        </PremiumButton>
      </div>

      {saving && <SpinnerOverlay />}
    </div>
  );
}
