import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseProfile } from './useCurrentUser';
import { allInterests } from '@/data/demo';
import { buildClicksFeedCandidates } from '@/lib/matching/clicksFeedBuilder';
import { logFeedExclusionSummary } from '@/lib/matching/clicksFeedDebug';

export interface ClickFeedItem {
  profile: SupabaseProfile;
  compatibilityScore: number;
  sharedInterests: string[];
  isProfilePartial: boolean;
}

/**
 * @param myProfile — full viewer profile for multi-signal score (interests, region, age, bio); session id stays currentUserId.
 */
export function useClicksFeed(currentUserId: string, myProfile: SupabaseProfile | null | undefined) {
  const [items, setItems] = useState<ClickFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const meRef = useRef(myProfile);
  meRef.current = myProfile;

  const mySignalsKey = useMemo(
    () =>
      JSON.stringify({
        interests: myProfile?.interests ?? [],
        region: myProfile?.region ?? '',
        life_niche: myProfile?.life_niche ?? '',
        dob: myProfile?.date_of_birth ?? '',
        gender: myProfile?.gender ?? '',
        bio: myProfile?.bio ?? '',
        occupation: myProfile?.occupation ?? '',
        super_role: myProfile?.super_role ?? '',
      }),
    [
      myProfile?.interests,
      myProfile?.region,
      myProfile?.life_niche,
      myProfile?.date_of_birth,
      myProfile?.gender,
      myProfile?.bio,
      myProfile?.occupation,
      myProfile?.super_role,
    ],
  );

  const fetchProfiles = useCallback(async (options?: { silent?: boolean }) => {
    if (!currentUserId) {
      setLoading(false);
      setError(null);
      return;
    }

    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);

    const nowIso = new Date().toISOString();
    const [{ data, error }, swipeRes, boostRes] = await Promise.all([
      supabase.from('profiles').select('*').neq('user_id', currentUserId),
      supabase.from('profile_swipes').select('to_user_id').eq('from_user_id', currentUserId),
      supabase
        .from('user_click_actions')
        .select('user_id')
        .eq('action_type', 'boost')
        .gt('expires_at', nowIso),
    ]);

    if (error) {
      console.error('useClicksFeed:', error.message);
      setItems([]);
      setError('טעינת הקליקים נכשלה. אפשר לנסות שוב בעוד רגע.');
      setLoading(false);
      return;
    }

    if (!data) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    const swipeHidden = new Set<string>();
    if (!swipeRes.error && swipeRes.data) {
      for (const row of swipeRes.data) {
        if (row.to_user_id) swipeHidden.add(row.to_user_id);
      }
    } else if (swipeRes.error && import.meta.env.DEV) {
      console.warn('[useClicksFeed] profile_swipes unavailable:', swipeRes.error.message);
    }

    const { items: feedItems, report } = buildClicksFeedCandidates(
      meRef.current ?? null,
      data as SupabaseProfile[],
      swipeHidden,
      currentUserId,
    );

    // Bump users with an active boost to the top, preserving existing order within groups.
    const boostedUserIds = new Set<string>();
    if (!boostRes.error && boostRes.data) {
      for (const row of boostRes.data) {
        if (row.user_id && row.user_id !== currentUserId) boostedUserIds.add(row.user_id);
      }
    } else if (boostRes.error && import.meta.env.DEV) {
      console.warn('[useClicksFeed] user_click_actions unavailable:', boostRes.error.message);
    }

    const prioritizedItems =
      boostedUserIds.size > 0
        ? feedItems
            .map((item, index) => ({ item, index }))
            .sort((a, b) => {
              const aBoost = boostedUserIds.has(a.item.profile.user_id) ? 1 : 0;
              const bBoost = boostedUserIds.has(b.item.profile.user_id) ? 1 : 0;
              if (aBoost !== bBoost) return bBoost - aBoost;
              return a.index - b.index;
            })
            .map(({ item }) => item)
        : feedItems;

    if (import.meta.env.DEV) {
      const excludedByEligibility = Object.entries(report.excludedCounts).reduce((acc, [reason, count]) => {
        if (reason === 'tier_no_match') return acc;
        return acc + (count ?? 0);
      }, 0);
      const eligibleAfterFilter = Math.max(0, data.length - excludedByEligibility);
      console.info('[useClicksFeed] feed counts', {
        rawProfiles: data.length,
        afterRlsReturn: data.length,
        afterEligibilityFilter: eligibleAfterFilter,
        finalDisplayed: feedItems.length,
      });
      const noPhotoCount = report.excludedCounts.no_photo ?? 0;
      console.info('CLICKS FILTER - NO PROFILE PHOTO', { excluded: noPhotoCount });
      console.info('CLICKS FILTER - PASSED PHOTO CHECK', { passed: eligibleAfterFilter });
      console.info('CLICKS FINAL DISPLAY COUNT', { displayed: feedItems.length });
    }

    logFeedExclusionSummary(currentUserId, report, {
      isSuperUser: !!meRef.current?.super_role?.trim(),
    });

    setItems(prioritizedItems);
    setError(null);
    setLoading(false);
  }, [currentUserId, mySignalsKey]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const removeFromFeed = useCallback((userId: string) => {
    setItems((prev) => prev.filter((i) => i.profile.user_id !== userId));
  }, []);

  const refresh = useCallback(
    (silent = false) => fetchProfiles({ silent }),
    [fetchProfiles],
  );

  return { items, loading, error, refresh, removeFromFeed };
}

/** Helper: get emoji for an interest label */
export function getInterestEmoji(label: string): string {
  return allInterests.find(i => i.label === label)?.emoji || '';
}
