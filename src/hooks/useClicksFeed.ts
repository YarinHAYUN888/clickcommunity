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

  const fetchProfiles = useCallback(async () => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const [{ data, error }, swipeRes] = await Promise.all([
      supabase.from('profiles').select('*').neq('user_id', currentUserId),
      supabase.from('profile_swipes').select('to_user_id').eq('from_user_id', currentUserId),
    ]);

    if (error) {
      console.error('useClicksFeed:', error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    if (!data) {
      setItems([]);
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

    logFeedExclusionSummary(currentUserId, report, {
      isSuperUser: !!meRef.current?.super_role?.trim(),
    });

    setItems(feedItems);
    setLoading(false);
  }, [currentUserId, mySignalsKey]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return { items, loading, refresh: fetchProfiles };
}

/** Helper: get emoji for an interest label */
export function getInterestEmoji(label: string): string {
  return allInterests.find(i => i.label === label)?.emoji || '';
}
