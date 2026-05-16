import { supabase } from '@/integrations/supabase/client';

export type SwipeAction = 'like' | 'pass' | 'super_like';

export interface RecordSwipeResult {
  ok: boolean;
  mutual: boolean;
  chat_id: string | null;
}

function parseSwipeResponse(data: unknown, fnError: unknown): Record<string, unknown> | null {
  if (data && typeof data === 'object') return data as Record<string, unknown>;
  const ctx = fnError as { context?: { body?: unknown } } | null;
  const b = ctx?.context?.body;
  if (b && typeof b === 'object') return b as Record<string, unknown>;
  return null;
}

function friendlySwipeError(code: string): string {
  if (code.includes('Shadow isolation')) return 'לא ניתן לבצע פעולה עם משתמש/ת זו.';
  if (code === 'not_approved' || code === 'target_unavailable') return 'הפרופיל לא זמין לפעולה.';
  if (code === 'suspended') return 'החשבון מושעה.';
  return 'לא ניתן לשמור את הפעולה. נסו שוב.';
}

/** Records like/pass/super_like; on mutual like opens or returns existing DM (server-side). */
export async function recordProfileSwipe(toUserId: string, action: SwipeAction): Promise<RecordSwipeResult> {
  const { data, error } = await supabase.functions.invoke('record-profile-swipe', {
    body: { to_user_id: toUserId, action },
  });
  const body = parseSwipeResponse(data, error);
  if (typeof body?.error === 'string' && body.error) {
    throw new Error(friendlySwipeError(body.error));
  }
  if (body?.ok === true) {
    return {
      ok: true,
      mutual: body.mutual === true,
      chat_id: typeof body.chat_id === 'string' ? body.chat_id : null,
    };
  }
  if (error) throw new Error(friendlySwipeError(error.message));
  throw new Error('לא ניתן לשמור את הפעולה.');
}
