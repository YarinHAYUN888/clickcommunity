import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseProfile } from './useCurrentUser';
import { allInterests } from '@/data/demo';
import { computeFeedPairScore } from '@/lib/matching/feedPairScore';

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

  const interests = myProfile?.interests || [];
  const myNiche = (myProfile?.life_niche || '').trim();

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
      }),
    [
      myProfile?.interests,
      myProfile?.region,
      myProfile?.life_niche,
      myProfile?.date_of_birth,
      myProfile?.gender,
      myProfile?.bio,
      myProfile?.occupation,
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

    const hasNonEmpty = (value: string | null | undefined) => !!value?.trim();
    const hasDisplayPhoto = (p: SupabaseProfile) =>
      (Array.isArray(p.photos) && p.photos.length > 0) || !!(p.avatar_url && String(p.avatar_url).trim());
    const isProfilePartial = (p: SupabaseProfile) => {
      const hasName = hasNonEmpty(p.first_name);
      const hasBio = hasNonEmpty(p.bio);
      const hasOccupation = hasNonEmpty(p.occupation);
      const hasInterestsList = Array.isArray(p.interests) && p.interests.length > 0;
      return !(hasName && hasDisplayPhoto(p) && (hasBio || hasOccupation || hasInterestsList));
    };

    const swipeHidden = new Set<string>();
    if (!swipeRes.error && swipeRes.data) {
      for (const row of swipeRes.data) {
        if (row.to_user_id) swipeHidden.add(row.to_user_id);
      }
    } else if (swipeRes.error && import.meta.env.DEV) {
      console.warn('[useClicksFeed] profile_swipes unavailable:', swipeRes.error.message);
    }

    const nonGuest = (data as SupabaseProfile[]).filter((p) => p.role !== 'guest');
    const approvedActive = nonGuest.filter(
      (p) => p.moderation_status === 'approved' && p.suspended !== true,
    );
    let profiles = approvedActive.filter((p) => p.first_name && hasDisplayPhoto(p));
    profiles = profiles.filter((p) => !swipeHidden.has(p.user_id));

    const hasMyInts = interests.length > 0;
    const hasMyNiche = !!myNiche;

    if (hasMyNiche && hasMyInts) {
      profiles = profiles.filter((p) => {
        const theirNiche = (p.life_niche || '').trim();
        if (theirNiche !== myNiche) return false;
        const their = p.interests || [];
        return interests.some((i) => their.includes(i));
      });
    } else if (hasMyInts && !hasMyNiche) {
      profiles = profiles.filter((p) => {
        const their = p.interests || [];
        return interests.some((i) => their.includes(i));
      });
    } else if (hasMyNiche && !hasMyInts) {
      profiles = profiles.filter((p) => (p.life_niche || '').trim() === myNiche);
    }

    if (profiles.length === 0 && approvedActive.some((p) => p.first_name)) {
      profiles = approvedActive
        .filter((p) => !!p.first_name?.trim())
        .filter((p) => !swipeHidden.has(p.user_id));
    }

    const feedItems: ClickFeedItem[] = profiles
      .map((profile) => {
        const { score, sharedInterests } = computeFeedPairScore(meRef.current ?? null, profile);
        return {
          profile,
          compatibilityScore: score,
          sharedInterests,
          isProfilePartial: isProfilePartial(profile),
        };
      })
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore);

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
