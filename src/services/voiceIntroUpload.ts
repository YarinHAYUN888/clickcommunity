import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { VoiceIntroDraft } from '@/contexts/OnboardingContext';
import { extensionForMime } from '@/services/voiceIntroRecording';

/**
 * After profile upsert + auth session exists. Never throws — signup must complete.
 * Writes voice_intro_status failed on any failure; uploaded + path on success.
 */
export async function uploadVoiceIntroAfterProfile(
  userId: string,
  draft: VoiceIntroDraft,
): Promise<void> {
  if (!draft || !draft.blob || draft.blob.size < 1) {
    console.info('[voiceIntroUpload] skip_no_draft', { userId });
    return;
  }

  const duration = draft.durationSec;
  if (duration < 9.5 || duration > 90.5) {
    console.warn('[voiceIntroUpload] skip_invalid_duration', { userId, duration });
    return;
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

    toast.message('לא הצלחנו לשמור את ההקלטה הקולית כרגע. אפשר להמשיך — תמיד אפשר לעדכן בהמשך מהפרופיל.');
  }
}
