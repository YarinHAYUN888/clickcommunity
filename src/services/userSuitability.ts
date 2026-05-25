import { supabase } from '@/integrations/supabase/client';
import { analyzeUser, type ProfileAnalysisInput, type AnalyzeUserResult } from '@/lib/ai/analyzeUser';
import { analyzePrimaryPhotos } from '@/lib/ai/analyzeImage';
import { runDecisionEngine } from '@/lib/user/decisionEngine';

export interface RunUserAnalysisPayload extends ProfileAnalysisInput {
  /** Public or data URLs after onboarding upload */
  photos?: string[];
}

async function analyzeViaEdge(
  profileData: RunUserAnalysisPayload,
  authUserId: string,
): Promise<AnalyzeUserResult | null> {
  const { data, error } = await supabase.functions.invoke('analyze-registration-suitability', {
    body: {
      user_id: authUserId,
      profile: profileData,
    },
  });
  if (error) {
    if (import.meta.env.DEV) console.warn('[analyze-registration-suitability]', error);
    return null;
  }
  const body = data as { ok?: boolean; result?: AnalyzeUserResult };
  if (!body?.ok || !body.result) return null;
  const r = body.result;
  if (
    typeof r.score === 'number' &&
    (r.label === 'fit' || r.label === 'borderline' || r.label === 'not_fit')
  ) {
    return r;
  }
  return null;
}

/**
 * After OTP: AI + image checks, persist suitability fields on profiles (by auth user_id).
 */
export async function runUserAnalysis(
  profileData: RunUserAnalysisPayload,
  authUserId: string,
): Promise<void> {
  if (import.meta.env.DEV) console.info('[runUserAnalysis] start', { authUserId });

  let aiResult: AnalyzeUserResult;
  if (import.meta.env.DEV) {
    const edge = await analyzeViaEdge(profileData, authUserId);
    aiResult = edge ?? (await analyzeUser(profileData));
  } else {
    const edge = await analyzeViaEdge(profileData, authUserId);
    if (!edge) {
      throw new Error('suitability_analysis_unavailable');
    }
    aiResult = edge;
  }

  const imageResult = await analyzePrimaryPhotos(profileData.photos || []);

  const decision = runDecisionEngine({
    label: aiResult.label,
    image: imageResult,
    aiDecision: aiResult.decision,
    aiConfidence: aiResult.confidence,
  });
  const risk_flags = [...decision.risk_flags, ...aiResult.flags.map((r) => `ai:${r}`)];
  const moderationStatus =
    decision.status === 'active'
      ? 'approved'
      : decision.status === 'blocked'
        ? 'rejected'
        : 'pending';

  const { error } = await supabase
    .from('profiles')
    .update({
      suitability_status: decision.status,
      is_shadow: decision.is_shadow,
      risk_flags,
      ai_summary: [decision.ai_summary, ...aiResult.reasons].filter(Boolean).join(' · '),
      moderation_status: moderationStatus,
      moderation_reason: aiResult.reason,
      moderation_confidence: aiResult.confidence,
      moderation_flags: aiResult.flags,
    })
    .eq('user_id', authUserId);

  if (error) {
    console.error('runUserAnalysis update failed:', error);
    throw error;
  }
  if (import.meta.env.DEV) {
    console.info('[runUserAnalysis] success', { authUserId, moderationStatus, suitability: decision.status });
  }
}
