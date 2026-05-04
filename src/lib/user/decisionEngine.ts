import type { SuitabilityLabel } from '@/lib/ai/analyzeUser';
import type { AnalyzeImageResult } from '@/lib/ai/analyzeImage';

export type UserSuitabilityState = 'active' | 'pending' | 'shadow' | 'blocked';

export interface DecisionEngineInput {
  label: SuitabilityLabel;
  image: AnalyzeImageResult;
}

export interface DecisionEngineOutput {
  status: UserSuitabilityState;
  is_shadow: boolean;
  risk_flags: string[];
  ai_summary: string;
}

/**
 * not_fit or borderline → needs human review (pending)
 * Image invalid → pending
 * Combined highest risk + image invalid → shadow
 * fit only → active
 */
export function runDecisionEngine(ai: DecisionEngineInput): DecisionEngineOutput {
  const needsAiReview = ai.label === 'not_fit' || ai.label === 'borderline';
  const badImg = !ai.image.valid;

  const risk_flags: string[] = [];
  if (ai.label === 'not_fit') risk_flags.push('ai_label_not_fit');
  if (ai.label === 'borderline') risk_flags.push('ai_label_borderline');
  if (badImg) risk_flags.push('image_validation_failed');

  let status: UserSuitabilityState;
  let is_shadow = false;

  if (ai.label === 'not_fit' && badImg) {
    status = 'shadow';
    is_shadow = true;
  } else if (needsAiReview || badImg) {
    status = 'pending';
  } else {
    status = 'active';
  }

  const parts: string[] = [];
  if (needsAiReview) parts.push(`סיווג AI: ${ai.label}`);
  if (badImg) parts.push(`תמונה: ${ai.image.reason}`);
  const ai_summary = parts.join(' | ') || 'אין הערות';

  return { status, is_shadow, risk_flags, ai_summary };
}
