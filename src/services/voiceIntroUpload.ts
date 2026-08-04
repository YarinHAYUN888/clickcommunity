import { supabase } from '@/integrations/supabase/client';
import type { VoiceIntroDraft } from '@/contexts/OnboardingContext';
import { extensionForMime, VOICE_INTRO_MIN_SEC, VOICE_INTRO_MAX_SEC } from '@/services/voiceIntroRecording';

/**
 * After auth session exists. Uploads voice intro under auth uid folder.
 * Returns false when draft missing, invalid, or upload fails — never pretends success.
 * Idempotent enough for retries: new path each attempt; profile path overwritten on success.
 */
export async function uploadVoiceIntroAfterProfile(
  userId: string,
  draft: VoiceIntroDraft,
): Promise<boolean> {
  if (!draft || !draft.blob || draft.blob.size < 1) {
    console.info('[voiceIntroUpload] missing_draft', { userId });
    return false;
  }

  const duration = draft.durationSec;
  if (duration < VOICE_INTRO_MIN_SEC - 0.5 || duration > VOICE_INTRO_MAX_SEC + 0.5) {
    console.warn('[voiceIntroUpload] invalid_duration', { userId, duration });
    return false;
  }

  // Already uploaded for this session? Skip re-upload if profile already has a playable intro.
  try {
    const { data: existing } = await supabase
      .from('profiles')
      .select('voice_intro_url, voice_intro_status')
      .eq('user_id', userId)
      .maybeSingle();
    if (
      existing?.voice_intro_status === 'uploaded' &&
      typeof existing.voice_intro_url === 'string' &&
      existing.voice_intro_url.startsWith(`${userId}/`)
    ) {
      console.info('[voiceIntroUpload] already_uploaded', { userId, path: existing.voice_intro_url });
      return true;
    }
  } catch {
    /* continue with upload */
  }

  const mime = draft.mimeType || draft.blob.type || 'audio/webm';
  const ext = extensionForMime(mime);
  const path = `${userId}/intro-${Date.now()}.${ext}`;
  const fileName = `intro.${ext}`;
  const file = new File([draft.blob], fileName, { type: mime });

  try {
    console.info('[voiceIntroUpload] status_pending', { userId });
    const { error: pendErr } = await supabase
      .from('profiles')
      .update({
        voice_intro_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (pendErr) {
      console.error('[voiceIntroUpload] pending_profile_update_failed', pendErr);
      throw pendErr;
    }

    console.info('[voiceIntroUpload] storage_upload_start', { userId, path, size: file.size });
    const { error: upErr } = await supabase.storage.from('voice-intros').upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    });

    if (upErr) {
      console.error('[voiceIntroUpload] storage_upload_failed', upErr);
      throw upErr;
    }

    const { error: saveErr } = await supabase
      .from('profiles')
      .update({
        voice_intro_url: path,
        voice_intro_duration: Math.round(duration),
        voice_intro_status: 'uploaded',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (saveErr) {
      console.error('[voiceIntroUpload] profile_save_failed', saveErr);
      throw saveErr;
    }

    console.info('[voiceIntroUpload] success', { userId, path, durationSec: Math.round(duration) });
    return true;
  } catch (err) {
    console.error('[voiceIntroUpload] failure', err);
    const { error: failErr } = await supabase
      .from('profiles')
      .update({
        voice_intro_status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (failErr) {
      console.error('[voiceIntroUpload] failed_status_update_error', failErr);
    }

    return false;
  }
}
