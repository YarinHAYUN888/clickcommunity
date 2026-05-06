import { supabase } from '@/integrations/supabase/client';
import { analyzeUser, type ProfileAnalysisInput } from '@/lib/ai/analyzeUser';
import { analyzePrimaryPhotos } from '@/lib/ai/analyzeImage';
import { runDecisionEngine } from '@/lib/user/decisionEngine';

export interface RunUserAnalysisPayload extends ProfileAnalysisInput {
  /** Public or data URLs after onboarding upload */
  photos?: string[];
}

/**
 * After OTP: AI + image checks, persist suitability fields on profiles (by auth user_id).
 */
export async function runUserAnalysis(profileData: RunUserAnalysisPayload, authUserId: string): Promise<void> {
  console.info('[runUserAnalysis] start', { authUserId });
  const [aiResult, imageResult] = await Promise.all([
    analyzeUser({
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      bio: profileData.bio,
      occupation: profileData.occupation,
      interests: profileData.interests,
      region: profileData.region,
      regionOther: profileData.regionOther,
      instagram: profileData.instagram,
      tiktok: profileData.tiktok,
      gender: profileData.gender,
      questionnaireResponses: profileData.questionnaireResponses,
    }),
    analyzePrimaryPhotos(profileData.photos || []),
  ]);

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
  console.info('[runUserAnalysis] success', { authUserId, moderationStatus, suitability: decision.status });
}
