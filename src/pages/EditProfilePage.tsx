import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, useMemo } from 'react';
import { ArrowRight, Loader2, Camera, X, Briefcase, User } from 'lucide-react';
import { SpinnerOverlay } from '@/components/ui/luma-spin';
import GlassCard from '@/components/clicks/GlassCard';
import InterestPill from '@/components/clicks/InterestPill';
import { supabase } from '@/integrations/supabase/client';
import { getMyProfile, updateProfile, uploadProfilePhoto, deleteProfilePhoto } from '@/services/profile';
import { allInterests } from '@/data/demo';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function EditProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authId, setAuthId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadSlot, setUploadSlot] = useState(0);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [bio, setBio] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');

  // Original values for dirty check
  const [original, setOriginal] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate('/welcome'); return; }
      setAuthId(session.user.id);
      try {
        const p = await getMyProfile(session.user.id);
        setFirstName(p.first_name || '');
        setOccupation(p.occupation || '');
        setBio(p.bio || '');
        setPhotos(p.photos || []);
        setInterests(p.interests || []);
        setDob(p.date_of_birth || '');
        setGender(p.gender || '');
        setOriginal({
          first_name: p.first_name || '',
          occupation: p.occupation || '',
          bio: p.bio || '',
          photos: p.photos || [],
          interests: p.interests || [],
        });
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [navigate]);

  const isDirty = useMemo(() => {
    if (!original) return false;
    return (
      firstName !== original.first_name ||
      occupation !== original.occupation ||
      bio !== original.bio ||
      JSON.stringify(photos) !== JSON.stringify(original.photos) ||
      JSON.stringify(interests) !== JSON.stringify(original.interests)
    );
  }, [firstName, occupation, bio, photos, interests, original]);

  const age = dob
    ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000)
    : null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadProfilePhoto(authId, file, uploadSlot);
      setPhotos(prev => {
        const next = [...prev];
        if (uploadSlot < next.length) next[uploadSlot] = url;
        else next.push(url);
        return next;
      });
    } catch (err: any) {
      toast.error('שגיאה בהעלאת תמונה');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePhoto = async (idx: number) => {
    const url = photos[idx];
    try {
      await deleteProfilePhoto(url);
    } catch {}
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleInterest = (label: string) => {
    setInterests(prev =>
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  const handleSave = async () => {
    if (!isDirty || saving) return;
    if (firstName.length < 2) { toast.error('נא להזין שם (לפחות 2 תווים)'); return; }
    if (interests.length > 0 && interests.length < 5) { toast.error('יש לבחור לפחות 5 תחומי עניין'); return; }

    setSaving(true);
    try {
      await updateProfile(authId, {
        first_name: firstName,
        occupation,
        bio,
        photos,
        interests,
      });
      toast.success('הפרופיל עודכן!');
      navigate('/profile');
    } catch (e: any) {
      toast.error('שגיאה בעדכון הפרופיל');
    }
    setSaving(false);
  };

  if (loading) {
    return <SpinnerOverlay />;
  }

  return (
    <motion.div
      initial={{ x: -50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="min-h-screen gradient-bg pb-32"
    >
      {/* Header */}
      <div className="sticky top-0 z-30 glass-strong px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between h-14">
          <button onClick={() => navigate('/profile')} className="p-2">
            <ArrowRight size={22} className="text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">עריכת פרופיל</h1>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className={`text-sm font-semibold ${isDirty ? 'text-primary' : 'text-muted-foreground opacity-50'}`}
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : 'שמור'}
          </button>
        </div>
      </div>

      {/* Live Preview */}
      <div className="px-4 mt-4">
        <GlassCard variant="strong" className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-muted overflow-hidden flex-shrink-0">
              {photos[0] ? (
                <img src={photos[0]} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><User size={24} className="text-muted-foreground" /></div>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-foreground text-base truncate">
                {firstName || 'השם שלך'}{age ? `, ${age}` : ''}
              </p>
              <p className="text-sm text-muted-foreground truncate">{occupation || 'מה את/ה עושה?'}</p>
              {interests.length > 0 && (
                <div className="flex gap-1 mt-1 overflow-hidden">
                  {interests.slice(0, 3).map(i => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{i}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="px-4 mt-6 space-y-6">
        {/* Photos Grid */}
        <div>
          <label className="text-sm font-semibold text-foreground mb-2 block">תמונות</label>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="relative aspect-[3/4] rounded-xl bg-muted overflow-hidden border border-border">
                {photos[idx] ? (
                  <>
                    <img src={photos[idx]} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center"
                    >
                      <X size={12} className="text-white" />
                    </button>
                    {idx === 0 && (
                      <span className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">
                        ראשית
                      </span>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => { setUploadSlot(idx); fileInputRef.current?.click(); }}
                    className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground"
                  >
                    <Camera size={20} />
                    <span className="text-[10px]">הוסף</span>
                  </button>
                )}
              </div>
            ))}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        </div>

        {/* First Name */}
        <div>
          <label className="text-sm font-semibold text-foreground mb-1.5 block">שם פרטי</label>
          <input
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            className="w-full h-11 rounded-xl bg-muted px-4 text-sm text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            placeholder="השם שלך"
          />
          {firstName.length > 0 && firstName.length < 2 && (
            <p className="text-xs text-destructive mt-1">נא להזין שם (לפחות 2 תווים)</p>
          )}
        </div>

        {/* DOB - Locked */}
        <div className="opacity-60">
          <label className="text-sm font-semibold text-foreground mb-1.5 block">תאריך לידה</label>
          <input
            value={dob ? new Date(dob).toLocaleDateString('he-IL') : ''}
            disabled
            className="w-full h-11 rounded-xl bg-muted px-4 text-sm text-muted-foreground border border-border cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground mt-1">תאריך הלידה לא ניתן לשינוי</p>
        </div>

        {/* Gender - Locked */}
        <div className="opacity-60">
          <label className="text-sm font-semibold text-foreground mb-1.5 block">מגדר</label>
          <div className="flex gap-2">
            {[{ v: 'male', l: 'גבר' }, { v: 'female', l: 'אישה' }, { v: 'other', l: 'אחר' }].map(g => (
              <span
                key={g.v}
                className={`px-4 py-2 rounded-full text-sm font-medium ${gender === g.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} cursor-not-allowed`}
              >
                {g.l}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">המגדר לא ניתן לשינוי</p>
        </div>

        {/* Occupation */}
        <div>
          <label className="text-sm font-semibold text-foreground mb-1.5 block">מקצוע</label>
          <div className="relative">
            <Briefcase size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={occupation}
              onChange={e => setOccupation(e.target.value)}
              className="w-full h-11 rounded-xl bg-muted pr-10 pl-4 text-sm text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              placeholder="מה את/ה עושה?"
            />
          </div>
        </div>

        {/* Bio */}
        <div>
          <label className="text-sm font-semibold text-foreground mb-1.5 block">קצת עליי</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, 300))}
            rows={4}
            className="w-full rounded-xl bg-muted px-4 py-3 text-sm text-foreground border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
            placeholder="ספר/י קצת על עצמך..."
          />
          <p className={`text-xs mt-1 ${bio.length >= 300 ? 'text-destructive' : bio.length >= 270 ? 'text-warning' : 'text-muted-foreground'}`}>
            {bio.length}/300
          </p>
        </div>

        {/* Interests */}
        <div>
          <label className="text-sm font-semibold text-foreground mb-2 block">
            תחומי עניין
            <span className={`mr-2 text-xs font-normal ${interests.length >= 5 ? 'text-success' : 'text-muted-foreground'}`}>
              ({interests.length} נבחרו)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {allInterests.map(({ emoji, label }) => (
              <InterestPill
                key={label}
                label={label}
                emoji={emoji}
                selected={interests.includes(label)}
                onClick={() => toggleInterest(label)}
                size="md"
              />
            ))}
          </div>
          {interests.length > 0 && interests.length < 5 && (
            <p className="text-xs text-destructive mt-2">יש לבחור לפחות 5 תחומי עניין</p>
          )}
        </div>
      </div>

      {/* Sticky Save Button */}
      <div className="fixed bottom-0 inset-x-0 z-40 p-4 glass-strong pb-[calc(16px+env(safe-area-inset-bottom))]">
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={`w-full h-[52px] rounded-full font-semibold text-base flex items-center justify-center gap-2 transition-all ${
            isDirty ? 'gradient-primary text-primary-foreground active:scale-[0.97]' : 'bg-muted text-muted-foreground opacity-50'
          }`}
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : 'שמור שינויים'}
        </button>
      </div>
    </motion.div>
  );
}
