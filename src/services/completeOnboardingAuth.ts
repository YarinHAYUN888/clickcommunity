import type { VoiceIntroDraft } from '@/contexts/OnboardingContext';
import { supabase } from '@/integrations/supabase/client';
import { logOnboardingStep } from '@/lib/onboarding/onboardingFlowDebug';
import {
  isLikelyMobileSafari,
  logAuthCompletionStep,
  type AuthCompletionFailureStage,
} from '@/lib/onboarding/authCompletionDebug';
import { resolvePostAuthRedirect, type PostAuthRoute } from '@/lib/routing/postAuthRedirect';
import { claimSignupRewards } from '@/services/points';
import {
  invokeCompleteRegistration,
  type CompleteRegistrationBody,
  type RegistrationInvokeResult,
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
  failedSlots: number[];
  partialFailure: boolean;
  imageUploadStatus: 'pending' | 'success' | 'failed';
  sessionEstablished: boolean;
  route: PostAuthRoute;
  failureStage?: AuthCompletionFailureStage;
};

async function waitForSession(timeoutMs: number): Promise<string | null> {
  return await new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    let finished = false;

    const done = (userId: string | null) => {
      if (finished) return;
      finished = true;
      subscription.data.subscription.unsubscribe();
      resolve(userId);
    };

    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) done(session.user.id);
    });

    const loop = async () => {
      while (!finished && Date.now() < deadline) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user?.id) {
          done(session.user.id);
          return;
        }
        await new Promise((r) => setTimeout(r, SESSION_POLL_MS));
      }
      done(null);
    };

    void loop();
  });
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
  const emailNorm = email.trim().toLowerCase();
  if (existing?.user?.id && existing.user.email?.toLowerCase() === emailNorm) {
    logOnboardingStep(4, { userId: existing.user.id, via: 'existing_session' });
    logAuthCompletionStep(2, { userId: existing.user.id, via: 'existing_session' });
    return { userId: existing.user.id, sessionEstablished: true };
  }
  if (existing?.user?.email && existing.user.email.toLowerCase() !== emailNorm) {
    await supabase.auth.signOut({ scope: 'local' });
  }

  const waitMs = isLikelyMobileSafari() ? 8000 : SESSION_WAIT_MS;
  const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });

  if (!verifyErr && verifyData?.user?.id) {
    const polled = await waitForSession(waitMs);
    if (polled) {
      logOnboardingStep(4, { userId: polled, via: 'verifyOtp' });
      logAuthCompletionStep(2, { userId: polled, via: 'verifyOtp' });
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
  logAuthCompletionStep(2, { userId, via: 'signInWithPassword' });
  return { userId, sessionEstablished: true };
}

async function recoverSessionForInvokeFailure(
  invokeResult: RegistrationInvokeResult,
  email: string,
  password: string,
): Promise<{ userId: string; registrationCode: 'created' | 'already_exists' } | null> {
  if (invokeResult.ok || !invokeResult.recoverable) return null;
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.user?.id) return null;
  logAuthCompletionStep(2, { via: 'recover_signin', userId: data.user.id });
  return { userId: data.user.id, registrationCode: 'already_exists' };
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

  const email = registrationBody.email;
  const password = registrationBody.password;
  console.log('onboarding start', { email, photoSourceCount: photoSources.length });
  logAuthCompletionStep(1, { phase: 'start', email });

  const invokeResult = await invokeCompleteRegistration(registrationBody);
  let userId = '';
  let registrationCode: 'created' | 'already_exists' = 'created';

  if (invokeResult.ok) {
    registrationCode = invokeResult.code;
    logOnboardingStep(1, { registrationCode, userId: invokeResult.userId });
    const sessionRes = await establishSession(invokeResult.tokenHash, email, password, registrationCode);
    userId = sessionRes.userId;
  } else {
    const recovered = await recoverSessionForInvokeFailure(invokeResult, email, password);
    if (!recovered) {
      throw new Error('registration_invoke_transport');
    }
    userId = recovered.userId;
    registrationCode = recovered.registrationCode;
  }

  await ensureCommunityMemberDefaults(userId);

  let profileSyncFailed = false;
  let photoUrls: string[] = [];
  let failedSlots: number[] = [];
  let partialFailure = false;
  let imageUploadStatus: 'pending' | 'success' | 'failed' = 'pending';

  try {
    const finalized = await finalizeOnboardingProfile(userId, draft, photoSources);
    profileSyncFailed = finalized.profileSyncFailed;
    photoUrls = finalized.photoUrls;
    failedSlots = finalized.failedSlots;
    partialFailure = finalized.partialFailure;
    imageUploadStatus = finalized.imageUploadStatus;
    logAuthCompletionStep(3, { userId, profileSyncFailed });
    logAuthCompletionStep(4, { imageUploadStatus, photoCount: photoUrls.length });
    logOnboardingStep(5, { profileSyncFailed, photoCount: photoUrls.length });
    logOnboardingStep(6, { imageUploadStatus });
  } catch (e) {
    console.error('[runPostOtpRegistration] finalize failed', e);
    profileSyncFailed = true;
    imageUploadStatus = photoSources.length > 0 ? 'failed' : 'pending';
  }

  // Fail-safe: do not continue onboarding flow when critical profile DB save failed.
  if (profileSyncFailed) {
    throw new Error('profile_save_failed');
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

  logAuthCompletionStep(5, { userId });
  logOnboardingStep(7, { userId });

  const { route } = await resolvePostAuthRedirect(userId);
  console.log('redirect stage', { userId, route });
  await waitForSession(500);
  logAuthCompletionStep(6, { route });
  logOnboardingStep(8, { route });

  return {
    userId,
    registrationCode,
    profileSyncFailed,
    photoUrls,
    failedSlots,
    partialFailure,
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
): Promise<
  | {
      recovered: true;
      userId: string;
      route: PostAuthRoute;
      profileSyncFailed: boolean;
      photoUrls: string[];
      partialFailure: boolean;
      imageUploadStatus: 'pending' | 'success' | 'failed';
    }
  | { recovered: false }
> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user?.id) {
    await ensureCommunityMemberDefaults(session.user.id);
    let profileSyncFailed = false;
    let photoUrls: string[] = [];
    let partialFailure = false;
    let imageUploadStatus: 'pending' | 'success' | 'failed' = 'pending';
    try {
      const r = await finalizeOnboardingProfile(session.user.id, draft, photoSources);
      profileSyncFailed = r.profileSyncFailed;
      photoUrls = r.photoUrls;
      partialFailure = r.partialFailure;
      imageUploadStatus = r.imageUploadStatus;
    } catch {
      profileSyncFailed = true;
      imageUploadStatus = photoSources.length > 0 ? 'failed' : 'pending';
    }
    const { route } = await resolvePostAuthRedirect(session.user.id);
    return {
      recovered: true,
      userId: session.user.id,
      route,
      profileSyncFailed,
      photoUrls,
      partialFailure,
      imageUploadStatus,
    };
  }

  if (email && password) {
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (!error && signInData.user?.id) {
      await ensureCommunityMemberDefaults(signInData.user.id);
      let profileSyncFailed = false;
      let photoUrls: string[] = [];
      let partialFailure = false;
      let imageUploadStatus: 'pending' | 'success' | 'failed' = 'pending';
      try {
        const r = await finalizeOnboardingProfile(signInData.user.id, draft, photoSources);
        profileSyncFailed = r.profileSyncFailed;
        photoUrls = r.photoUrls;
        partialFailure = r.partialFailure;
        imageUploadStatus = r.imageUploadStatus;
      } catch {
        profileSyncFailed = true;
        imageUploadStatus = photoSources.length > 0 ? 'failed' : 'pending';
      }
      const { route } = await resolvePostAuthRedirect(signInData.user.id);
      return {
        recovered: true,
        userId: signInData.user.id,
        route,
        profileSyncFailed,
        photoUrls,
        partialFailure,
        imageUploadStatus,
      };
    }
  }

  return { recovered: false };
}
