import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchUserNotifications,
  markNotificationRead,
  type UserNotification,
} from '@/services/notifications';

export function useNotifications(authId: string | null | undefined) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const seenToastKeysRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!authId) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchUserNotifications();
      setNotifications(rows);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [authId]);

  const showToastForNotification = useCallback((n: UserNotification) => {
    if (seenToastKeysRef.current.has(n.dedupe_key)) return;
    seenToastKeysRef.current.add(n.dedupe_key);
    toast(n.title, { description: n.body });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!authId) return;

    const channel = supabase
      .channel(`user_notifications:${authId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${authId}`,
        },
        (payload) => {
          const row = payload.new as UserNotification;
          setNotifications((prev) => {
            if (prev.some((p) => p.id === row.id || p.dedupe_key === row.dedupe_key)) return prev;
            return [row, ...prev];
          });
          showToastForNotification(row);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authId, showToastForNotification]);

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
  }, []);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return { notifications, loading, unreadCount, refresh, markRead };
}
