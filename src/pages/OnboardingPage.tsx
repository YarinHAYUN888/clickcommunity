import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Plus, X, Briefcase, Check, Eye, EyeOff, MapPin, Instagram, Sparkles } from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import OnboardingProgress from '@/components/onboarding/OnboardingProgress';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackToLandingButton from '@/components/ui/BackToLandingButton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ClicksLogo from '@/components/ui/ClicksLogo';
import { claimSignupRewards, fetchReferrerPreview } from '@/services/points';

const steps = ['credentials', 'basics', 'photos', 'about', 'interests', 'verify'] as const;
type Step = typeof steps[number];

const hebrewMonths = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const regionOptions = ['דרום', 'ירושלים', 'מרכז', 'שרון', 'צפון', 'אחר'] as const;

const DEFAULT_N8N_OTP_WEBHOOK_URL = 'https://redagentai.app.n8n.cloud/webhook-test/send-otp';

const interestsList = [
  { emoji: '🎵', label: 'מוזיקה' }, { emoji: '🏃', label: 'ספורט' },
  { emoji: '✈️', label: 'טיולים' }, { emoji: '🍕', label: 'אוכל' },
  { emoji: '📚', label: 'ספרים' }, { emoji: '🎬', label: 'סרטים' },
  { emoji: '💻', label: 'טכנולוגיה' }, { emoji: '🎨', label: 'אומנות' },
  { emoji: '🧘', label: 'יוגה' }, { emoji: '🎮', label: 'גיימינג' },
  { emoji: '📷', label: 'צילום' }, { emoji: '🍷', label: 'יין' },
  { emoji: '🐕', label: 'כלבים' }, { emoji: '🌱', label: 'טבע' },
  { emoji: '💃', label: 'ריקוד' }, { emoji: '🎭', label: 'תיאטרון' },
  { emoji: '☕', label: 'קפה' }, { emoji: '🏄', label: 'גלישה' },
  { emoji: '🎸', label: 'גיטרה' }, { emoji: '🏋️', label: 'חדר כושר' },
  { emoji: '🎤', label: 'קריוקי' }, { emoji: '🧑‍🍳', label: 'בישול' },
  { emoji: '📺', label: 'סדרות' }, { emoji: '🎲', label: 'משחקי קופסה' },
  { emoji: '💼', label: 'עסקים' }, { emoji: '📊', label: 'שיווק' },
  { emoji: '🏢', label: 'יזמות' }, { emoji: '📈', label: 'השקעות' },
  { emoji: '🤝', label: 'נטוורקינג' }, { emoji: '📝', label: 'כתיבה' },
  { emoji: '🎓', label: 'לימודים' }, { emoji: '⚖️', label: 'משפטים' },
  { emoji: '🏥', label: 'רפואה' }, { emoji: '🔬', label: 'מדע' },
  { emoji: '🏗️', label: 'אדריכלות' }, { emoji: '🎯', label: 'פיתוח אישי' },
];

async function saveProfileToSupabase(data: any, userId: string): Promise<boolean> {
  try {
    const dob = data.dateOfBirth
      ? `${data.dateOfBirth.year}-${String(data.dateOfBirth.month).padStart(2, '0')}-${String(data.dateOfBirth.day).padStart(2, '0')}`
      : null;

    const profileData: any = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    if (data.firstName) profileData.first_name = data.firstName;
    if (data.phone) profileData.phone = data.phone;
    if (dob) profileData.date_of_birth = dob;
    if (data.gender) profileData.gender = data.gender;
    if (data.photos && data.photos.length > 0) {
      profileData.photos = data.photos;
      profileData.avatar_url = data.photos[0];
    }
    if (data.occupation) profileData.occupation = data.occupation;
    if (data.bio !== undefined) profileData.bio = data.bio;
    if (data.interests && data.interests.length > 0) profileData.interests = data.interests;
    if (data.region) profileData.region = data.region;
    if (data.regionOther !== undefined) profileData.region_other = data.regionOther || null;
    if (data.instagram !== undefined) profileData.instagram = data.instagram || null;
    if (data.tiktok !== undefined) profileData.tiktok = data.tiktok || null;

    const { error } = await supabase.from('profiles').upsert(profileData, { onConflict: 'user_id' });
    if (error) {
      console.error('Profile upsert error:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Failed to save profile:', e);
    return false;
  }
}

export default function OnboardingPage() {
  const { step } = useParams<{ step: string }>();
  const navigate = useNavigate();
  const { data, updateData, clearData } = useOnboarding();
  const currentIndex = steps.indexOf(step as Step);
  const progress = ((currentIndex + 1) / steps.length) * 100;

  const [showCelebration, setShowCelebration] = useState(false);

  const goBack = () => {
    if (currentIndex > 0) navigate(`/onboarding/${steps[currentIndex - 1]}`);
    else navigate('/welcome');
  };

  const goNext = () => {
    if (currentIndex < steps.length - 1) {
      navigate(`/onboarding/${steps[currentIndex + 1]}`);
    }
  };

  const handleRegistrationComplete = () => {
    setShowCelebration(true);
    setTimeout(() => {
      clearData();
      navigate('/clicks');
    }, 2000);
  };

  if (showCelebration) return <CelebrationScreen />;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-50">
        <OnboardingProgress progress={progress} />
      </div>

      <BackToLandingButton />

      <div className="px-4 pt-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={goBack}
          className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <ArrowRight size={24} className="text-muted-foreground" />
        </motion.button>
      </div>

      <div className="flex-1 px-6 pb-28 max-w-[520px] mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="mt-8"
          >
            {step === 'credentials' && <CredentialsStep data={data} updateData={updateData} onNext={goNext} />}
            {step === 'basics' && <BasicsStep data={data} updateData={updateData} onNext={goNext} />}
            {step === 'photos' && <PhotosStep data={data} updateData={updateData} onNext={goNext} />}
            {step === 'about' && <AboutStep data={data} updateData={updateData} onNext={goNext} />}
            {step === 'interests' && <InterestsStep data={data} updateData={updateData} onNext={goNext} />}
            {step === 'verify' && <VerifyStep data={data} updateData={updateData} onComplete={handleRegistrationComplete} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---- STEP 1: Credentials ----
function CredentialsStep({ data, updateData, onNext }: { data: any; updateData: any; onNext: () => void }) {
  const [firstName, setFirstName] = useState(data.firstName || '');
  const [lastName, setLastName] = useState(data.lastName || '');
  const [email, setEmail] = useState(data.email || '');
  const [password, setPassword] = useState(data.password || '');
  const [phone, setPhone] = useState(data.phone || '');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);

  const firstNameValid = firstName.trim().length >= 2;
  const lastNameValid = lastName.trim().length >= 2;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordValid = password.length >= 6;
  const phoneClean = phone.replace(/[-\s]/g, '').replace(/^0/, '');
  const phoneValid = /^5\d{8}$/.test(phoneClean);

  const canContinue = firstNameValid && lastNameValid && emailValid && passwordValid && phoneValid;

  const handleNext = () => {
    setTouched(true);
    if (!canContinue) return;
    updateData({ firstName, lastName, email, password, phone });
    onNext();
  };

  const inputStyle = (valid: boolean) => ({
    border: `1px solid ${touched && !valid ? 'hsl(0 84% 60%)' : valid ? 'hsl(160 84% 39%)' : 'hsl(var(--border))'}`
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[28px] md:text-[36px] font-bold text-foreground">יצירת חשבון</h2>
        <p className="text-muted-foreground text-base mt-2">הזן/י את הפרטים שלך</p>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            placeholder="שם פרטי"
            className="w-full h-[52px] rounded-[16px] px-4 text-base bg-card outline-none transition-all"
            style={inputStyle(firstNameValid)}
          />
          {firstNameValid && <Check size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-success" />}
        </div>
        <div className="flex-1 relative">
          <input
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            placeholder="שם משפחה"
            className="w-full h-[52px] rounded-[16px] px-4 text-base bg-card outline-none transition-all"
            style={inputStyle(lastNameValid)}
          />
          {lastNameValid && <Check size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-success" />}
        </div>
      </div>
      {touched && (!firstNameValid || !lastNameValid) && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[13px] text-destructive">
          נא להזין שם פרטי ושם משפחה
        </motion.p>
      )}

      <div className="relative">
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="אימייל"
          dir="ltr"
          className="w-full h-[52px] rounded-[16px] px-4 text-base bg-card outline-none transition-all"
          style={inputStyle(emailValid)}
        />
        {emailValid && <Check size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-success" />}
      </div>
      {touched && !emailValid && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[13px] text-destructive">
          נא להזין אימייל תקין
        </motion.p>
      )}

      <div className="relative" dir="ltr">
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="סיסמה (לפחות 6 תווים)"
          className="w-full h-[52px] rounded-[16px] px-4 pe-12 text-base bg-card outline-none transition-all"
          style={inputStyle(passwordValid)}
        />
        <button
          type="button"
          onClick={() => setShowPassword(p => !p)}
          className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
        >
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {touched && !passwordValid && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[13px] text-destructive">
          הסיסמה חייבת להכיל לפחות 6 תווים
        </motion.p>
      )}

      <div
        className="flex items-center h-[52px] rounded-[16px] overflow-hidden"
        style={inputStyle(phoneValid)}
        dir="ltr"
      >
        <div className="flex items-center gap-1.5 px-4 h-full bg-muted/50 border-e border-border shrink-0">
          <span className="text-base">🇮🇱</span>
          <span className="text-muted-foreground font-medium text-base">+972</span>
        </div>
        <input
          type="tel"
          inputMode="tel"
          placeholder="5X XXX XXXX"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="flex-1 h-full px-4 text-base font-medium bg-transparent outline-none placeholder:text-muted-foreground/40"
        />
      </div>
      {touched && !phoneValid && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[13px] text-destructive">
          נא להזין מספר טלפון ישראלי תקין
        </motion.p>
      )}

      <StickyButton disabled={!canContinue} onClick={handleNext} label="המשך" />
    </div>
  );
}

// ---- STEP 2: Basics (DOB + Gender + Region) ----
function BasicsStep({ data, updateData, onNext }: { data: any; updateData: any; onNext: () => void }) {
  const [day, setDay] = useState(data.dateOfBirth?.day || 0);
  const [month, setMonth] = useState(data.dateOfBirth?.month || 0);
  const [year, setYear] = useState(data.dateOfBirth?.year || 0);
  const [gender, setGender] = useState(data.gender || '');
  const [region, setRegion] = useState<string>(data.region || '');
  const [regionOther, setRegionOther] = useState<string>(data.regionOther || '');
  const [touched, setTouched] = useState(false);

  const dobComplete = day > 0 && month > 0 && year > 0;
  const currentYear = new Date().getFullYear();
  const age = dobComplete ? currentYear - year : 0;
  const ageValid = age >= 19;
  const regionValid = region !== '' && (region !== 'אחר' || regionOther.trim().length >= 2);
  const canContinue = dobComplete && ageValid && gender !== '' && regionValid;

  const handleNext = () => {
    setTouched(true);
    if (!canContinue) return;
    updateData({
      dateOfBirth: { day, month, year },
      gender,
      region,
      regionOther: region === 'אחר' ? regionOther.trim() : '',
    });
    onNext();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-[28px] md:text-[36px] font-bold text-foreground">פרטים בסיסיים</h2>

      <div>
        <p className="text-[13px] font-medium text-muted-foreground mb-2">תאריך לידה</p>
        <div className="flex gap-3">
          <select value={day} onChange={e => setDay(Number(e.target.value))}
            className="flex-1 h-[52px] rounded-[16px] px-3 text-base bg-card outline-none appearance-none text-center"
            style={{ border: '1px solid hsl(var(--border))' }}>
            <option value={0}>יום</option>
            {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="flex-1 h-[52px] rounded-[16px] px-3 text-base bg-card outline-none appearance-none text-center"
            style={{ border: '1px solid hsl(var(--border))' }}>
            <option value={0}>חודש</option>
            {hebrewMonths.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="flex-1 h-[52px] rounded-[16px] px-3 text-base bg-card outline-none appearance-none text-center"
            style={{ border: `1px solid ${dobComplete && !ageValid ? 'hsl(0 84% 60%)' : 'hsl(var(--border))'}` }}>
            <option value={0}>שנה</option>
            {Array.from({ length: 2007 - 1940 + 1 }, (_, i) => 2007 - i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {dobComplete && !ageValid && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[13px] text-destructive mt-1">
            הגיל המינימלי להרשמה הוא 19
          </motion.p>
        )}
      </div>

      <div>
        <p className="text-[13px] font-medium text-muted-foreground mb-2">מגדר</p>
        <div className="flex gap-3 relative">
          {(['גבר', 'אישה', 'אחר'] as const).map(g => {
            const isSelected = gender === g;
            return (
              <motion.button key={g} onClick={() => setGender(g)} whileTap={{ scale: 0.95 }}
                className="flex-1 h-12 rounded-full text-base font-medium transition-colors relative overflow-hidden"
                style={{
                  background: isSelected ? 'hsl(var(--color-primary))' : 'hsl(var(--color-primary-ultra-light))',
                  color: isSelected ? 'white' : 'hsl(var(--muted-foreground))',
                  border: isSelected ? 'none' : '1px solid hsl(var(--border))',
                }}>
                {isSelected && (
                  <motion.div layoutId="gender-bg" className="absolute inset-0 rounded-full"
                    style={{ background: 'hsl(var(--color-primary))' }} transition={{ type: 'spring', duration: 0.25 }} />
                )}
                <span className="relative z-10">{g}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[13px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
          <MapPin size={14} className="text-primary" />
          מאיפה אתה בארץ?
        </p>
        <div className="flex flex-wrap gap-2">
          {regionOptions.map(r => {
            const isSelected = region === r;
            return (
              <motion.button
                key={r}
                type="button"
                onClick={() => setRegion(r)}
                whileTap={{ scale: 0.95 }}
                className="rounded-full px-[18px] py-[10px] text-[15px] font-medium transition-colors"
                style={{
                  background: isSelected ? 'hsl(var(--color-primary))' : 'hsl(var(--background))',
                  color: isSelected ? 'white' : 'hsl(var(--muted-foreground))',
                  border: isSelected ? '1px solid transparent' : '1px solid hsl(var(--border))',
                }}
              >
                {r}
              </motion.button>
            );
          })}
        </div>
        <AnimatePresence initial={false}>
          {region === 'אחר' && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.2 }}
            >
              <input
                value={regionOther}
                onChange={e => setRegionOther(e.target.value)}
                placeholder="ציינ/י את האזור"
                maxLength={40}
                className="w-full h-[48px] rounded-[16px] px-4 text-base bg-card outline-none transition-all"
                style={{
                  border: `1px solid ${touched && !regionValid ? 'hsl(0 84% 60%)' : 'hsl(var(--border))'}`,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        {touched && !regionValid && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[13px] text-destructive mt-1">
            {region === 'אחר' ? 'נא לציין את האזור' : 'נא לבחור אזור'}
          </motion.p>
        )}
      </div>

      <StickyButton disabled={!canContinue} onClick={handleNext} label="המשך" />
    </div>
  );
}

// ---- STEP 3: Photos ----
function PhotosStep({ data, updateData, onNext }: { data: any; updateData: any; onNext: () => void }) {
  const [photos, setPhotos] = useState<(string | null)[]>(() => {
    const saved = data.photos || [];
    const arr = Array(6).fill(null);
    saved.forEach((p: string, i: number) => { if (i < 6) arr[i] = p; });
    return arr;
  });
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);
  const filledCount = photos.filter(Boolean).length;

  const handleSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotos(prev => { const next = [...prev]; next[index] = reader.result as string; return next; });
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => { const next = [...prev]; next[index] = null; return next; });
  };

  const handleNext = () => {
    updateData({ photos: photos.filter(Boolean) as string[] });
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[28px] md:text-[36px] font-bold text-foreground">הוסף/י תמונות</h2>
        <p className="text-[15px] text-muted-foreground mt-2">בין 1-6 תמונות. התמונה הראשונה היא התמונה הראשית</p>
      </div>
      <div className="grid grid-cols-2 gap-3" style={{ direction: 'rtl' }}>
        <PhotoSlot index={0} photo={photos[0]} isPrimary fileRef={el => (fileRefs.current[0] = el)} onSelect={e => handleSelect(0, e)} onRemove={() => removePhoto(0)} className="row-span-2" />
        {[1, 2, 3, 4, 5].map(i => (
          <PhotoSlot key={i} index={i} photo={photos[i]} fileRef={el => (fileRefs.current[i] = el)} onSelect={e => handleSelect(i, e)} onRemove={() => removePhoto(i)} />
        ))}
      </div>
      <StickyButton disabled={filledCount < 1} onClick={handleNext} label="המשך" />
    </div>
  );
}

function PhotoSlot({ index, photo, isPrimary, fileRef, onSelect, onRemove, className = '' }: {
  index: number; photo: string | null; isPrimary?: boolean;
  fileRef: (el: HTMLInputElement | null) => void;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void; className?: string;
}) {
  return (
    <div className={`relative rounded-[16px] overflow-hidden ${isPrimary ? 'aspect-[3/4]' : 'aspect-square'} ${className}`}
      style={{ background: photo ? undefined : 'hsl(var(--color-primary-ultra-light))', border: photo ? 'none' : '2px dashed hsl(var(--color-primary-light))' }}>
      {photo ? (
        <>
          <img src={photo} alt="" className="w-full h-full object-cover" />
          <button onClick={onRemove} className="absolute top-2 start-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.8)' }}>
            <X size={14} className="text-white" />
          </button>
          {isPrimary && (
            <div className="absolute bottom-2 inset-x-0 flex justify-center">
              <span className="text-[11px] font-medium px-3 py-1 rounded-full text-primary-foreground" style={{ background: 'hsl(var(--color-primary))' }}>ראשית</span>
            </div>
          )}
        </>
      ) : (
        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer gap-1">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={onSelect} />
          <Plus size={24} className="text-primary-light" />
        </label>
      )}
    </div>
  );
}

// ---- STEP 4: About ----
const TikTokGlyph = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.69a8.16 8.16 0 0 0 4.77 1.52V6.81a4.85 4.85 0 0 1-1.84-.12z" />
  </svg>
);

const sanitizeHandle = (raw: string): string => {
  // Allow @, letters, digits, dot, underscore — strip the rest. Trim @ for storage.
  const cleaned = raw.trim().replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '');
  return cleaned;
};

function AboutStep({ data, updateData, onNext }: { data: any; updateData: any; onNext: () => void }) {
  const [occupation, setOccupation] = useState(data.occupation || '');
  const [bio, setBio] = useState(data.bio || '');
  const [instagram, setInstagram] = useState(data.instagram || '');
  const [tiktok, setTiktok] = useState(data.tiktok || '');
  const [touched, setTouched] = useState(false);
  const occValid = occupation.trim().length >= 2;
  const remaining = 300 - bio.length;

  const handleNext = () => {
    setTouched(true);
    if (!occValid) return;
    updateData({
      occupation,
      bio,
      instagram: sanitizeHandle(instagram),
      tiktok: sanitizeHandle(tiktok),
    });
    onNext();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-[28px] md:text-[36px] font-bold text-foreground">קצת עליך</h2>
      <div>
        <div className="relative">
          <Briefcase size={20} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={occupation} onChange={e => setOccupation(e.target.value)} placeholder="מה העיסוק שלך?"
            className="w-full h-[52px] rounded-[16px] pe-10 ps-10 text-base bg-card outline-none transition-all"
            style={{ border: `1px solid ${touched && !occValid ? 'hsl(0 84% 60%)' : occValid ? 'hsl(160 84% 39%)' : 'hsl(var(--border))'}` }} />
          {occValid && <Check size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-success" />}
        </div>
        {touched && !occValid && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[13px] text-destructive mt-1">נא להזין עיסוק</motion.p>
        )}
      </div>
      <div>
        <textarea value={bio} onChange={e => { if (e.target.value.length <= 300) setBio(e.target.value); }}
          placeholder="מה חשוב לך? מה אתה אוהב/ת לעשות?" rows={4}
          className="w-full rounded-[16px] px-4 py-3 text-base bg-card outline-none resize-none transition-all"
          style={{ border: '1px solid hsl(var(--border))' }} />
        <p className="text-[13px] mt-1 text-start transition-colors duration-200"
          style={{ color: remaining <= 0 ? 'hsl(0 84% 60%)' : remaining <= 30 ? 'hsl(38 92% 50%)' : 'hsl(var(--muted-foreground))' }}>
          {bio.length}/300
        </p>
      </div>

      {/* Social handles (optional) */}
      <div>
        <p className="text-[13px] font-medium text-muted-foreground mb-2">רשתות חברתיות <span className="text-muted-foreground/60">(אופציונלי)</span></p>
        <div className="space-y-3">
          <div
            className="flex items-center h-[52px] rounded-[16px] overflow-hidden transition-all"
            style={{ border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
            dir="ltr"
          >
            <div className="flex items-center justify-center px-4 h-full bg-muted/40 border-e border-border shrink-0 text-primary">
              <Instagram size={18} />
            </div>
            <span className="ps-3 text-muted-foreground/60 text-base shrink-0">@</span>
            <input
              type="text"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="username"
              value={instagram}
              onChange={e => setInstagram(e.target.value)}
              maxLength={40}
              className="flex-1 h-full px-2 text-base bg-transparent outline-none placeholder:text-muted-foreground/40"
            />
          </div>

          <div
            className="flex items-center h-[52px] rounded-[16px] overflow-hidden transition-all"
            style={{ border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
            dir="ltr"
          >
            <div className="flex items-center justify-center px-4 h-full bg-muted/40 border-e border-border shrink-0 text-primary">
              <TikTokGlyph size={18} />
            </div>
            <span className="ps-3 text-muted-foreground/60 text-base shrink-0">@</span>
            <input
              type="text"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="username"
              value={tiktok}
              onChange={e => setTiktok(e.target.value)}
              maxLength={40}
              className="flex-1 h-full px-2 text-base bg-transparent outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        </div>
      </div>

      <StickyButton disabled={!occValid} onClick={handleNext} label="המשך" />
    </div>
  );
}

// ---- STEP 5: Interests ----
const PRESET_LABELS = new Set(interestsList.map(i => i.label));

function InterestsStep({ data, updateData, onNext }: { data: any; updateData: any; onNext: () => void }) {
  const [selected, setSelected] = useState<string[]>(data.interests || []);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherDraft, setOtherDraft] = useState('');
  const otherInputRef = useRef<HTMLInputElement>(null);

  // Custom interests = anything in `selected` that's not in the preset list
  const customInterests = selected.filter(s => !PRESET_LABELS.has(s));

  const toggle = (label: string) =>
    setSelected(prev => (prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]));

  const addCustomInterest = () => {
    const value = otherDraft.trim();
    if (value.length < 2) return;
    if (selected.includes(value) || PRESET_LABELS.has(value)) {
      setOtherDraft('');
      setShowOtherInput(false);
      return;
    }
    setSelected(prev => [...prev, value]);
    setOtherDraft('');
    setShowOtherInput(false);
  };

  const enough = selected.length >= 5;
  const handleNext = () => { updateData({ interests: selected }); onNext(); };

  const sorted = [...interestsList].sort((a, b) => {
    const aS = selected.includes(a.label) ? 0 : 1;
    const bS = selected.includes(b.label) ? 0 : 1;
    return aS - bS;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[28px] md:text-[36px] font-bold text-foreground">מה מעניין אותך?</h2>
        <p className="text-[15px] text-muted-foreground mt-2">בחר/י לפחות 5 תחומי עניין</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {/* Custom interests pinned at the top */}
        {customInterests.map(label => (
          <motion.button
            key={`custom-${label}`}
            layout
            whileTap={{ scale: 1.15 }}
            onClick={() => toggle(label)}
            className="inline-flex items-center gap-1.5 rounded-full px-[18px] py-[10px] text-[15px] transition-colors"
            style={{
              background: 'hsl(var(--color-primary))',
              color: 'white',
              border: '1px solid transparent',
              fontWeight: 500,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <Sparkles size={14} />
            {label}
            <X size={14} className="opacity-80" />
          </motion.button>
        ))}

        {/* Preset interests */}
        {sorted.map(({ emoji, label }) => {
          const isSelected = selected.includes(label);
          return (
            <motion.button key={label} layout whileTap={{ scale: 1.15 }} onClick={() => toggle(label)}
              className="inline-flex items-center gap-1.5 rounded-full px-[18px] py-[10px] text-[15px] font-normal transition-colors"
              style={{
                background: isSelected ? 'hsl(var(--color-primary))' : 'hsl(var(--background))',
                color: isSelected ? 'white' : 'hsl(var(--muted-foreground))',
                border: isSelected ? '1px solid transparent' : '1px solid hsl(var(--border))',
                fontWeight: isSelected ? 500 : 400,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
              <span>{emoji}</span>{label}
            </motion.button>
          );
        })}

        {/* "Other" trigger chip */}
        <motion.button
          layout
          type="button"
          onClick={() => {
            setShowOtherInput(true);
            setTimeout(() => otherInputRef.current?.focus(), 50);
          }}
          whileTap={{ scale: 1.05 }}
          className="inline-flex items-center gap-1.5 rounded-full px-[18px] py-[10px] text-[15px] font-medium transition-colors"
          style={{
            background: 'hsl(var(--background))',
            color: 'hsl(var(--color-primary))',
            border: '1px dashed hsl(var(--color-primary-light))',
          }}
        >
          <Plus size={14} />
          אחר
        </motion.button>
      </div>

      {/* Inline input for custom interest */}
      <AnimatePresence initial={false}>
        {showOtherInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="flex items-center h-[48px] rounded-[16px] overflow-hidden"
              style={{ border: '1px solid hsl(var(--color-primary-light))', background: 'hsl(var(--card))' }}
            >
              <input
                ref={otherInputRef}
                value={otherDraft}
                onChange={e => setOtherDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); addCustomInterest(); }
                  if (e.key === 'Escape') { setShowOtherInput(false); setOtherDraft(''); }
                }}
                placeholder="הוסיפ/י תחום עניין משלך"
                maxLength={30}
                className="flex-1 h-full px-4 text-base bg-transparent outline-none placeholder:text-muted-foreground/50"
              />
              <button
                type="button"
                onClick={addCustomInterest}
                disabled={otherDraft.trim().length < 2}
                className="h-full px-4 text-sm font-semibold text-primary disabled:opacity-40 transition-opacity"
              >
                הוסף
              </button>
              <button
                type="button"
                onClick={() => { setShowOtherInput(false); setOtherDraft(''); }}
                className="h-full px-3 text-muted-foreground"
                aria-label="ביטול"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="sticky bottom-0 pt-4 pb-4 bg-gradient-to-t from-background to-transparent">
        <motion.p className="text-center text-[15px] font-medium mb-3"
          style={{ color: enough ? 'hsl(160 84% 39%)' : 'hsl(var(--muted-foreground))' }}>
          {enough ? `${selected.length} נבחרו ✓` : `${selected.length} מתוך 5 נבחרו`}
        </motion.p>
        <StickyButton disabled={!enough} onClick={handleNext} label="המשך לאימות" inline />
      </div>
    </div>
  );
}

// ---- STEP 6: Verify ----
function VerifyStep({ data, updateData, onComplete }: { data: any; updateData: any; onComplete: () => void }) {
  const [method, setMethod] = useState<'phone' | 'email'>(data.verificationMethod || '');
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [shakeOtp, setShakeOtp] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [error, setError] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const generatedCodeRef = useRef<string>('');

  const [inviterName, setInviterName] = useState<string | null>(null);
  useEffect(() => {
    const c = (data.referralCode || '').trim();
    if (c.length < 4) {
      setInviterName(null);
      return;
    }
    let cancelled = false;
    fetchReferrerPreview(c).then((r) => {
      if (!cancelled && r?.first_name) setInviterName(r.first_name);
    });
    return () => {
      cancelled = true;
    };
  }, [data.referralCode]);

  const inviteBanner = inviterName ? (
    <div className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-2.5 text-sm text-foreground">
      מוזמנ/ת על ידי <span className="font-bold">{inviterName}</span>
    </div>
  ) : null;

  useEffect(() => {
    if (!codeSent || resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer(p => p - 1), 1000);
    return () => clearInterval(interval);
  }, [codeSent, resendTimer]);

  const generateOtpCode = () => Math.floor(100000 + Math.random() * 900000).toString();

  const buildWebhookBody = useCallback((action: string, code?: string) => {
    const phoneClean = data.phone.replace(/[-\s]/g, '').replace(/^0/, '');
    return {
      action,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: `+972${phoneClean}`,
      gender: data.gender,
      dateOfBirth: data.dateOfBirth,
      region: data.region,
      regionOther: data.regionOther,
      occupation: data.occupation,
      bio: data.bio,
      instagram: data.instagram,
      tiktok: data.tiktok,
      interests: data.interests,
      photos: data.photos,
      verificationMethod: method,
      code: code || '',
    };
  }, [data, method]);

  const sendOtpToN8nWebhook = useCallback(async (action: string, code?: string) => {
    const body = buildWebhookBody(action, code);
    const url =
      import.meta.env.VITE_N8N_OTP_WEBHOOK_URL?.trim() || DEFAULT_N8N_OTP_WEBHOOK_URL;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (import.meta.env.DEV && !res.ok) {
      console.error('[n8n OTP webhook]', res.status, parsed);
    }
    return { ok: res.ok, status: res.status, data: parsed };
  }, [buildWebhookBody]);

  const completeRegistration = useCallback(async () => {
    const password = data.password?.trim();
    const email = data.email?.trim().toLowerCase();

    if (!password || !email) {
      throw new Error('missing_credentials');
    }

    const { data: registrationData, error: registrationError } = await supabase.functions.invoke('complete-registration', {
      body: {
        email,
        password,
        firstName: data.firstName,
        lastName: data.lastName,
        referralCode: data.referralCode?.trim() || undefined,
      },
    });

    if (registrationError) {
      if (import.meta.env.DEV) console.error('complete-registration invoke error:', registrationError);
      throw new Error('registration_failed');
    }

    if (!registrationData?.tokenHash) {
      if (import.meta.env.DEV) console.error('Missing tokenHash from complete-registration');
      throw new Error('session_token_missing');
    }

    await supabase.auth.signOut({ scope: 'local' });

    const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: registrationData.tokenHash,
      type: 'magiclink',
    });

    if (verifyErr || !verifyData.user) {
      if (import.meta.env.DEV) console.error('verifyOtp after registration failed:', verifyErr);
      throw new Error('session_creation_failed');
    }

    const saved = await saveProfileToSupabase(data, verifyData.user.id);
    if (!saved) {
      toast.error('שגיאה בשמירת הפרופיל');
    }

    const refRaw =
      data.referralCode?.trim() ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('clicks_ref_code') : null);
    try {
      await claimSignupRewards(refRaw || undefined);
      try {
        localStorage.removeItem('clicks_ref_code');
      } catch {
        /* ignore */
      }
    } catch (e) {
      console.warn('claim-signup-rewards:', e);
    }
  }, [data]);

  const handleSendCode = useCallback(async () => {
    if (!method) return;
    setError('');
    setSending(true);

    try {
      const newCode = generateOtpCode();
      generatedCodeRef.current = newCode;
      const result = await sendOtpToN8nWebhook('send', newCode);
      if (import.meta.env.DEV) console.log('n8n OTP webhook:', result.ok ? 'ok' : 'fail', result.status);

      if (!result.ok) {
        setError('שגיאה בשליחת קוד האימות. נסה/י שוב.');
        setSending(false);
        return;
      }

      const showOtpPlain =
        import.meta.env.DEV || import.meta.env.VITE_SHOW_OTP_PLAINTEXT === 'true';
      if (showOtpPlain) {
        toast.info(`קוד האימות (לבדיקה בלבד): ${newCode}`, { duration: 120_000 });
      }

      setCodeSent(true);
      setResendTimer(60);
      updateData({ verificationMethod: method });
      setTimeout(() => inputRefs.current[0]?.focus(), 350);
    } catch (e) {
      console.error('Send code exception:', e);
      setError('שגיאה בשליחת קוד האימות. נסה/י שוב.');
    }
    setSending(false);
  }, [method, updateData, sendOtpToN8nWebhook]);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => { if (index + i < 6) newOtp[index + i] = d; });
      setOtp(newOtp);
      setOtpError('');
      const nextIdx = Math.min(index + digits.length, 5);
      inputRefs.current[nextIdx]?.focus();
      if (newOtp.every(d => d !== '')) verifyOtp(newOtp.join(''));
      return;
    }
    const digit = value.replace(/\D/g, '');
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setOtpError('');
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
    if (newOtp.every(d => d !== '')) verifyOtp(newOtp.join(''));
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async (code: string) => {
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    try {
      if (code !== generatedCodeRef.current) {
        setOtpError('הקוד שגוי. נסה/י שוב.');
        setShakeOtp(true);
        setOtp(['', '', '', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 350);
        setVerifying(false);
        return;
      }

      await completeRegistration();
      onComplete();
    } catch (e) {
      console.error('Verify exception:', e);
      if (e instanceof Error && e.message === 'missing_credentials') {
        setOtpError('חסרים פרטי הרשמה. חזרו להתחלה ונסו שוב.');
      } else if (e instanceof Error && e.message === 'session_token_missing') {
        setOtpError('לא הצלחנו ליצור חיבור מאובטח. נסה/י שוב.');
      } else {
        setOtpError('שגיאה ביצירת החשבון. נסה/י שוב.');
      }
    }
    setVerifying(false);
  };

  const handleResend = async () => {
    setOtp(['', '', '', '', '', '']);
    setOtpError('');
    setResendTimer(60);
    try {
      const newCode = generateOtpCode();
      generatedCodeRef.current = newCode;
      const result = await sendOtpToN8nWebhook('send', newCode);
      if (!result.ok) {
        console.error('Resend error:', result);
        setOtpError('שליחת הקוד נכשלה.');
      } else {
        const showOtpPlain =
          import.meta.env.DEV || import.meta.env.VITE_SHOW_OTP_PLAINTEXT === 'true';
        if (showOtpPlain) {
          toast.info(`קוד האימות (לבדיקה בלבד): ${newCode}`, { duration: 120_000 });
        }
        inputRefs.current[0]?.focus();
      }
    } catch (e) {
      console.error('Resend exception:', e);
      setOtpError('שגיאה בשליחה חוזרת.');
    }
  };

  const formatTimer = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const allEmpty = otp.every(d => d === '');

  if (!codeSent) {
    return (
      <div className="space-y-6">
        {inviteBanner}
        <div>
          <h2 className="text-[28px] md:text-[36px] font-bold text-foreground">אימות החשבון</h2>
          <p className="text-muted-foreground text-base mt-2">בחר/י איך לקבל את קוד האימות</p>
        </div>

        <div className="space-y-3">
          {(['email', 'phone'] as const).map(m => {
            const isSelected = method === m;
            const label = m === 'email' ? `📧 אימייל — ${data.email}` : `📱 SMS — +972${data.phone.replace(/[-\s]/g, '').replace(/^0/, '')}`;
            return (
              <motion.button key={m} whileTap={{ scale: 0.97 }} onClick={() => setMethod(m)}
                className="w-full h-14 rounded-[16px] px-4 text-start text-base font-medium transition-all flex items-center gap-3"
                style={{
                  background: isSelected ? 'hsl(var(--color-primary-ultra-light))' : 'hsl(var(--card))',
                  border: `2px solid ${isSelected ? 'hsl(var(--color-primary))' : 'hsl(var(--border))'}`,
                  color: isSelected ? 'hsl(var(--color-primary))' : 'hsl(var(--foreground))',
                }}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-primary' : 'border-muted-foreground/40'}`}>
                  {isSelected && <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'hsl(var(--color-primary))' }} />}
                </div>
                {label}
              </motion.button>
            );
          })}
        </div>

        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[13px] text-destructive">{error}</motion.p>
        )}

        <StickyButton disabled={!method || sending} onClick={handleSendCode} label={sending ? '⏳ שולח...' : 'שלח קוד אימות'} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {inviteBanner}
      <div>
        <h2 className="text-[28px] md:text-[36px] font-bold text-foreground">הכנס/י את הקוד</h2>
        <p className="text-muted-foreground text-base mt-2">
          {method === 'email' ? `שלחנו קוד ל-${data.email}` : `שלחנו קוד ל-+972-${data.phone.replace(/[-\s]/g, '').replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3')}`}
        </p>
      </div>

      <motion.div className="flex gap-2 justify-center mt-8" dir="ltr"
        animate={shakeOtp ? { x: [-4, 4, -4, 4, 0] } : {}}
        transition={{ duration: 0.3 }} onAnimationComplete={() => setShakeOtp(false)}>
        {otp.map((digit, i) => (
          <div key={i} className="relative">
            <input ref={el => (inputRefs.current[i] = el)} type="text" inputMode="numeric" maxLength={6}
              value={digit} onChange={e => handleOtpChange(i, e.target.value)} onKeyDown={e => handleOtpKeyDown(i, e)}
              disabled={verifying}
              className="w-12 h-14 rounded-xl text-center text-2xl font-semibold outline-none transition-all disabled:opacity-50"
              style={{ background: 'hsl(var(--card))', border: `1px solid ${otpError ? 'hsl(0 84% 60%)' : 'hsl(var(--border))'}` }} />
            {allEmpty && !digit && <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none skeleton-shimmer" />}
          </div>
        ))}
      </motion.div>

      {/* Paste from clipboard button */}
      <motion.button
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        onClick={() => {
          const code = generatedCodeRef.current;
          if (!code || code.length !== 6) {
            setOtpError('קוד האימות לא זמין. לחץ/י "שלח קוד חדש".');
            return;
          }
          setOtp(['', '', '', '', '', '']);
          setOtpError('');
          const digits = code.split('');
          digits.forEach((digit, index) => {
            setTimeout(() => {
              setOtp(prev => {
                const newOtp = [...prev];
                newOtp[index] = digit;
                return newOtp;
              });
              if (index === 5) {
                setTimeout(() => verifyOtp(code), 200);
              }
            }, index * 120);
          });
        }}
        disabled={verifying}
        className="w-full h-12 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          color: 'hsl(var(--color-primary))',
        }}
      >
        {method === 'email' ? '📧 הדבק מהמייל' : '📱 הדבק מהטלפון'}
      </motion.button>

      {otpError && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-[13px] text-destructive">{otpError}</motion.p>}
      {verifying && <p className="text-center text-sm text-muted-foreground">⏳ מאמת...</p>}

      <div className="text-center">
        {resendTimer > 0 ? (
          <p className="text-sm text-muted-foreground">שלח קוד חדש ({formatTimer(resendTimer)})</p>
        ) : (
          <button onClick={handleResend} className="text-sm font-medium text-primary">שלח קוד חדש</button>
        )}
      </div>
    </div>
  );
}

// ---- Shared CTA Button ----
function StickyButton({ disabled, onClick, label, inline }: { disabled: boolean; onClick: () => void; label: string; inline?: boolean }) {
  return (
    <div className={inline ? '' : 'fixed bottom-0 inset-x-0 px-6 pb-6 pt-4 bg-gradient-to-t from-background via-background/80 to-transparent max-w-[520px] mx-auto'}>
      <motion.button whileTap={disabled ? {} : { scale: 0.97 }} onClick={onClick} disabled={disabled}
        className="w-full h-14 rounded-full font-semibold text-lg text-primary-foreground shadow-glass-md disabled:pointer-events-none transition-opacity"
        style={{
          background: disabled ? 'hsl(var(--color-primary-light))' : 'linear-gradient(135deg, hsl(263 84% 55%), hsl(271 81% 56%))',
          opacity: disabled ? 0.5 : 1,
        }}>
        {label}
      </motion.button>
    </div>
  );
}

// ---- Celebration Screen ----
function CelebrationScreen() {
  return (
    <AnimatedBackground className="flex flex-col items-center justify-center px-6">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 18 }).map((_, i) => (
          <motion.div key={i} className="absolute rounded-full"
            style={{
              width: 4 + Math.random() * 4, height: 4 + Math.random() * 4,
              background: ['hsl(263 84% 55%)', 'hsl(258 95% 76%)', 'hsl(262 100% 96%)'][i % 3],
              left: '50%', top: '50%',
            }}
            initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
            animate={{ x: (Math.random() - 0.5) * 300, y: (Math.random() - 0.5) * 300, scale: [0, 1.5, 0], opacity: [1, 1, 0] }}
            transition={{ duration: 1.5, ease: 'easeOut', delay: Math.random() * 0.3 }} />
        ))}
      </div>
      <motion.div className="z-10 mb-3"
        initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, type: 'spring', damping: 14 }}>
        <ClicksLogo size={120} glow />
      </motion.div>
      <motion.h1 className="text-[32px] font-bold z-10" style={{ color: 'hsl(var(--color-primary))' }}
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
        מעולה! הכל מוכן 🎉
      </motion.h1>
      <motion.p className="text-lg text-muted-foreground mt-3 z-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        ברוכ/ה הבא/ה ל-Clicks
      </motion.p>
    </AnimatedBackground>
  );
}
