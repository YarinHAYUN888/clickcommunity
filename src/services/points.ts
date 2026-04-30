import { supabase } from '@/integrations/supabase/client';
import { getProfileStats } from '@/services/profile';

export async function invokeAwardTenurePoints() {
  const { data, error } = await supabase.functions.invoke('award-tenure-points');
  if (error) throw error;
  return data as {
    success?: boolean;
    granted_blocks?: number;
    awarded_points?: number;
    skipped?: string;
  };
}

export async function claimSignupRewards(referralCode?: string | null) {
  const { data, error } = await supabase.functions.invoke('claim-signup-rewards', {
    body: { referral_code: referralCode?.trim() || null },
  });
  if (error) throw error;
  return data as {
    success?: boolean;
    profile_bonus_granted?: boolean;
    referral_granted?: boolean;
    referral_skip_reason?: string | null;
  };
}

export async function getMyPoints(userId: string) {
  const { data, error } = await supabase.from('profiles').select('points').eq('user_id', userId).single();
  if (error) throw error;
  return data?.points ?? 0;
}

export async function getPointsHistory(userId: string, limit = 25) {
  const { data, error } = await supabase
    .from('points_history')
    .select('id, type, amount, description, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getMyReferralCode(userId: string) {
  const { data, error } = await supabase.from('profiles').select('referral_code').eq('user_id', userId).single();
  if (error) throw error;
  return data?.referral_code ?? null;
}

export async function getReferralStats(userId: string) {
  const s = await getProfileStats(userId);
  return {
    code: s.referral_code as string | null,
    cap: s.referral_cap as number,
    thisMonth: s.referrals_this_month as number,
    remaining: s.referrals_remaining as number,
    joined: s.referrals_joined_count as number,
    pointsFromReferrals: s.referral_points_earned as number,
    disabled: Boolean(s.referral_disabled),
  };
}

export async function fetchReferrerPreview(code: string) {
  const trimmed = code.trim();
  if (trimmed.length < 4) return null;
  const { data, error } = await supabase.functions.invoke('referral-preview', {
    body: { code: trimmed },
  });
  if (error) return null;
  return data as { first_name: string | null };
}
