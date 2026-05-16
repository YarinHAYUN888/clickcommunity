import { supabase } from '@/integrations/supabase/client';

export type CompatibilityHighlights = {
  other_energy_type: string | null;
  my_energy_type: string | null;
  other_lifestyle: string | null;
  other_communication: string | null;
};

export type ProfileMatchSnapshot = {
  id: string;
  user_a: string;
  user_b: string;
  compatibility_score: number;
  compatibility_breakdown: Record<string, number>;
  compatibility_reason: string | null;
  ai_summary: string | null;
  match_status: string;
  updated_at: string;
};

export type CompatibilityEnrichment = {
  other_user_id: string;
  match: ProfileMatchSnapshot;
  highlights: CompatibilityHighlights;
};

/** Batch compute + upsert server-side; returns map other_user_id → enrichment. */
export async function computeCompatibilityBatch(
  otherUserIds: string[],
): Promise<Record<string, CompatibilityEnrichment>> {
  const out: Record<string, CompatibilityEnrichment> = {};
  const unique = [...new Set(otherUserIds)].filter(Boolean);
  if (unique.length === 0) return out;

  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    results?: CompatibilityEnrichment[];
    error?: string;
  }>('compute-compatibility', {
    body: { other_user_ids: unique.slice(0, 25) },
  });

  if (error) {
    if (import.meta.env.DEV) console.warn('[matching] compute-compatibility', error.message);
    return out;
  }
  const body = data && typeof data === 'object' ? data : null;
  if (body?.error || !Array.isArray(body?.results)) return out;

  for (const row of body.results) {
    if (row?.other_user_id && row.match) out[row.other_user_id] = row;
  }
  return out;
}

/** Future: call when logging swipe / view / chat open for dynamic matching. */
export async function recordMatchBehaviorEvent(
  eventType: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return;
  const { error } = await supabase.from('match_behavior_events').insert({
    user_id: user.id,
    event_type: eventType,
    payload,
  });
  if (error && import.meta.env.DEV) console.warn('[matching] behavior event', error.message);
}
