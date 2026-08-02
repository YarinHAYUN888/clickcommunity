import { supabase } from '@/integrations/supabase/client';
import { EVENT_ACCESS_MIN_INCOMING_CLICKS } from '@/config/clicks';

export type ProfileClickStats = {
  incoming_click_count: number;
  event_access_unlocked_at: string | null;
};

export function hasEventAccessFromStats(stats: ProfileClickStats | null | undefined): boolean {
  if (!stats) return false;
  if (stats.event_access_unlocked_at) return true;
  return stats.incoming_click_count >= EVENT_ACCESS_MIN_INCOMING_CLICKS;
}

export async function fetchMyClickStats(userId: string): Promise<ProfileClickStats> {
  const { data, error } = await supabase
    .from('profile_click_stats')
    .select('incoming_click_count, event_access_unlocked_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[clickStats] fetch failed', error.message);
    throw new Error('לא הצלחנו לטעון מספר הקליקים. נסה/י שוב.');
  }

  if (!data) {
    return { incoming_click_count: 0, event_access_unlocked_at: null };
  }

  return {
    incoming_click_count: data.incoming_click_count ?? 0,
    event_access_unlocked_at: data.event_access_unlocked_at,
  };
}
