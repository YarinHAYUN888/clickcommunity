import {
  questionnaireToReadableParagraphs,
  collectQuestionnaireLocalRiskReasons,
} from '@/data/introductionQuestionnaire';

export type SuitabilityLabel = 'fit' | 'borderline' | 'not_fit';

export interface AnalyzeUserResult {
  score: number;
  label: SuitabilityLabel;
  reasons: string[];
  decision: 'approved' | 'pending' | 'rejected';
  confidence: number;
  reason: string;
  flags: string[];
}

export interface ProfileAnalysisInput {
  firstName?: string;
  lastName?: string;
  bio?: string;
  occupation?: string;
  interests?: string[];
  region?: string;
  regionOther?: string;
  instagram?: string;
  tiktok?: string;
  gender?: string;
  /** מפתחות יציבים (ids מהשאלון) — נשלח כ-JSON ל-OpenAI */
  questionnaireResponses?: Record<string, string>;
}

const PROMPT = `You are a strict gatekeeper for a serious, high-quality community. Be skeptical of jokes, tests, trolls, nonsense text, or junk profiles.

Analyze the following user profile for suitability to a serious, high-quality community.

The JSON may include questionnaireResponses (short intro questionnaire: free text + one select). Use these answers as a primary signal for seriousness, coherence, and fit — not only bio/interests.

Consider:

Are the interests relevant and coherent?
Is the text meaningful or low-effort?
Does the profile appear serious or troll-like?
Are there inconsistencies?

Return JSON only:

{
"score": number (0-100),
"label": "fit" | "borderline" | "not_fit",
"reasons": string[],
"decision": "approved" | "pending" | "rejected",
"confidence": number (0-1),
"reason": string,
"flags": string[]
}`;

/** Local signals when OpenAI is unavailable — catches obvious test/troll/junk patterns. */
function collectLocalRiskReasons(input: ProfileAnalysisInput): string[] {
  const reasons: string[] = [];
  const questionnaireBlock =
    input.questionnaireResponses && Object.keys(input.questionnaireResponses).length > 0
      ? questionnaireToReadableParagraphs(input.questionnaireResponses)
      : '';
  const joinText = [
    input.firstName,
    input.lastName,
    input.bio,
    input.occupation,
    input.regionOther,
    input.instagram,
    input.tiktok,
    questionnaireBlock,
  ]
    .filter(Boolean)
    .join(' ');

  const testMarkers = [
    /\btest\b/i, /\bxxx\b/i, /\blasdf/i, /\bqwer/i, /טסט/, /בדיקה/, /מזעזע/, /מבחן/,
    /משתמש מוזר/, /משוגע/, /הפקעה/, /spam/i, /fake/i, /nonsense/i,
  ];
  for (const re of testMarkers) {
    if (re.test(joinText)) {
      reasons.push('מילות מפתח או דפוסים התואמים בדיקה/ספאם/סתם');
      break;
    }
  }

  const first = (input.firstName || '').trim();
  const last = (input.lastName || '').trim();
  if (first.length > 0 && first.length < 2) {
    reasons.push('שם פרטי קצר או לא סביר');
  }
  if (/(.)\1{4,}/u.test(joinText)) {
    reasons.push('חזרות תווים חשודות');
  }
  if (joinText.length > 15) {
    const letters = joinText.replace(/\s/g, '').split('');
    const unique = new Set(letters).size;
    if (letters.length > 12 && unique < 5) {
      reasons.push('טקסט דל שונות (אותיות חוזרות מדי)');
    }
  }

  const nonAlnumRatio = joinText.replace(/[\s\u0590-\u05FF\uFB1D-\uFB4Fa-z0-9@._/#-]/gi, '').length;
  const denom = Math.max(joinText.replace(/\s/g, '').length, 1);
  if (denom > 8 && nonAlnumRatio / denom > 0.35) {
    reasons.push('שפע תווים מיוחדים / פחות תוכן משמעותי');
  }

  const interests = (input.interests || []).filter(Boolean);
  if (interests.length >= 3) {
    const labels = interests.map((i) => i.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase());
    const shortOrDup = labels.filter((l) => l.length <= 1).length;
    const setSize = new Set(labels).size;
    if (shortOrDup >= 2 || setSize < Math.max(2, interests.length - 1)) {
      reasons.push('תחומי עניין לא ברורים, כפולים או חסרי משמעות');
    }
  }

  if (interests.length > 0 && interests.length < 3) {
    reasons.push('פחות משלושה תחומי עניין או חסרים');
  }

  const textLen = [input.bio, input.occupation, input.firstName, questionnaireBlock].join(' ').trim().length;
  if (textLen < 25) {
    reasons.push('מעט מדי תוכן טקסטואלי משמעותי');
  }

  if (input.questionnaireResponses && Object.keys(input.questionnaireResponses).length > 0) {
    reasons.push(...collectQuestionnaireLocalRiskReasons(input.questionnaireResponses));
  }

  return [...new Set(reasons)];
}

function mockAnalyze(input: ProfileAnalysisInput): AnalyzeUserResult {
  const interests = (input.interests || []).filter(Boolean);
  const reasons: string[] = [];

  reasons.push(...collectLocalRiskReasons(input));

  if (interests.length < 3) {
    reasons.push('מעט מדי תחומי עניין או חסרים');
  }

  const severity = reasons.length;
  let score: number;
  if (severity >= 3) {
    score = 22;
  } else if (severity >= 2) {
    score = 38;
  } else if (severity === 1) {
    score = 52;
  } else {
    score = 78;
    reasons.push('לא זוהו דגלים מקומיים — מומלץ לוודא עם OpenAI בפרודקשן');
  }

  const label: SuitabilityLabel =
    score >= 72 ? 'fit' : score >= 48 ? 'borderline' : 'not_fit';

  const decision = label === 'fit' ? 'approved' : label === 'borderline' ? 'pending' : 'rejected';
  const confidence = Number((Math.max(0.35, Math.min(0.95, score / 100))).toFixed(3));
  const uniqReasons = [...new Set(reasons)];
  return {
    score,
    label,
    reasons: uniqReasons,
    decision,
    confidence,
    reason: uniqReasons[0] || 'mock_fallback',
    flags: uniqReasons,
  };
}

function parseJsonResponse(raw: string): AnalyzeUserResult | null {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const score = Number(j.score);
    const label = j.label as string;
    const reasons = Array.isArray(j.reasons) ? j.reasons.filter((r): r is string => typeof r === 'string') : [];
    if (!Number.isFinite(score) || score < 0 || score > 100) return null;
    if (label !== 'fit' && label !== 'borderline' && label !== 'not_fit') return null;

    const decisionRaw = String(j.decision || '').toLowerCase();
    const confidenceRaw = Number(j.confidence);
    const reasonRaw = typeof j.reason === 'string' ? j.reason.trim() : '';
    const flagsRaw = Array.isArray(j.flags) ? j.flags.filter((f): f is string => typeof f === 'string') : [];

    const fallbackDecision = label === 'fit' ? 'approved' : label === 'borderline' ? 'pending' : 'rejected';
    const decision =
      decisionRaw === 'approved' || decisionRaw === 'pending' || decisionRaw === 'rejected'
        ? decisionRaw
        : fallbackDecision;

    const confidence = Number.isFinite(confidenceRaw)
      ? Math.max(0, Math.min(1, confidenceRaw))
      : Number((score / 100).toFixed(3));

    return {
      score,
      label,
      reasons,
      decision,
      confidence,
      reason: reasonRaw || reasons[0] || 'no_reason_provided',
      flags: flagsRaw.length ? flagsRaw : reasons,
    };
  } catch {
    return null;
  }
}

export async function analyzeUser(input: ProfileAnalysisInput): Promise<AnalyzeUserResult> {
  const key = import.meta.env.VITE_OPENAI_API_KEY?.trim();
  const userContent = `${PROMPT}\n\nProfile JSON:\n${JSON.stringify(input, null, 2)}`;

  if (!key) {
    return mockAnalyze(input);
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You enforce strict community quality. Label "not_fit" for trolls, obvious tests, nonsense, or incoherent junk. Use "borderline" only when mostly fine but uncertain. "fit" only for clearly genuine profiles.',
          },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.15,
      }),
    });

    if (!res.ok) {
      console.warn('analyzeUser OpenAI HTTP', res.status);
      return mockAnalyze(input);
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return mockAnalyze(input);

    const parsed = parseJsonResponse(raw);
    if (!parsed) return mockAnalyze(input);

    const local = collectLocalRiskReasons(input);
    if (local.length >= 2 && parsed.label === 'fit') {
      return {
        score: Math.min(parsed.score, 44),
        label: 'not_fit',
        reasons: [...parsed.reasons, ...local],
        decision: 'rejected',
        confidence: Math.max(parsed.confidence, 0.75),
        reason: 'local_risk_override_high',
        flags: [...parsed.flags, ...local],
      };
    }
    if (local.length === 1 && parsed.label === 'fit' && parsed.score > 60) {
      return {
        score: Math.min(parsed.score, 55),
        label: 'borderline',
        reasons: [...parsed.reasons, ...local],
        decision: 'pending',
        confidence: Math.max(parsed.confidence, 0.6),
        reason: 'local_risk_override_medium',
        flags: [...parsed.flags, ...local],
      };
    }

    return parsed;
  } catch (e) {
    console.warn('analyzeUser error', e);
    return mockAnalyze(input);
  }
}
