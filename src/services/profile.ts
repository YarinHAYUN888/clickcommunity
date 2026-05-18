import { supabase } from '@/integrations/supabase/client';

const HEIC_MIME = new Set(['image/heic', 'image/heif', 'image/heif-sequence', 'image/heic-sequence']);

function looksLikeHeic(file: File | Blob, nameHint = ''): boolean {
  const t = (file.type || '').toLowerCase();
  if (HEIC_MIME.has(t)) return true;
  return /\.(heic|heif)$/i.test(nameHint);
}

/** Convert HEIC/HEIF to JPEG for browsers that cannot upload HEIC to storage as-is (e.g. iPhone Safari). */
async function heicLikeToJpegFile(blob: Blob, index: number): Promise<File> {
  const heic2any = (await import('heic2any')).default;
  const converted = await heic2any({ blob, toType: 'image/jpeg', quality: 0.88 });
  const outBlob = Array.isArray(converted) ? converted[0] : converted;
  return new File([outBlob], `onboarding-${index}.jpeg`, { type: 'image/jpeg' });
}

/** Downscale large JPEG/PNG/WebP for faster upload and stable storage. */
async function downscaleImageFileIfLarge(file: File, maxDim = 1920, quality = 0.86): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file;
  if (file.size < 750_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const w = bmp.width;
    const h = bmp.height;
    if (w <= maxDim && h <= maxDim) {
      bmp.close();
      return file;
    }
    const scale = Math.min(maxDim / w, maxDim / h, 1);
    const nw = Math.max(1, Math.round(w * scale));
    const nh = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = nw;
    canvas.height = nh;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bmp.close();
      return file;
    }
    ctx.drawImage(bmp, 0, 0, nw, nh);
    bmp.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '-opt.jpg', { type: 'image/jpeg' });
  } catch (e) {
    console.warn('[downscaleImageFileIfLarge] skipped', e);
    return file;
  }
}

/** Normalize to a JPEG-ish File safe for Supabase Storage + mobile Safari. */
export async function prepareImageFileForUpload(file: File, index: number): Promise<File> {
  let f = file;
  if (looksLikeHeic(f, f.name)) {
    try {
      f = await heicLikeToJpegFile(f, index);
    } catch (e) {
      console.error('[prepareImageFileForUpload] HEIC conversion failed', e);
      throw e;
    }
  }
  return downscaleImageFileIfLarge(f);
}

export async function getMyProfile(userId: string) {
  let { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('getMyProfile:', error.message, error);
    throw error;
  }
  if (!data) {
    const { error: upsertErr } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          moderation_status: 'pending',
          suitability_status: 'active',
          is_shadow: false,
          profile_completed: false,
          image_upload_status: 'pending',
        },
        { onConflict: 'user_id' },
      );
    if (!upsertErr) {
      const again = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (!again.error) data = again.data;
    }
  }
  return data;
}

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, date_of_birth, gender, occupation, bio, photos, interests, status, role, profile_completion, created_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, updates: {
  first_name?: string;
  occupation?: string;
  life_niche?: string | null;
  bio?: string;
  photos?: string[];
  interests?: string[];
}) {
  const { data, error } = await supabase.functions.invoke('update-profile', {
    body: { user_id: userId, ...updates }
  });
  if (error) throw error;
  return data;
}

export async function getProfileStats(userId: string) {
  const { data, error } = await supabase.functions.invoke('get-profile-stats', {
    body: { user_id: userId }
  });
  if (error) throw error;
  return data;
}

export async function getSubscription(userId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function checkSubscriptionEligibility(userId: string) {
  const { data, error } = await supabase.functions.invoke('check-subscription-eligibility', {
    body: { user_id: userId }
  });
  if (error) throw error;
  return data;
}

export async function createReferral(referrerId: string, method: 'phone' | 'email', contact: string) {
  const { data, error } = await supabase.functions.invoke('create-referral', {
    body: { referrer_id: referrerId, method, contact }
  });
  if (error) throw error;
  return data;
}

export async function cancelSubscription(userId: string) {
  const { data, error } = await supabase.functions.invoke('cancel-subscription', {
    body: { user_id: userId }
  });
  if (error) throw error;
  return data;
}

/** Upload onboarding image sources: data URLs become files in Storage; existing project public URLs pass through. */
export async function uploadOnboardingPhotosFromDataUrls(userId: string, sources: string[]): Promise<string[]> {
  const validSources = sources.filter((s) => typeof s === 'string' && s.length > 0);
  console.info('[uploadOnboardingPhotosFromDataUrls] start', { userId, sourceCount: validSources.length });
  const projectUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') ?? '';
  const out: string[] = [];
  const errors: { index: number; message: string }[] = [];
  for (let i = 0; i < validSources.length; i++) {
    const s = validSources[i];
    if (s.startsWith('data:') || s.startsWith('blob:')) {
      try {
        const res = await fetch(s);
        const blob = await res.blob();
        const mime = blob.type || 'image/jpeg';
        const sub = mime.split('/')[1]?.replace(/\+.*$/, '') || 'jpeg';
        const rawFile = new File([blob], `onboarding-${i}.${sub}`, { type: mime });
        const file = await prepareImageFileForUpload(rawFile, i);
        out.push(await uploadProfilePhoto(userId, file, i));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn('[uploadOnboardingPhotosFromDataUrls] slot failed', { userId, index: i, message });
        errors.push({ index: i, message });
      }
      continue;
    }
    const isProjectPublic =
      projectUrl &&
      (s.startsWith(`${projectUrl}/storage/`) || s.includes('/storage/v1/object/public/photos/'));
    if (isProjectPublic) {
      out.push(s);
      continue;
    }
    out.push(s);
  }
  console.info('[uploadOnboardingPhotosFromDataUrls] done', { userId, uploadedCount: out.length });
  if (validSources.length > 0 && out.length === 0) {
    const detail = errors.map((e) => `#${e.index}: ${e.message}`).join('; ');
    throw new Error(detail ? `photo_upload_failed:${detail}` : 'photo_upload_failed');
  }
  return out;
}

export async function uploadProfilePhoto(userId: string, file: File, index: number) {
  console.info('[uploadProfilePhoto] start', { userId, index, fileName: file.name, fileType: file.type, size: file.size });
  if (!file.type.startsWith('image/')) {
    throw new Error('invalid_image_type');
  }
  if (file.size < 400) {
    throw new Error('image_too_small');
  }
  const fileExt = file.name.split('.').pop();
  const filePath = `${userId}/${index}-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.error('[uploadProfilePhoto] upload failed', { userId, index, filePath, error: uploadError.message });
    throw uploadError;
  }

  const { data } = supabase.storage.from('photos').getPublicUrl(filePath);
  console.info('[uploadProfilePhoto] success', { userId, index, filePath, publicUrl: data.publicUrl });
  return data.publicUrl;
}

export async function deleteProfilePhoto(photoUrl: string) {
  const path = photoUrl.split('/photos/')[1];
  if (!path) return;

  const { error } = await supabase.storage.from('photos').remove([path]);
  if (error) throw error;
}
