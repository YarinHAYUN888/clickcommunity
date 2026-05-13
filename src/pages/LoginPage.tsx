import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackToLandingButton from '@/components/ui/BackToLandingButton';
import { supabase } from '@/integrations/supabase/client';
import { resolvePostAuthRedirect } from '@/lib/routing/postAuthRedirect';
import { notifyProfileUpdated } from '@/hooks/useCurrentUser';
import ClicksLogo from '@/components/ui/ClicksLogo';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = email.includes('@') && password.length >= 6;

  const handleLogin = async () => {
    if (!isValid || loading) return;
    setError('');
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        console.error('Login error:', authError);
        setError('אימייל או סיסמה שגויים');
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setError('לא הצלחנו לזהות את המשתמש. נסה/י שוב.');
        setLoading(false);
        return;
      }

      const { route, profile } = await resolvePostAuthRedirect(uid);
      console.log("Loaded profile after login:", profile);
      console.log("Redirecting after login:", route);
      if (route === '/clicks') notifyProfileUpdated(uid);
      navigate(route, { replace: true });
    } catch (e) {
      console.error('Login exception:', e);
      setError('שגיאה בהתחברות. נסה/י שוב.');
    }
    setLoading(false);
  };

  return (
    <AnimatedBackground className="flex flex-col items-center justify-center px-6">
      <BackToLandingButton />

      <motion.div
        className="w-full max-w-[520px] z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="mb-8 flex flex-col items-center text-center gap-4">
          <ClicksLogo size={88} glow />
          <div>
            <h1 className="text-[32px] font-bold text-foreground">שמח/ה שחזרת!</h1>
            <p className="text-base text-muted-foreground mt-2">הכנס/י אימייל וסיסמה</p>
          </div>
        </div>

        <div className="space-y-4">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="אימייל"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
            className="w-full h-14 rounded-[16px] px-4 text-base bg-card outline-none transition-all"
            style={{ border: `1px solid ${error ? 'hsl(0 84% 60%)' : 'hsl(var(--border))'}` }}
            dir="ltr"
          />

          <div className="relative" dir="ltr">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="סיסמה"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              className="w-full h-14 rounded-[16px] px-4 pe-12 text-base bg-card outline-none transition-all"
              style={{ border: `1px solid ${error ? 'hsl(0 84% 60%)' : 'hsl(var(--border))'}` }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[13px] text-destructive mt-3"
          >
            {error}
          </motion.p>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleLogin}
          disabled={!isValid || loading}
          className="w-full h-14 rounded-full font-semibold text-lg text-primary-foreground shadow-glass-md disabled:opacity-50 disabled:pointer-events-none mt-6"
          style={{
            background: isValid
              ? 'linear-gradient(135deg, hsl(263 84% 55%), hsl(271 81% 56%))'
              : 'hsl(var(--color-primary-light))',
          }}
        >
          {loading ? '⏳ מתחבר...' : 'התחבר/י'}
        </motion.button>

        <motion.div
          className="mt-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <button
            onClick={() => navigate('/onboarding/credentials')}
            className="text-[15px] font-medium text-primary"
          >
            אין לי חשבון — הרשמה
          </button>
        </motion.div>
      </motion.div>
    </AnimatedBackground>
  );
}
