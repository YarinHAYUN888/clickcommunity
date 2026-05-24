import { supabase } from '@/integrations/supabase/client';

const UPLOAD_TIMEOUT_MS = 45_000;
const UPLOAD_MAX_RETRIES = 2;

const HEIC_MIME = new Set(['image/heic', 'image/heif', 'image/heif-sequence', 'image/heic-sequence']);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

/** Compress a data URL before storing in memory (Safari onboarding). */
export async function compressDataUrlForUpload(dataUrl: string, maxDim = 1280, quality = 0.82): Promise<string> {
  if (!dataUrl.startsWith('data:image/')) return dataUrl;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const raw = new File([blob], 'compress-src.jpg', { type: blob.type || 'image/jpeg' });
    const prepared = await downscaleImageFileIfLarge(raw, maxDim, quality);
    if (prepared === raw && blob.size < 750_000) return dataUrl;
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(prepared);
    });
  } catch (e) {
    console.warn('[compressDataUrlForUpload] skipped', e);
    return dataUrl;
  }
}

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
          role: 'member',
          moderation_status: 'approved',
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

export type PhotoSlotResult = {
  slot: number;
  url?: string;
  error?: string;
};

/** Upload one photo slot with retries; does not throw on failure. */
export async function uploadPhotoSlot(
  userId: string,
  source: string | File,
  index: number,
): Promise<PhotoSlotResult> {
  const projectUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') ?? '';

  if (typeof source === 'string') {
    if (
      projectUrl &&
      (source.startsWith(`${projectUrl}/storage/`) || source.includes('/storage/v1/object/public/photos/'))
    ) {
      return { slot: index, url: source };
    }
    if (!source.startsWith('data:') && !source.startsWith('blob:')) {
      return { slot: index, url: source };
    }
  }

  let lastErr = '';
  for (let attempt = 0; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
    try {
      let file: File;
      if (source instanceof File) {
        file = await prepareImageFileForUpload(source, index);
      } else {
        const res = await fetch(source);
        const blob = await res.blob();
        const mime = blob.type || 'image/jpeg';
        const sub = mime.split('/')[1]?.replace(/\+.*$/, '') || 'jpeg';
        const rawFile = new File([blob], `onboarding-${index}.${sub}`, { type: mime });
        file = await prepareImageFileForUpload(rawFile, index);
      }
      const url = await withTimeout(
        uploadProfilePhoto(userId, file, index),
        UPLOAD_TIMEOUT_MS,
        `photo-${index}`,
      );
      const ok = await verifyPublicPhotoUrl(url);
      if (!ok) throw new Error('photo_url_not_reachable');
      return { slot: index, url };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      if (attempt < UPLOAD_MAX_RETRIES) await sleep(400 * (attempt + 1));
    }
  }
  return { slot: index, error: lastErr || 'upload_failed' };
}

export async function verifyPublicPhotoUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

/** Upload onboarding image sources: data URLs become files in Storage; existing project public URLs pass through. */
export async function uploadOnboardingPhotosFromDataUrls(userId: string, sources: string[]): Promise<string[]> {
  const validSources = sources.filter((s) => typeof s === 'string' && s.length > 0);
  console.info('[uploadOnboardingPhotosFromDataUrls] start', { userId, sourceCount: validSources.length });
  const out: string[] = [];
  const errors: { index: number; message: string }[] = [];
  for (let i = 0; i < validSources.length; i++) {
    const result = await uploadPhotoSlot(userId, validSources[i], i);
    if (result.url) out.push(result.url);
    else if (result.error) {
      console.warn('[uploadOnboardingPhotosFromDataUrls] slot failed', { userId, index: i, message: result.error });
      errors.push({ index: i, message: result.error });
    }
  }
  console.info('[uploadOnboardingPhotosFromDataUrls] done', { userId, uploadedCount: out.length });
  if (validSources.length > 0 && out.length === 0) {
    const detail = errors.map((e) => `#${e.index}: ${e.message}`).join('; ');
    throw new Error(detail ? `photo_upload_failed:${detail}` : 'photo_upload_failed');
  }
  return out;
}

export async function uploadProfilePhoto(userId: string, file: File, index: number) {
  const prepared = await prepareImageFileForUpload(file, index);
  console.info('[uploadProfilePhoto] start', {
    userId,
    index,
    fileName: prepared.name,
    fileType: prepared.type,
    size: prepared.size,
  });
  if (!prepared.type.startsWith('image/')) {
    throw new Error('invalid_image_type');
  }
  if (prepared.size < 400) {
    throw new Error('image_too_small');
  }
  const fileExt = prepared.name.split('.').pop() || 'jpg';
  const filePath = `${userId}/${index}-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(filePath, prepared, { upsert: true, contentType: prepared.type || 'image/jpeg' });

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
