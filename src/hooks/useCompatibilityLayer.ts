import { useEffect, useState, useMemo } from 'react';
import { ClickFeedItem } from '@/hooks/useClicksFeed';
import { computeCompatibilityBatch, type CompatibilityEnrichment } from '@/services/matching';

const MAX_IDS = 20;

/**
 * Loads server-side compatibility rows for visible feed cards (one batched Edge call).
 * Safe no-op if the function or tables are not deployed yet.
 */
export function useCompatibilityLayer(authId: string | undefined, items: ClickFeedItem[]) {
  const [byOtherId, setByOtherId] = useState<Record<string, CompatibilityEnrichment>>({});

  const key = useMemo(
    () => items.map((i) => i.profile.user_id).slice(0, MAX_IDS).join(','),
    [items],
  );

  useEffect(() => {
    if (!authId || !key) {
      setByOtherId({});
      return;
    }
    const ids = key.split(',').filter(Boolean);
    let cancelled = false;
    computeCompatibilityBatch(ids).then((m) => {
      if (!cancelled) setByOtherId(m);
    });
    return () => {
      cancelled = true;
    };
  }, [authId, key]);

  return byOtherId;
}
