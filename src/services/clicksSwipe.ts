import { supabase } from '@/integrations/supabase/client';
import { createOrGetDm } from '@/services/chat';

export type SwipeAction = 'like' | 'pass' | 'super_like';

export interface RecordSwipeResult {
  ok: boolean;
  mutual: boolean;
  chat_id: string | null;
}

function parseSwipeResponse(data: unknown, fnError: unknown): Record<string, unknown> | null {
  if (data && typeof data === 'object') return data as Record<string, unknown>;
  const ctx = fnError as { context?: { body?: unknown; json?: () => Promise<unknown> } } | null;
  const b = ctx?.context?.body;
  if (b && typeof b === 'object') return b as Record<string, unknown>;
  return null;
}

function friendlySwipeError(code: string): string {
  if (code.includes('Shadow isolation')) return 'לא ניתן לבצע פעולה זו כרגע';
  if (code === 'not_approved' || code === 'target_unavailable') return 'לא ניתן לבצע פעולה זו כרגע';
  if (code === 'suspended') return 'לא ניתן לבצע פעולה זו כרגע';
  return 'הפעולה נכשלה. נסה/י שוב';
}

function isLikeAction(action: SwipeAction): boolean {
  return action === 'like' || action === 'super_like';
}

/** Direct DB write when Edge Function is unavailable (RLS allows own outgoing swipes). */
async function recordProfileSwipeDirect(
  fromUserId: string,
  toUserId: string,
  action: SwipeAction,
): Promise<RecordSwipeResult> {
  const now = new Date().toISOString();
  const { error } = await supabase.from('profile_swipes').upsert(
    {
      from_user_id: fromUserId,
      to_user_id: toUserId,
      action,
      updated_at: now,
    },
    { onConflict: 'from_user_id,to_user_id' },
  );

  if (error) {
    console.warn('CLICKS ACTION FAILED', { path: 'direct_upsert', message: error.message });
    throw new Error('הפעולה נכשלה. נסה/י שוב');
  }

  let chat_id: string | null = null;
  let mutual = false;

  if (isLikeAction(action)) {
    const { data: rev } = await supabase
      .from('profile_swipes')
      .select('action')
      .eq('from_user_id', toUserId)
      .eq('to_user_id', fromUserId)
      .maybeSingle();

    if (rev && isLikeAction(rev.action as SwipeAction)) {
      mutual = true;
    }

    try {
      const dm = await createOrGetDm(toUserId);
      chat_id = dm.chat_id ?? null;
    } catch (e) {
      console.warn('CLICKS DM OPEN FAILED', e);
    }
  }

  console.info('CLICKS ACTION SAVED', { path: 'direct', toUserId, action, mutual, chat_id });
  return { ok: true, mutual, chat_id };
}

/** Records like/pass/super_like; opens DM on like; mutual match when both liked. */
export async function recordProfileSwipe(toUserId: string, action: SwipeAction): Promise<RecordSwipeResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    throw new Error('יש להתחבר מחדש');
  }

  const { data, error } = await supabase.functions.invoke('record-profile-swipe', {
    body: { to_user_id: toUserId, action },
  });

  const body = parseSwipeResponse(data, error);
  if (typeof body?.error === 'string' && body.error) {
    console.warn('CLICKS ACTION FAILED', { path: 'edge', error: body.error });
    if (body.error === 'not_approved' || body.error.includes('Unauthorized')) {
      return recordProfileSwipeDirect(session.user.id, toUserId, action);
    }
    throw new Error(friendlySwipeError(body.error));
  }

  if (body?.ok === true) {
    return {
      ok: true,
      mutual: body.mutual === true,
      chat_id: typeof body.chat_id === 'string' ? body.chat_id : null,
    };
  }

  if (error) {
    console.warn('CLICKS ACTION FAILED', { path: 'edge_invoke', message: error.message });
    return recordProfileSwipeDirect(session.user.id, toUserId, action);
  }

  throw new Error('הפעולה נכשלה. נסה/י שוב');
}

/** User IDs who liked the current user (incoming likes). */
export async function getIncomingLikeUserIds(viewerId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('profile_swipes')
    .select('from_user_id')
    .eq('to_user_id', viewerId)
    .in('action', ['like', 'super_like']);

  if (error) {
    if (import.meta.env.DEV) console.warn('[getIncomingLikeUserIds]', error.message);
    return new Set();
  }

  return new Set((data ?? []).map((r) => r.from_user_id).filter(Boolean) as string[]);
}
