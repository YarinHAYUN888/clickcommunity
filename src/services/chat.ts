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

export async function getDmPartner(chatId: string, currentUserId: string) {
  const { data, error } = await supabase
    .from('chat_participants')
    .select('user_id')
    .eq('chat_id', chatId)
    .neq('user_id', currentUserId)
    .single();

  if (error) return null;

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', data.user_id)
    .single();

  return profile;
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
  const { data, error } = await supabase.functions.invoke('send-message', {
    body: { chat_id: chatId, content },
  });
  if (error) throw error;
  return data;
}

export async function createOrGetDm(otherUserId: string, icebreakerText?: string) {
  const { data, error } = await supabase.functions.invoke('create-or-get-dm', {
    body: { other_user_id: otherUserId, icebreaker_text: icebreakerText },
  });
  if (error) throw error;
  return data;
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
