import { supabase } from '@/integrations/supabase/client';
import { EVENT_ACCESS_MIN_INCOMING_CLICKS } from '@/config/clicks';

export type ProfileClickStats = {
  incoming_click_count: number;
  event_access_unlocked_at: string | null;
};

export const EMPTY_CLICK_STATS: ProfileClickStats = {
  incoming_click_count: 0,
  event_access_unlocked_at: null,
};

export function hasEventAccessFromStats(stats: ProfileClickStats | null | undefined): boolean {
  if (!stats) return false;
  if (stats.event_access_unlocked_at) return true;
  return stats.incoming_click_count >= EVENT_ACCESS_MIN_INCOMING_CLICKS;
}

function logClickStatsError(error: { code?: string; message?: string; details?: string; hint?: string }) {
  if (import.meta.env.DEV) {
    console.error('[clickStats] fetch failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  } else {
    console.warn('[clickStats] fetch failed', error.code ?? 'unknown', error.message ?? '');
  }
}

/** Returns empty stats when no row exists; throws only on real server/RLS/schema errors. */
export async function fetchMyClickStats(userId: string): Promise<ProfileClickStats> {
  const { data, error } = await supabase
    .from('profile_click_stats')
    .select('incoming_click_count, event_access_unlocked_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logClickStatsError(error);
    throw new Error('לא הצלחנו לטעון מספר הקליקים. נסה/י שוב.');
  }

  if (!data) {
    return { ...EMPTY_CLICK_STATS };
  }

  return {
    incoming_click_count: data.incoming_click_count ?? 0,
    event_access_unlocked_at: data.event_access_unlocked_at,
  };
}
