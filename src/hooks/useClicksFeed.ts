import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseProfile } from './useCurrentUser';
import { allInterests } from '@/data/demo';

export interface ClickFeedItem {
  profile: SupabaseProfile;
  compatibilityScore: number;
  sharedInterests: string[];
}

function calculateCompatibility(myInterests: string[], theirInterests: string[]): { score: number; shared: string[] } {
  const shared = myInterests.filter(i => theirInterests.includes(i));
  const totalUnique = new Set([...myInterests, ...theirInterests]).size;
  const score = totalUnique > 0 ? Math.round((shared.length / totalUnique) * 100) : 0;
  return { score, shared };
}

export function useClicksFeed(currentUserId: string, myInterests: string[], isShadowUser: boolean) {
  const [items, setItems] = useState<ClickFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const interestsRef = useRef(myInterests);
  interestsRef.current = myInterests;

  const fetchProfiles = useCallback(async () => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = supabase
      .from('profiles')
      .select('*')
      .neq('user_id', currentUserId)
      .eq('suitability_status', 'active')
      .eq('is_shadow', isShadowUser);

    const { data, error } = await q;

    if (error || !data) {
      setLoading(false);
      return;
    }

    const interests = interestsRef.current;
    const profiles = (data as SupabaseProfile[])
      .filter(p => p.first_name && p.photos && p.photos.length > 0);

    const feedItems: ClickFeedItem[] = profiles
      .map(profile => {
        const { score, shared } = calculateCompatibility(interests, profile.interests || []);
        return { profile, compatibilityScore: score, sharedInterests: shared };
      })
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    setItems(feedItems);
    setLoading(false);
  }, [currentUserId, isShadowUser]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return { items, loading, refresh: fetchProfiles };
}

/** Helper: get emoji for an interest label */
export function getInterestEmoji(label: string): string {
  return allInterests.find(i => i.label === label)?.emoji || '';
}
