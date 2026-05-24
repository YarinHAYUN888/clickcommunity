import type { VoiceIntroDraft } from '@/contexts/OnboardingContext';
import { supabase } from '@/integrations/supabase/client';
import { logOnboardingStep } from '@/lib/onboarding/onboardingFlowDebug';
import { resolvePostAuthRedirect, type PostAuthRoute } from '@/lib/routing/postAuthRedirect';
import { claimSignupRewards } from '@/services/points';
import {
  invokeCompleteRegistration,
  type CompleteRegistrationBody,
} from '@/services/completeRegistration';
import {
  ensureCommunityMemberDefaults,
  finalizeOnboardingProfile,
  type OnboardingDraft,
} from '@/services/profileSavePipeline';
import { runUserAnalysis } from '@/services/userSuitability';
import { uploadVoiceIntroAfterProfile } from '@/services/voiceIntroUpload';

const SESSION_WAIT_MS = 5000;
const SESSION_POLL_MS = 200;

export type PostOtpRegistrationResult = {
  userId: string;
  registrationCode: 'created' | 'already_exists';
  profileSyncFailed: boolean;
  photoUrls: string[];
  imageUploadStatus: 'pending' | 'success' | 'failed';
  sessionEstablished: boolean;
  route: PostAuthRoute;
};

async function waitForSession(timeoutMs: number): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
    await new Promise((r) => setTimeout(r, SESSION_POLL_MS));
  }
  return null;
}

/**
 * Establish session after Edge registration — Safari-safe: verify first, poll, then password fallback.
 */
export async function establishSession(
  tokenHash: string,
  email: string,
  password: string,
  registrationCode: 'created' | 'already_exists',
): Promise<{ userId: string; sessionEstablished: boolean }> {
  const {
    data: { session: existing },
  } = await supabase.auth.getSession();
  if (existing?.user?.email && existing.user.email.toLowerCase() !== email.toLowerCase()) {
    await supabase.auth.signOut({ scope: 'local' });
  }

  const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });

  if (!verifyErr && verifyData?.user?.id) {
    const polled = await waitForSession(SESSION_WAIT_MS);
    if (polled) {
      logOnboardingStep(4, { userId: polled, via: 'verifyOtp' });
      return { userId: polled, sessionEstablished: true };
    }
  }

  if (verifyErr) {
    console.warn('[establishSession] verifyOtp:', verifyErr.message, { registrationCode });
  }

  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (signInErr || !signInData.user?.id) {
    console.error('[establishSession] signInWithPassword failed:', signInErr);
    throw new Error('session_restore_failed');
  }

  const polled = await waitForSession(2000);
  const userId = polled ?? signInData.user.id;
  logOnboardingStep(4, { userId, via: 'signInWithPassword' });
  return { userId, sessionEstablished: true };
}

export type RunPostOtpOptions = {
  registrationBody: CompleteRegistrationBody;
  draft: OnboardingDraft;
  photoSources: string[];
  voiceBlob: VoiceIntroDraft;
  analysisPayload: Parameters<typeof runUserAnalysis>[0];
  referralCode?: string;
};

export async function runPostOtpRegistration(
  opts: RunPostOtpOptions,
): Promise<PostOtpRegistrationResult> {
  const { registrationBody, draft, photoSources, voiceBlob, analysisPayload, referralCode } =
    opts;

  const { tokenHash, code: registrationCode, userId: edgeUserId } =
    await invokeCompleteRegistration(registrationBody);
  logOnboardingStep(1, { registrationCode, userId: edgeUserId });

  const email = registrationBody.email;
  const password = registrationBody.password;

  const { userId } = await establishSession(tokenHash, email, password, registrationCode);
  await ensureCommunityMemberDefaults(userId);

  let profileSyncFailed = false;
  let photoUrls: string[] = [];
  let imageUploadStatus: 'pending' | 'success' | 'failed' = 'pending';

  try {
    const finalized = await finalizeOnboardingProfile(userId, draft, photoSources);
    profileSyncFailed = finalized.profileSyncFailed;
    photoUrls = finalized.photoUrls;
    imageUploadStatus = finalized.imageUploadStatus;
    logOnboardingStep(5, { profileSyncFailed, photoCount: photoUrls.length });
    logOnboardingStep(6, { imageUploadStatus });
  } catch (e) {
    console.error('[runPostOtpRegistration] finalize failed', e);
    profileSyncFailed = true;
    imageUploadStatus = photoSources.length > 0 ? 'pending' : 'pending';
  }

  if (voiceBlob) {
    try {
      await uploadVoiceIntroAfterProfile(userId, voiceBlob);
    } catch (voiceErr) {
      console.error('[runPostOtpRegistration] voice upload failed:', voiceErr);
    }
  }

  try {
    await runUserAnalysis({ ...analysisPayload, photos: photoUrls }, userId);
  } catch (analysisErr) {
    console.error('[runPostOtpRegistration] runUserAnalysis failed:', analysisErr);
  }

  const refRaw =
    referralCode?.trim() ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('clicks_ref_code') : null);
  try {
    await claimSignupRewards(refRaw || undefined);
    try {
      localStorage.removeItem('clicks_ref_code');
    } catch {
      /* ignore */
    }
  } catch (e) {
    console.warn('[runPostOtpRegistration] claim-signup-rewards:', e);
  }

  logOnboardingStep(7, { userId });

  const { route } = await resolvePostAuthRedirect(userId);
  logOnboardingStep(8, { route });

  return {
    userId,
    registrationCode,
    profileSyncFailed,
    photoUrls,
    imageUploadStatus,
    sessionEstablished: true,
    route,
  };
}

/** If auth succeeded but UI errored — finalize idempotently and return redirect route. */
export async function tryRecoverSessionAfterFailure(
  draft: OnboardingDraft,
  photoSources: string[],
  email: string,
  password: string,
  _registrationCode?: 'created' | 'already_exists',
): Promise<{ recovered: true; userId: string; route: PostAuthRoute; profileSyncFailed: boolean } | { recovered: false }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user?.id) {
    await ensureCommunityMemberDefaults(session.user.id);
    let profileSyncFailed = false;
    try {
      const r = await finalizeOnboardingProfile(session.user.id, draft, photoSources);
      profileSyncFailed = r.profileSyncFailed;
    } catch {
      profileSyncFailed = true;
    }
    const { route } = await resolvePostAuthRedirect(session.user.id);
    return { recovered: true, userId: session.user.id, route, profileSyncFailed };
  }

  if (email && password) {
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (!error && signInData.user?.id) {
      await ensureCommunityMemberDefaults(signInData.user.id);
      let profileSyncFailed = false;
      try {
        const r = await finalizeOnboardingProfile(signInData.user.id, draft, photoSources);
        profileSyncFailed = r.profileSyncFailed;
      } catch {
        profileSyncFailed = true;
      }
      const { route } = await resolvePostAuthRedirect(signInData.user.id);
      return { recovered: true, userId: signInData.user.id, route, profileSyncFailed };
    }
  }

  return { recovered: false };
}
