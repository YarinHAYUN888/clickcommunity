import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchMyClickStats,
  hasEventAccessFromStats,
  type ProfileClickStats,
} from '@/services/clickStats';
import { EVENT_ACCESS_MIN_INCOMING_CLICKS } from '@/config/clicks';

export type IncomingClickCountState = {
  stats: ProfileClickStats;
  hasAccess: boolean;
  loading: boolean;
  error: string | null;
};

const DEFAULT_STATS: ProfileClickStats = {
  incoming_click_count: 0,
  event_access_unlocked_at: null,
};

export function useIncomingClickCount(authId: string | null | undefined, isAdmin = false) {
  const [stats, setStats] = useState<ProfileClickStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!authId) {
      setStats(DEFAULT_STATS);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await fetchMyClickStats(authId);
      setStats(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינת הקליקים');
    } finally {
      setLoading(false);
    }
  }, [authId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!authId) return;

    const channel = supabase
      .channel(`profile_click_stats:${authId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profile_click_stats',
          filter: `user_id=eq.${authId}`,
        },
        (payload) => {
          const row = payload.new as ProfileClickStats | undefined;
          if (row && typeof row.incoming_click_count === 'number') {
            setStats({
              incoming_click_count: row.incoming_click_count,
              event_access_unlocked_at: row.event_access_unlocked_at ?? null,
            });
          } else {
            void refresh();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authId, refresh]);

  const hasAccess = isAdmin || hasEventAccessFromStats(stats);
  const displayCount = Math.min(stats.incoming_click_count, EVENT_ACCESS_MIN_INCOMING_CLICKS);

  return {
    stats,
    loading,
    error,
    hasAccess,
    displayCount,
    refresh,
  };
}
