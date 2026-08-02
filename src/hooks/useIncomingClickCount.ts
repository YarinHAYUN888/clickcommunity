import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribePostgresChannel, unsubscribeRealtimeChannel } from '@/lib/supabaseRealtime';
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

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!authId) return;

    const channel = subscribePostgresChannel(`profile_click_stats:${authId}`, [
      {
        event: '*',
        schema: 'public',
        table: 'profile_click_stats',
        filter: `user_id=eq.${authId}`,
        callback: (payload) => {
          const row = (payload as { new: ProfileClickStats | undefined }).new;
          if (row && typeof row.incoming_click_count === 'number') {
            setStats({
              incoming_click_count: row.incoming_click_count,
              event_access_unlocked_at: row.event_access_unlocked_at ?? null,
            });
          } else {
            void refreshRef.current();
          }
        },
      },
    ]);

    return () => unsubscribeRealtimeChannel(channel);
  }, [authId]);

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
