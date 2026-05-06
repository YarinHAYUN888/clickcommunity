import { supabase } from '@/integrations/supabase/client';

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
      .upsert({ user_id: userId }, { onConflict: 'user_id' });
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
  console.info('[uploadOnboardingPhotosFromDataUrls] start', { userId, sourceCount: sources.length });
  const projectUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') ?? '';
  const out: string[] = [];
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    if (!s) continue;
    if (s.startsWith('data:') || s.startsWith('blob:')) {
      const res = await fetch(s);
      const blob = await res.blob();
      const mime = blob.type || 'image/jpeg';
      const sub = mime.split('/')[1]?.replace(/\+.*$/, '') || 'jpeg';
      const file = new File([blob], `onboarding-${i}.${sub}`, { type: mime });
      out.push(await uploadProfilePhoto(userId, file, i));
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
  console.info('[uploadOnboardingPhotosFromDataUrls] success', { userId, uploadedCount: out.length });
  return out;
}

export async function uploadProfilePhoto(userId: string, file: File, index: number) {
  console.info('[uploadProfilePhoto] start', { userId, index, fileName: file.name, fileType: file.type, size: file.size });
  if (!file.type.startsWith('image/')) {
    throw new Error('invalid_image_type');
  }
  if (file.size < 800) {
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
