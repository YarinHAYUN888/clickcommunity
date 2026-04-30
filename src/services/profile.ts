import { supabase } from '@/integrations/supabase/client';

export async function getMyProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, date_of_birth, gender, occupation, bio, photos, interests, status, role, profile_completion, created_at')
    .eq('user_id', userId)
    .single();
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

export async function uploadProfilePhoto(userId: string, file: File, index: number) {
  const fileExt = file.name.split('.').pop();
  const filePath = `${userId}/${index}-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('photos').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function deleteProfilePhoto(photoUrl: string) {
  const path = photoUrl.split('/photos/')[1];
  if (!path) return;

  const { error } = await supabase.storage.from('photos').remove([path]);
  if (error) throw error;
}
