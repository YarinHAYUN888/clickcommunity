import { supabase } from '@/integrations/supabase/client';

/* ── Types ── */
export interface ChatRow {
  id: string;
  type: 'direct' | 'group';
  event_id: string | null;
  updated_at: string;
  expires_at: string | null;
  is_closed: boolean;
  created_at: string;
  display_name?: string | null;
  created_by?: string | null;
}

export interface MessageRow {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  is_system: boolean;
  is_pinned: boolean;
  is_deleted: boolean;
  deleted_by: string | null;
  read_by: string[];
  created_at: string;
}

/** ניווט ל־`/chats/new-…` או אחרי יצירת DM — כותרת מיידית עד טעינת פרופיל מהשרת */
export interface ChatLocationPartnerPreview {
  firstName: string;
  photoUrl: string | null;
}

export interface ChatLocationState {
  icebreaker?: string;
  partnerPreview?: ChatLocationPartnerPreview;
}

type PartnerNameSource = {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
};

/** Resolve stable display name for chat partner with safe fallbacks. */
export function resolvePartnerDisplayName(
  partner: PartnerNameSource | null | undefined,
  fallbackName?: string | null
) {
  const first = partner?.first_name?.trim() || '';
  const last = partner?.last_name?.trim() || '';
  const username = partner?.username?.trim() || '';
  const fallback = fallbackName?.trim() || '';

  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (username) return username;
  if (fallback) return fallback;
  return 'משתמש/ת';
}

export function partnerPreviewFromProfile(p: {
  first_name?: string | null;
  photos?: string[] | null;
  avatar_url?: string | null;
}): ChatLocationPartnerPreview {
  const photo =
    (Array.isArray(p.photos) && p.photos.length > 0 && p.photos[0]) ||
    (p.avatar_url && String(p.avatar_url).trim()) ||
    null;
  return {
    firstName: (p.first_name && String(p.first_name).trim()) || 'משתמש/ת',
    photoUrl: photo,
  };
}

/* ── Queries ── */

export async function getDirectChats(userId: string) {
  // Get chat IDs user participates in
  const { data: parts, error: pErr } = await supabase
    .from('chat_participants')
    .select('chat_id')
    .eq('user_id', userId)
    .eq('removed', false);

  if (pErr) throw pErr;
  if (!parts || parts.length === 0) return [];

  const chatIds = parts.map((p: any) => p.chat_id);

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .in('id', chatIds)
    .eq('type', 'direct')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ChatRow[];
}

export async function getGroupChats(userId: string) {
  const { data: parts, error: pErr } = await supabase
    .from('chat_participants')
    .select('chat_id')
    .eq('user_id', userId)
    .eq('removed', false);

  if (pErr) throw pErr;
  if (!parts || parts.length === 0) return [];

  const chatIds = parts.map((p: any) => p.chat_id);

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .in('id', chatIds)
    .eq('type', 'group')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ChatRow[];
}

/** Partner profile for DM header / list; may be partial if RLS still hides columns (use participant fallback). */
export async function getDmPartner(chatId: string, currentUserId: string) {
  const { data: rows, error } = await supabase
    .from('chat_participants')
    .select('user_id, joined_at')
    .eq('chat_id', chatId)
    .eq('removed', false)
    .neq('user_id', currentUserId)
    .order('joined_at', { ascending: false });

  if (error || !rows?.length) return null;
  const partnerUserId = rows[0].user_id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, photos, avatar_url')
    .eq('user_id', partnerUserId)
    .maybeSingle();

  if (profile) return profile;

  return {
    user_id: partnerUserId,
    first_name: null as string | null,
    last_name: null as string | null,
    photos: null as string[] | null,
    avatar_url: null as string | null,
  };
}

export async function getLastMessage(chatId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as MessageRow | null;
}

export async function getChatMessages(chatId: string, limit = 50) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data || []) as MessageRow[]).reverse();
}

export async function getUnreadCount(chatId: string, userId: string) {
  // We can't use array contains filter easily, so fetch and count client-side
  const { data, error } = await supabase
    .from('messages')
    .select('id, read_by')
    .eq('chat_id', chatId)
    .eq('is_deleted', false)
    .neq('sender_id', userId);

  if (error) return 0;
  return (data || []).filter((m: any) => !(m.read_by || []).includes(userId)).length;
}

export async function getTotalUnreadCount(userId: string) {
  const { data: parts } = await supabase
    .from('chat_participants')
    .select('chat_id')
    .eq('user_id', userId)
    .eq('removed', false);

  if (!parts || parts.length === 0) return 0;

  let total = 0;
  for (const p of parts) {
    total += await getUnreadCount(p.chat_id, userId);
  }
  return total;
}

/** לכל user_id בפיד קליקים: האם יש בצ׳אט ישיר איתו הודעות שלא נקראו (ממנו). */
export async function getUnreadMessageFromUserIds(
  currentUserId: string,
  candidateUserIds: string[]
): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  candidateUserIds.forEach((id) => {
    out[id] = false;
  });
  if (!currentUserId || candidateUserIds.length === 0) return out;

  const want = new Set(candidateUserIds);

  const { data: myParts, error: e1 } = await supabase
    .from('chat_participants')
    .select('chat_id')
    .eq('user_id', currentUserId)
    .eq('removed', false);
  if (e1 || !myParts?.length) return out;

  const myChatIds = myParts.map((p: { chat_id: string }) => p.chat_id);
  const { data: directRows, error: e2 } = await supabase
    .from('chats')
    .select('id')
    .in('id', myChatIds)
    .eq('type', 'direct');
  if (e2 || !directRows?.length) return out;

  const directIds = new Set(directRows.map((c: { id: string }) => c.id));

  const { data: theirParts, error: e3 } = await supabase
    .from('chat_participants')
    .select('chat_id, user_id')
    .in('chat_id', [...directIds])
    .eq('removed', false)
    .neq('user_id', currentUserId);
  if (e3 || !theirParts?.length) return out;

  for (const row of theirParts as { chat_id: string; user_id: string }[]) {
    if (!directIds.has(row.chat_id)) continue;
    const otherId = row.user_id;
    if (!want.has(otherId)) continue;
    const n = await getUnreadCount(row.chat_id, currentUserId);
    if (n > 0) out[otherId] = true;
  }
  return out;
}

export async function getEventForChat(eventId: string) {
  const { data } = await supabase
    .from('events')
    .select('name, cover_image_url, date')
    .eq('id', eventId)
    .single();
  return data;
}

export async function getPinnedMessage(chatId: string) {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .eq('is_pinned', true)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as MessageRow | null;
}

export async function getGroupParticipants(chatId: string) {
  const { data } = await supabase
    .from('chat_participants')
    .select('user_id, removed')
    .eq('chat_id', chatId)
    .eq('removed', false);

  if (!data || data.length === 0) return [];

  const userIds = data.map((p: any) => p.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('user_id', userIds);

  return profiles || [];
}

export async function getSenderProfile(senderId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('first_name, photos, avatar_url')
    .eq('user_id', senderId)
    .single();
  return data;
}

/* ── Realtime ── */

export function subscribeToMessages(chatId: string, onMessage: (msg: MessageRow) => void) {
  const channel = supabase
    .channel(`chat-${chatId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `chat_id=eq.${chatId}`,
    }, (payload) => {
      onMessage(payload.new as MessageRow);
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages',
      filter: `chat_id=eq.${chatId}`,
    }, (payload) => {
      onMessage({ ...(payload.new as MessageRow), } as any);
    })
    .subscribe();

  return channel;
}

/* ── Edge Function Calls ── */

export async function sendMessage(chatId: string, content: string) {
  const payload = { chat_id: chatId, content };
  console.log('SEND MESSAGE PAYLOAD:', payload);

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    console.error('SEND MESSAGE ERROR:', new Error('No active session'));
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase.functions.invoke('send-message', {
    body: payload,
  });

  if (error) {
    console.error('SEND MESSAGE ERROR:', error, data);
    throw error;
  }

  if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
    const msg = String((data as { error: string }).error);
    console.error('SEND MESSAGE ERROR:', msg);
    throw new Error(msg);
  }

  return data as { success?: boolean; message_id?: string };
}

export async function createOrGetDm(otherUserId: string, icebreakerText?: string) {
  const { data, error } = await supabase.functions.invoke('create-or-get-dm', {
    body: { other_user_id: otherUserId, icebreaker_text: icebreakerText },
  });
  if (error) throw error;
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as { chat_id: string; is_new?: boolean; first_message_id?: string | null };
}

export async function markAsRead(chatId: string) {
  const { data, error } = await supabase.functions.invoke('mark-messages-read', {
    body: { chat_id: chatId },
  });
  if (error) throw error;
  return data;
}

export async function blockUser(blockedId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('blocked_users')
    .insert({ blocker_id: session.user.id, blocked_id: blockedId });
  if (error) throw error;
}

export async function reportUser(reportedUserId: string, chatId: string, messageId: string | null, reason: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('chat_reports')
    .insert({
      reporter_id: session.user.id,
      reported_user_id: reportedUserId,
      chat_id: chatId,
      message_id: messageId,
      reason,
    });
  if (error) throw error;
}

export async function adminAction(action: string, targetId: string, chatId?: string, reason?: string) {
  const { data, error } = await supabase.functions.invoke('admin-action', {
    body: { action, target_id: targetId, chat_id: chatId, reason },
  });
  if (error) throw error;
  return data;
}
