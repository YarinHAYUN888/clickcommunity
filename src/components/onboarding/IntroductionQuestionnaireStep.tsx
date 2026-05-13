import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { OnboardingData } from '@/contexts/OnboardingContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { VoiceIntroductionCard } from '@/components/onboarding/VoiceIntroductionCard';
import { VOICE_INTRO_MIN_SEC, VOICE_INTRO_MAX_SEC } from '@/services/voiceIntroRecording';
import {
  INTRODUCTION_QUESTIONS,
  emptyQuestionnaireState,
  validateQuestionnaire,
  type IntroductionQuestion,
} from '@/data/introductionQuestionnaire';

export function IntroductionQuestionnaireStep({
  data,
  updateData,
  onNext,
}: {
  data: OnboardingData;
  updateData: (p: Partial<OnboardingData>) => void;
  onNext: () => void;
}) {
  const { voiceIntroDraftRef } = useOnboarding();

  const responses = useMemo(
    () => ({ ...emptyQuestionnaireState(), ...(data.questionnaireResponses || {}) }),
    [data.questionnaireResponses],
  );

  const [touched, setTouched] = useState(false);

  function setField(id: string, value: string) {
    updateData({
      questionnaireResponses: {
        ...responses,
        [id]: value,
      },
    });
  }

  function handleNext() {
    setTouched(true);
    const draft = voiceIntroDraftRef.current;
    if (draft) {
      const d = draft.durationSec;
      if (d < VOICE_INTRO_MIN_SEC || d > VOICE_INTRO_MAX_SEC + 0.5) {
        return;
      }
    }
    const { ok } = validateQuestionnaire(responses);
    if (!ok) return;
    onNext();
  }

  const validation = validateQuestionnaire(responses);

  return (
    <div className="space-y-6 pb-4" dir="rtl">
      <div>
        <h2 className="text-[26px] md:text-[32px] font-bold text-foreground leading-tight">שאלון היכרות קצר</h2>
        <p className="text-muted-foreground text-[15px] mt-2 leading-relaxed">
          כמה שאלות פתוחות כדי שנכיר אתכם טוב יותר. התשובות נשמרות בפרופיל ומשמשות גם לבדיקת התאמה איכותית.
        </p>
      </div>

      <VoiceIntroductionCard />

      <div className="space-y-6">
        {INTRODUCTION_QUESTIONS.map((q, index) => (
          <QuestionField
            key={q.id}
            question={q}
            index={index}
            value={responses[q.id] || ''}
            onChange={(v) => setField(q.id, v)}
            showError={touched && !fieldOk(q, responses[q.id] || '')}
          />
        ))}
      </div>

      {touched && !validation.ok && (
        <p className="text-sm text-destructive text-center">{validation.errors[0]}</p>
      )}

      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        onClick={handleNext}
        className="w-full h-14 rounded-full font-semibold text-lg text-primary-foreground shadow-lg transition-opacity"
        style={{
          background: validation.ok || !touched
            ? 'linear-gradient(135deg, hsl(263 84% 55%), hsl(271 81% 56%))'
            : 'hsl(var(--muted))',
          opacity: validation.ok || !touched ? 1 : 0.85,
        }}
      >
        המשך לאימות החשבון
      </motion.button>
    </div>
  );
}

function fieldOk(q: IntroductionQuestion, raw: string): boolean {
  const v = raw.trim();
  if (q.required && v.length < q.minLength) return false;
  if (v.length > q.maxLength) return false;
  return true;
}

function QuestionField({
  question: q,
  value,
  onChange,
  showError,
  index,
}: {
  question: IntroductionQuestion;
  value: string;
  onChange: (v: string) => void;
  showError: boolean;
  index: number;
}) {
  const len = value.length;
  const nearLimit = len > q.maxLength - 20;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2) }}
      className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 md:p-5 space-y-2 shadow-sm"
    >
      <label className="block">
        <span className="text-[15px] font-semibold text-foreground leading-snug">{q.title}</span>
        {q.required && <span className="text-destructive text-sm mr-1">*</span>}
      </label>
      {q.hint && <p className="text-xs text-muted-foreground leading-relaxed">{q.hint}</p>}

      {q.type === 'textarea' && (
        <>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={q.maxLength}
            rows={q.maxLength > 350 ? 5 : 4}
            placeholder={q.placeholder}
            className={`w-full rounded-xl border bg-background px-3 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground/60 resize-y min-h-[100px] transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
              showError ? 'border-destructive' : 'border-border'
            }`}
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>
              {q.required ? `מינימום ${q.minLength} תווים` : 'אופציונלי'}
            </span>
            <span className={nearLimit ? 'text-amber-600 dark:text-amber-400' : ''}>
              {len} / {q.maxLength}
            </span>
          </div>
        </>
      )}

      {q.type === 'select' && q.options && (
        <div className="space-y-2 pt-1">
          {q.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`w-full text-right rounded-xl border px-3 py-3 text-sm font-medium transition-all ${
                value === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background hover:border-primary/40'
              } ${showError && !value ? 'border-destructive/60' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
