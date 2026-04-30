import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

interface PhoneOtpFlowProps {
  onVerified: (phone: string) => void;
  initialPhone?: string;
  showDevBypass?: boolean;
}

export default function PhoneOtpFlow({ onVerified, initialPhone = '', showDevBypass = false }: PhoneOtpFlowProps) {
  const [phone, setPhone] = useState(initialPhone);
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(60);
  const [error, setError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [shakeOtp, setShakeOtp] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [devLoading, setDevLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isValidPhone = /^5\d{8}$/.test(phone.replace(/[-\s]/g, '').replace(/^0/, ''));

  useEffect(() => {
    if (!codeSent || resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer(p => p - 1), 1000);
    return () => clearInterval(interval);
  }, [codeSent, resendTimer]);

  const sendOtpToPhone = useCallback(async (cleaned: string) => {
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      phone: `+972${cleaned}`,
    });
    return otpErr;
  }, []);

  const handleSendCode = useCallback(async () => {
    const cleaned = phone.replace(/[-\s]/g, '').replace(/^0/, '');
    if (!/^5\d{8}$/.test(cleaned)) {
      setError('מספר הטלפון לא תקין');
      return;
    }

    setError('');
    setSending(true);

    try {
      const otpErr = await sendOtpToPhone(cleaned);
      if (otpErr) {
        console.error('Send OTP error:', otpErr);
        setError('שליחת הקוד נכשלה. נסה/י שוב.');
        setSending(false);
        return;
      }

      // Fire-and-forget webhook notification (non-blocking)
      supabase.functions.invoke('send-otp-webhook', {
        body: { phone: `+972${cleaned}` },
      }).catch(err => console.warn('Webhook notify error (non-critical):', err));

      setCodeSent(true);
      setResendTimer(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 350);
    } catch (e) {
      console.error('Send OTP exception:', e);
      setError('שגיאה בשליחת הקוד. נסה/י שוב.');
    }

    setSending(false);
  }, [phone, sendOtpToPhone]);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => { if (index + i < 6) newOtp[index + i] = d; });
      setOtp(newOtp);
      setOtpError('');
      const nextIdx = Math.min(index + digits.length, 5);
      inputRefs.current[nextIdx]?.focus();
      if (newOtp.every(d => d !== '')) {
        verifyOtp(newOtp.join(''));
      }
      return;
    }

    const digit = value.replace(/\D/g, '');
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setOtpError('');

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every(d => d !== '')) {
      verifyOtp(newOtp.join(''));
    }
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
    const cleaned = phone.replace(/[-\s]/g, '').replace(/^0/, '');
    setVerifying(true);
    try {
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        phone: `+972${cleaned}`,
        token: code,
        type: 'sms',
      });
      if (verifyErr) {
        console.error('Verify OTP error:', verifyErr);
        setOtpError('הקוד שגוי. נסה/י שוב.');
        setShakeOtp(true);
        setOtp(['', '', '', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 350);
        setVerifying(false);
        return;
      }
      if (data?.session) {
        onVerified(cleaned);
      } else {
        setOtpError('אימות נכשל. נסה/י שוב.');
        setOtp(['', '', '', '', '', '']);
      }
    } catch (e) {
      console.error('Verify OTP exception:', e);
      setOtpError('שגיאה באימות. נסה/י שוב.');
      setOtp(['', '', '', '', '', '']);
    }
    setVerifying(false);
  };

  const handleResend = async () => {
    const cleaned = phone.replace(/[-\s]/g, '').replace(/^0/, '');
    setOtp(['', '', '', '', '', '']);
    setOtpError('');
    setResendTimer(60);
    try {
      const otpErr = await sendOtpToPhone(cleaned);
      if (otpErr) {
        console.error('Resend OTP error:', otpErr);
        setOtpError('שליחת הקוד נכשלה. נסה/י שוב.');
      } else {
        inputRefs.current[0]?.focus();
      }
    } catch (e) {
      console.error('Resend OTP exception:', e);
      setOtpError('שגיאה בשליחה חוזרת.');
    }
  };

  const handleDevBypass = async () => {
    setDevLoading(true);
    setError('');
    try {
      const { data, error: authError } = await supabase.auth.signInAnonymously();
      if (authError) {
        console.error('Anonymous sign-in failed:', authError);
        setError('כניסה אנונימית נכשלה. ודא/י שהאופציה מופעלת בדאשבורד.');
        setDevLoading(false);
        return;
      }
      if (!data.user) {
        setError('לא הצלחנו ליצור משתמש. נסה/י שוב.');
        setDevLoading(false);
        return;
      }
      onVerified('');
    } catch (e) {
      console.error('Anonymous sign-in exception:', e);
      setError('שגיאה בהתחברות. נסה/י שוב.');
    }
    setDevLoading(false);
  };

  const formatTimer = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const allEmpty = otp.every(d => d === '');

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {!codeSent ? (
          <motion.div
            key="phone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-[28px] md:text-[36px] font-bold text-foreground">מה המספר שלך?</h2>
              <p className="text-muted-foreground text-base mt-2">נשלח לך קוד חד-פעמי לאימות</p>
            </div>

            <div
              className="flex items-center h-14 rounded-[16px] overflow-hidden mt-8"
              style={{ border: `1px solid ${error ? 'hsl(0 84% 60%)' : 'hsl(var(--border))'}` }}
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
                onChange={e => { setPhone(e.target.value); setError(''); }}
                className="flex-1 h-full px-4 text-[22px] font-medium bg-transparent outline-none placeholder:text-muted-foreground/40"
              />
            </div>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[13px] text-destructive"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSendCode}
              disabled={!isValidPhone || sending}
              className="w-full h-14 rounded-full font-semibold text-lg text-primary-foreground shadow-glass-md disabled:opacity-50 disabled:pointer-events-none"
              style={{
                background: isValidPhone
                  ? 'linear-gradient(135deg, hsl(263 84% 55%), hsl(271 81% 56%))'
                  : 'hsl(var(--color-primary-light))',
              }}
            >
              {sending ? '⏳ שולח...' : 'שלח קוד'}
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="otp"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-[28px] md:text-[36px] font-bold text-foreground">הכנס/י את הקוד</h2>
              <p className="text-muted-foreground text-base mt-2" dir="ltr">
                שלחנו קוד ל-+972-{phone.replace(/[-\s]/g, '').replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3')}
              </p>
            </div>

            <motion.div
              className="flex gap-2 justify-center mt-8"
              dir="ltr"
              animate={shakeOtp ? { x: [-4, 4, -4, 4, 0] } : {}}
              transition={{ duration: 0.3 }}
              onAnimationComplete={() => setShakeOtp(false)}
            >
              {otp.map((digit, i) => (
                <div key={i} className="relative">
                  <input
                    ref={el => (inputRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    disabled={verifying}
                    className="w-12 h-14 rounded-xl text-center text-2xl font-semibold outline-none transition-all disabled:opacity-50"
                    style={{
                      background: 'hsl(var(--card))',
                      border: `1px solid ${otpError ? 'hsl(0 84% 60%)' : 'hsl(var(--border))'}`,
                    }}
                  />
                  {allEmpty && !digit && (
                    <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none skeleton-shimmer" />
                  )}
                </div>
              ))}
            </motion.div>

            {otpError && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-[13px] text-destructive"
              >
                {otpError}
              </motion.p>
            )}

            {verifying && (
              <p className="text-center text-sm text-muted-foreground">⏳ מאמת...</p>
            )}

            <div className="text-center">
              {resendTimer > 0 ? (
                <p className="text-sm text-muted-foreground">
                  שלח קוד חדש ({formatTimer(resendTimer)})
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  className="text-sm font-medium text-primary"
                >
                  שלח קוד חדש
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showDevBypass && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          onClick={handleDevBypass}
          disabled={devLoading}
          className="w-full mt-4 py-3 rounded-xl text-sm font-medium border border-dashed border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-muted-foreground/60 transition-colors disabled:opacity-50"
        >
          {devLoading ? '⏳ מתחבר...' : '🔓 כניסה ללא קוד (מצב פיתוח)'}
        </motion.button>
      )}
    </div>
  );
}
