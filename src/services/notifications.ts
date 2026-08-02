import { supabase } from '@/integrations/supabase/client';

export type UserNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  dedupe_key: string;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
};

export async function fetchUserNotifications(limit = 30): Promise<UserNotification[]> {
  const { data, error } = await supabase
    .from('user_notifications')
    .select('id, user_id, type, title, body, dedupe_key, read_at, created_at, metadata')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[notifications] fetch failed', error.message);
    throw new Error('לא הצלחנו לטעון התראות.');
  }

  return (data ?? []) as UserNotification[];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) {
    console.warn('[notifications] mark read failed', error.message);
    throw new Error('לא הצלחנו לעדכן ההתראה.');
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);

  if (error) {
    console.warn('[notifications] mark all read failed', error.message);
  }
}
