import { supabase } from '@/integrations/supabase/client';

export interface RecordBoostResult {
  ok: boolean;
  expires_at: string | null;
}

function parseResponse(data: unknown, fnError: unknown): Record<string, unknown> | null {
  if (data && typeof data === 'object') return data as Record<string, unknown>;
  const ctx = fnError as { context?: { body?: unknown } } | null;
  const b = ctx?.context?.body;
  if (b && typeof b === 'object') return b as Record<string, unknown>;
  return null;
}

function friendlyBoostError(code: string): string {
  if (code === 'not_allowed') return 'לא ניתן לבצע פעולה זו כרגע';
  return 'הפעולה נכשלה. נסה/י שוב';
}

/** Records a global self-boost; never surfaces raw technical errors. */
export async function recordBoost(): Promise<RecordBoostResult> {
  const { data, error } = await supabase.functions.invoke('record-click-action', {
    body: { action_type: 'boost' },
  });
  const body = parseResponse(data, error);
  if (typeof body?.error === 'string' && body.error) {
    throw new Error(friendlyBoostError(body.error));
  }
  if (body?.ok === true) {
    return {
      ok: true,
      expires_at: typeof body.expires_at === 'string' ? body.expires_at : null,
    };
  }
  if (error) throw new Error(friendlyBoostError(error.message));
  throw new Error('הפעולה נכשלה. נסה/י שוב');
}
