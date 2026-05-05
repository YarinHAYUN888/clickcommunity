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

export function useClicksFeed(currentUserId: string, myInterests: string[]) {
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

    // RLS (Profiles select isolation) כבר מגביל active/shadow וכו׳ — לא מוסיפים סינון כפול כאן.
    const { data, error } = await supabase
  .from('profiles')
  .select('user_id, first_name, status, role');

console.log(data);

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

    const interests = interestsRef.current;

    const hasDisplayPhoto = (p: SupabaseProfile) =>
      (Array.isArray(p.photos) && p.photos.length > 0) || !!(p.avatar_url && String(p.avatar_url).trim());

    const nonGuest = (data as SupabaseProfile[]).filter((p) => p.role !== 'guest');

    let profiles = nonGuest.filter((p) => p.first_name && hasDisplayPhoto(p));

    /** אם אחרי סינון קשיח אין אף פרופיל אבל יש משתמשים בשרת — נציג פיד רך (שם בלבד) כדי לא להשאיר פיד ריק בטעות תצוגה */
    if (profiles.length === 0 && nonGuest.some((p) => p.first_name)) {
      profiles = nonGuest.filter((p) => !!p.first_name?.trim());
    }

    const feedItems: ClickFeedItem[] = profiles
      .map((profile) => {
        const { score, shared } = calculateCompatibility(interests, profile.interests || []);
        return { profile, compatibilityScore: score, sharedInterests: shared };
      })
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    setItems(feedItems);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return { items, loading, refresh: fetchProfiles };
}

/** Helper: get emoji for an interest label */
export function getInterestEmoji(label: string): string {
  return allInterests.find(i => i.label === label)?.emoji || '';
}
