import { supabase } from '@/integrations/supabase/client';

export type CommunityVouchRow = {
  id: string;
  target_user_id: string;
  voucher_user_id: string;
  event_id: string | null;
  created_at: string;
};

export async function listRecentCommunityVouches(limit = 80): Promise<CommunityVouchRow[]> {
  const { data, error } = await supabase
    .from('community_vouches')
    .select('id, target_user_id, voucher_user_id, event_id, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[communityVouches]', error.message);
    return [];
  }
  return (data as CommunityVouchRow[]) ?? [];
}

/** חבר קהילה מאשר שראה "קליק" אמיתי עם מישהו שעדיין צובר אישורים */
export async function insertCommunityVouch(params: {
  targetUserId: string;
  voucherUserId: string;
  eventId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('community_vouches').insert({
    target_user_id: params.targetUserId,
    voucher_user_id: params.voucherUserId,
    event_id: params.eventId ?? null,
  });
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'כבר סימנת לאדם הזה' };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
