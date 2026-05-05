import { useEffect, useRef, useState, type DragEvent, type ChangeEvent, type ComponentType, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight, Loader2, ImagePlus, RefreshCw, Trash2,
  CalendarDays, Clock, MapPin, Building2, Link as LinkIcon, FileText,
  Users, UserPlus, Scale, Sparkles, Type as TypeIcon,
} from 'lucide-react';
import { SpinnerOverlay } from '@/components/ui/luma-spin';
import PremiumButton from '@/components/ui/PremiumButton';
import { PremiumDatePicker, PremiumTimePicker } from '@/components/admin/PremiumDateTimePickers';
import { useAdmin } from '@/contexts/AdminContext';
import { performAdminAction, uploadEventCover } from '@/services/admin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MAX_COVER_SIZE = 5 * 1024 * 1024;

/* -------------------- CoverImageDropzone -------------------- */

interface CoverImageDropzoneProps {
  currentUrl: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
}

function CoverImageDropzone({ currentUrl, file, onFileChange }: CoverImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragDepth, setDragDepth] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [file]);

  const displayUrl = previewUrl || currentUrl;
  const hasImage = !!displayUrl;
  const isDragging = dragDepth > 0;

  const validateAndSet = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast.error('יש לבחור קובץ תמונה');
      return;
    }
    if (f.size > MAX_COVER_SIZE) {
      toast.error('הקובץ גדול מ־5MB');
      return;
    }
    onFileChange(f);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragDepth(0);
    const f = e.dataTransfer.files?.[0];
    if (f) validateAndSet(f);
  };

  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragDepth((d) => d + 1);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragDepth((d) => Math.max(0, d - 1));
  };

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    validateAndSet(e.target.files?.[0] || null);
  };

  const onRemove = () => {
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onPickFile}
        className="hidden"
      />

      {hasImage ? (
        <div
          className="group relative overflow-hidden rounded-3xl"
          style={{
            aspectRatio: '16/9',
            boxShadow: '0 12px 40px rgba(124,58,237,0.22), 0 4px 12px rgba(124,58,237,0.10)',
          }}
        >
          <img
            src={displayUrl}
            alt="תמונת כיסוי"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ background: 'linear-gradient(180deg, rgba(15,15,26,0) 30%, rgba(15,15,26,0.55) 100%)' }}
          />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-medium text-white transition-colors"
              style={{
                background: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.3)',
              }}
            >
              <RefreshCw size={14} />
              החלף
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-medium text-white transition-colors"
              style={{
                background: 'rgba(220,38,38,0.55)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.3)',
              }}
            >
              <Trash2 size={14} />
              הסר
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDrop={onDrop}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          aria-label="העלה תמונת כיסוי"
          className="block w-full cursor-pointer transition-all duration-200 focus:outline-none"
          style={{
            aspectRatio: '16/9',
            borderRadius: '24px',
            border: isDragging ? '2px dashed #7C3AED' : '2px dashed rgba(124,58,237,0.32)',
            background: isDragging
              ? 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(236,72,153,0.06))'
              : 'linear-gradient(135deg, rgba(124,58,237,0.04), rgba(167,139,250,0.04))',
            transform: isDragging ? 'scale(1.005)' : 'scale(1)',
            boxShadow: isDragging
              ? '0 0 0 4px rgba(124,58,237,0.10), 0 12px 32px rgba(124,58,237,0.12)'
              : '0 1px 2px rgba(124,58,237,0.04)',
          }}
        >
          <div className="pointer-events-none h-full w-full flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
                boxShadow: '0 8px 24px rgba(124,58,237,0.32)',
              }}
            >
              <ImagePlus size={26} className="text-white" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">
                גרור תמונת כיסוי לכאן
              </p>
              <p className="text-sm text-muted-foreground">
                או לחץ לבחירה — JPG / PNG / WEBP עד 5MB
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------- FieldRow -------------------- */

interface FieldRowProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: ReactNode;
}

function FieldRow({ icon: Icon, label, required, children, hint }: FieldRowProps) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Icon size={14} className="text-primary" />
        <span>
          {label}
          {required && <span className="text-primary"> *</span>}
        </span>
      </label>
      {children}
      {hint}
    </div>
  );
}

/* -------------------- Page -------------------- */

export default function AdminEventFormPage() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const isEdit = !!eventId;
  const { isSuperUser, loading: adminLoading } = useAdmin();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  const [form, setForm] = useState({
    name: '', date: '', time: '', location_name: '', location_address: '', location_url: '',
    description: '', max_capacity: 40, reserved_new_spots: 10, gender_balance_target: 0.5,
    cover_image_url: '',
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const toOptional = (value: string) => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  useEffect(() => {
    if (adminLoading) return;
    if (!isSuperUser) { navigate('/clicks', { replace: true }); return; }
    if (isEdit) {
      supabase.from('events').select('*').eq('id', eventId).single().then(({ data }) => {
        if (data) setForm({
          name: data.name || '', date: data.date || '', time: data.time || '',
          location_name: data.location_name || '', location_address: data.location_address || '',
          location_url: data.location_url || '', description: data.description || '',
          max_capacity: data.max_capacity || 40, reserved_new_spots: data.reserved_new_spots || 10,
          gender_balance_target: Number(data.gender_balance_target) || 0.5, cover_image_url: data.cover_image_url || '',
        });
        setLoading(false);
      });
    }
  }, [adminLoading, isSuperUser, eventId, navigate, isEdit]);

  const handleSave = async () => {
    const name = form.name.trim();
    const date = form.date.trim();
    const time = form.time.trim();
    const locationName = form.location_name.trim();
    if (!name || !date || !time || !locationName) {
      toast.error('יש למלא את כל השדות הנדרשים');
      return;
    }
    setSaving(true);
    try {
      let cover_image_url = form.cover_image_url;
      const tempId = eventId || crypto.randomUUID();
      if (coverFile) {
        cover_image_url = await uploadEventCover(tempId, coverFile);
      }

      const maxCapacity = Number.isFinite(form.max_capacity) ? Math.max(5, Math.round(form.max_capacity)) : 40;
      const reservedNewSpots = Number.isFinite(form.reserved_new_spots)
        ? Math.min(Math.max(0, Math.round(form.reserved_new_spots)), maxCapacity)
        : 0;
      const genderBalanceTarget = Number.isFinite(form.gender_balance_target)
        ? Math.min(1, Math.max(0, form.gender_balance_target))
        : 0.5;

      const eventData = {
        name,
        date,
        time,
        location_name: locationName,
        location_address: toOptional(form.location_address),
        location_url: toOptional(form.location_url),
        description: toOptional(form.description),
        max_capacity: maxCapacity,
        reserved_new_spots: reservedNewSpots,
        gender_balance_target: genderBalanceTarget,
        cover_image_url: toOptional(cover_image_url),
      };
      if (isEdit) {
        await performAdminAction('update_event', 'event', eventId, eventData);
        toast.success('האירוע עודכן!');
        navigate(`/admin/events/${eventId}`);
      } else {
        const result = await performAdminAction('create_event', 'event', undefined, eventData);
        toast.success('האירוע פורסם!');
        navigate(`/admin/events/${result.event?.id || ''}`);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message?: unknown }).message)
            : 'שגיאה בשמירה';
      toast.error(message || 'שגיאה בשמירה');
    }
    setSaving(false);
  };

  if (adminLoading || loading) return <SpinnerOverlay />;

  const inputCls =
    "w-full h-12 rounded-2xl bg-white/70 backdrop-blur-sm border border-primary/15 px-4 text-sm text-foreground " +
    "placeholder:text-foreground/40 transition " +
    "hover:border-primary/30 hover:bg-white/85 " +
    "focus:outline-none focus:border-primary/50 focus:bg-white/95 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.18)]";

  const textareaCls =
    "w-full rounded-2xl bg-white/70 backdrop-blur-sm border border-primary/15 px-4 py-3 text-sm text-foreground " +
    "placeholder:text-foreground/40 transition resize-none " +
    "hover:border-primary/30 hover:bg-white/85 " +
    "focus:outline-none focus:border-primary/50 focus:bg-white/95 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.18)]";

  return (
    <div className="min-h-screen gradient-bg pb-32">
      <div className="px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 pt-4 mb-5 max-w-2xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            aria-label="חזור"
            className="w-10 h-10 rounded-full flex items-center justify-center text-primary transition-colors hover:bg-primary/10"
          >
            <ArrowRight size={22} />
          </button>
          <h1 className="text-xl font-bold text-foreground">
            {isEdit ? 'עריכת אירוע' : 'אירוע חדש'}
          </h1>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="glass-premium rounded-[28px] p-5 sm:p-7 space-y-6">
            {/* Title strip */}
            <div className="space-y-2">
              <div
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full"
                style={{ background: 'rgba(124,58,237,0.10)', color: '#7C3AED' }}
              >
                <Sparkles size={12} />
                {isEdit ? 'עריכה' : 'יצירה'}
              </div>
              <h2 className="text-[26px] sm:text-[32px] font-extrabold leading-tight text-gradient-premium">
                {isEdit ? 'עריכת האירוע' : 'יצירת אירוע חדש'}
              </h2>
              <p className="text-sm text-muted-foreground">
                מלאו את הפרטים. שדות עם <span className="text-primary font-semibold">*</span> הם חובה.
              </p>
            </div>

            <hr className="divider-fade" />

            {/* Section: basics */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
                פרטים בסיסיים
              </h3>

              <FieldRow icon={ImagePlus} label="תמונת כיסוי">
                <CoverImageDropzone
                  currentUrl={form.cover_image_url}
                  file={coverFile}
                  onFileChange={setCoverFile}
                />
              </FieldRow>

              <FieldRow icon={TypeIcon} label="שם האירוע" required>
                <input
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="שם האירוע"
                  className={inputCls}
                />
              </FieldRow>

              <div className="grid grid-cols-2 gap-3">
                <FieldRow icon={CalendarDays} label="תאריך" required>
                  <PremiumDatePicker
                    value={form.date}
                    onChange={(v) => setForm(f => ({ ...f, date: v }))}
                  />
                </FieldRow>
                <FieldRow icon={Clock} label="שעה" required>
                  <PremiumTimePicker
                    value={form.time}
                    onChange={(v) => setForm(f => ({ ...f, time: v }))}
                  />
                </FieldRow>
              </div>
            </div>

            <hr className="divider-fade" />

            {/* Section: location */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
                מיקום
              </h3>

              <FieldRow icon={Building2} label="שם המקום" required>
                <input
                  value={form.location_name}
                  onChange={(e) => setForm(f => ({ ...f, location_name: e.target.value }))}
                  placeholder="Joya TLV"
                  className={inputCls}
                />
              </FieldRow>

              <FieldRow icon={MapPin} label="כתובת">
                <input
                  value={form.location_address}
                  onChange={(e) => setForm(f => ({ ...f, location_address: e.target.value }))}
                  placeholder="דיזנגוף 99, תל אביב"
                  className={inputCls}
                />
              </FieldRow>

              <FieldRow icon={LinkIcon} label="קישור למפות">
                <input
                  value={form.location_url}
                  onChange={(e) => setForm(f => ({ ...f, location_url: e.target.value }))}
                  placeholder="https://maps.google.com/..."
                  className={inputCls}
                  dir="ltr"
                />
              </FieldRow>
            </div>

            <hr className="divider-fade" />

            {/* Section: description */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
                תיאור
              </h3>

              <FieldRow
                icon={FileText}
                label="תיאור האירוע"
                hint={
                  <p className="text-xs text-muted-foreground text-left mt-1.5">
                    {form.description.length}/1000
                  </p>
                }
              >
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value.slice(0, 1000) }))}
                  placeholder="ספרו על האירוע..."
                  rows={4}
                  className={textareaCls}
                />
              </FieldRow>
            </div>

            <hr className="divider-fade" />

            {/* Section: capacity / balance */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
                מקומות ואיזון
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <FieldRow icon={Users} label="מקומות">
                  <input
                    type="number"
                    min={5}
                    max={200}
                    value={form.max_capacity}
                    onChange={(e) => setForm(f => ({ ...f, max_capacity: Number(e.target.value) }))}
                    className={inputCls}
                  />
                </FieldRow>
                <FieldRow icon={UserPlus} label="שמורים לחדשים">
                  <input
                    type="number"
                    min={0}
                    value={form.reserved_new_spots}
                    onChange={(e) => setForm(f => ({ ...f, reserved_new_spots: Number(e.target.value) }))}
                    className={inputCls}
                  />
                </FieldRow>
              </div>

              <FieldRow icon={Scale} label={`מאזן מגדרי: ${Math.round(form.gender_balance_target * 100)}% נשים`}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={form.gender_balance_target}
                  onChange={(e) => setForm(f => ({ ...f, gender_balance_target: Number(e.target.value) }))}
                  className="w-full accent-primary"
                />
              </FieldRow>
            </div>

            <hr className="divider-fade" />

            {/* Submit */}
            <PremiumButton
              tier="primary"
              onClick={handleSave}
              disabled={saving}
              className="w-full h-14 text-base rounded-2xl"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  שומר...
                </>
              ) : (
                isEdit ? 'שמור שינויים' : 'פרסם אירוע'
              )}
            </PremiumButton>
          </div>
        </div>
      </div>
    </div>
  );
}
