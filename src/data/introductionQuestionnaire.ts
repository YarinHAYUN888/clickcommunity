/**
 * שאלון היכרות בהרשמה — טקסט קצר + בחירה יחידה.
 * מזהים יציבים ל-DB ול-OpenAI (אל תשנה ids אחרי שיש נתונים בפרודקשן).
 */

export type IntroductionQuestionType = 'textarea' | 'select';

export interface IntroductionQuestion {
  id: string;
  title: string;
  hint?: string;
  type: IntroductionQuestionType;
  required: boolean;
  minLength: number;
  maxLength: number;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export const INTRODUCTION_QUESTIONS: IntroductionQuestion[] = [
  {
    id: 'community_pull',
    title: 'אם היינו צריכים לתת לחברים הכי טובים שלך לתאר אותך מה הם היו אומרים עלייך?',
    type: 'textarea',
    required: true,
    minLength: 20,
    maxLength: 500,
    placeholder: 'תאר/י בקצרה איך החברים הקרובים שלך רואים אותך',
  },
  {
    id: 'weekend_vibe',
    title: 'מה חסר לך היום שהיית רוצה למצוא בתוך הקליק?',
    type: 'textarea',
    required: true,
    minLength: 20,
    maxLength: 500,
    placeholder: 'מה היית רוצה לקבל מהקהילה ומהמפגשים',
  },
  {
    id: 'people_seek',
    title: 'מה לדעתך הופך אותך להתאמה טובה לקהילה שלנו?',
    type: 'textarea',
    required: true,
    minLength: 20,
    maxLength: 500,
    placeholder: 'ספר/י מה את/ה מביא/ה איתך לקהילה',
  },
];

export function emptyQuestionnaireState(): Record<string, string> {
  return Object.fromEntries(INTRODUCTION_QUESTIONS.map((q) => [q.id, '']));
}

/** טקסט אנושי להצגה ול-LLM */
export function questionnaireToReadableParagraphs(responses: Record<string, string>): string {
  return INTRODUCTION_QUESTIONS.map((q) => {
    const v = (responses[q.id] || '').trim();
    if (!v) return null;
    const label = q.type === 'select' ? optionLabel(q, v) : v;
    return `${q.title}\n${label}`;
  })
    .filter(Boolean)
    .join('\n\n');
}

function optionLabel(q: IntroductionQuestion, value: string): string {
  const opt = q.options?.find((o) => o.value === value);
  return opt ? `${opt.label} (${value})` : value;
}

export function formatQuestionnaireForAdmin(responses: unknown): { title: string; answer: string }[] {
  if (!responses || typeof responses !== 'object' || Array.isArray(responses)) return [];
  const r = responses as Record<string, string>;
  return INTRODUCTION_QUESTIONS.map((q) => {
    const raw = (r[q.id] || '').trim();
    if (!raw) return { title: q.title, answer: '—' };
    if (q.type === 'select' && q.options) {
      const opt = q.options.find((o) => o.value === raw);
      return { title: q.title, answer: opt?.label || raw };
    }
    return { title: q.title, answer: raw };
  });
}

/**
 * סימני חשד סכמתיים על תשובות השאלון (בלי OpenAI).
 * מתמזג ל-analyzeUser ויכול להוביל ל-borderline/not_fit ולסטטוס pending אצל מנהלים.
 */
export function collectQuestionnaireLocalRiskReasons(responses: Record<string, string>): string[] {
  const reasons: string[] = [];
  const textareaQuestions = INTRODUCTION_QUESTIONS.filter((q) => q.type === 'textarea');
  const texts = textareaQuestions
    .map((q) => (responses[q.id] || '').trim())
    .filter((t) => t.length > 0);

  const suspiciousHebrew =
    /סתם|בדיחה|טרול|לא אכפת|מה זה משנה|שטויות|משעמם|לא בא לי|סיפור חיים|בוא נראה|כמה אתם|כמה אתן|עונה את מה שביקשתם/i;
  const englishJunk =
    /\blorem\b|\bipsum\b|\bchatgpt\b|\bgpt\b|\brandom\b|\basdf\b|\bblah\b|\bwhatever\b|\bidk\b|\btest\s*user\b|\bignore\s*(previous|above)/i;

  for (const t of texts) {
    if (suspiciousHebrew.test(t)) {
      reasons.push('ניסוח בשאלון שמעיד על אי־רצינות או טרול');
      break;
    }
    if (englishJunk.test(t)) {
      reasons.push('ניסוח אנגלי חשוד או תבנית מילוי בשאלון');
      break;
    }
    if (/(!{4,}|\?{4,}|\.{8,})/.test(t)) {
      reasons.push('עומס סימני פיסוק חריג בשאלון');
      break;
    }
    const digitRatio = ((t.match(/\d/g) || []).length) / Math.max(t.length, 1);
    if (t.length > 24 && digitRatio > 0.35) {
      reasons.push('תשובת שאלון עם יחס ספרות גבוה');
      break;
    }
  }

  const normalized = texts.map((t) => t.replace(/\s+/g, ' ').trim().toLowerCase());
  if (normalized.length >= 2) {
    const uniq = new Set(normalized);
    if (uniq.size === 1) {
      reasons.push('כל תשובות הטקסט בשאלון זהות — חשד לטקסט גנרי');
    }
  }

  if (normalized.length >= 3) {
    let dupPairs = 0;
    for (let i = 0; i < normalized.length; i++) {
      for (let j = i + 1; j < normalized.length; j++) {
        if (normalized[i] === normalized[j]) dupPairs++;
      }
    }
    if (dupPairs >= 2) {
      reasons.push('חזרתיות גבוהה בין שדות השאלון');
    }
  }

  for (const t of texts) {
    if (t.length < 45) continue;
    const words = t.split(/\s+/).filter((w) => w.length > 0);
    if (words.length < 8) continue;
    const stems = words
      .map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase())
      .filter((w) => w.length > 0);
    if (stems.length < 8) continue;
    const uniqueStems = new Set(stems);
    if (uniqueStems.size / stems.length < 0.34) {
      reasons.push('תשובת שאלון דלה במילים שונות (חשד למילוי מינימלי)');
      break;
    }
  }

  for (const t of texts) {
    if (t.length < 30) continue;
    const words = t.split(/\s+/).filter((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length > 1);
    if (words.length < 10) continue;
    const counts = new Map<string, number>();
    for (const w of words) {
      const k = w.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
      if (k.length < 2) continue;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    let max = 0;
    for (const c of counts.values()) max = Math.max(max, c);
    if (max / words.length > 0.42) {
      reasons.push('חזרה מוגזמת על אותה מילה בתשובת שאלון');
      break;
    }
  }

  return [...new Set(reasons)];
}

export function validateQuestionnaire(responses: Record<string, string>): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const q of INTRODUCTION_QUESTIONS) {
    const raw = (responses[q.id] || '').trim();
    if (q.required && raw.length < q.minLength) {
      errors.push(`שדה חובה: ${q.title.slice(0, 40)}${q.title.length > 40 ? '…' : ''}`);
      continue;
    }
    if (!q.required && raw.length === 0) continue;
    if (raw.length > q.maxLength) {
      errors.push('תשובה ארוכה מדי באחד השדות');
    }
  }
  return { ok: errors.length === 0, errors };
}
