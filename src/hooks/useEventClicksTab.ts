import { useCallback, useEffect, useState } from 'react';
import { getEventClicks, getNextRegisteredUpcomingEvent, type EventClick } from '@/services/events';
import { useUserMode } from '@/hooks/useUserMode';
import type { ClickFeedItem } from '@/hooks/useClicksFeed';
import type { SupabaseProfile } from '@/hooks/useCurrentUser';

function eventClickToFeedItem(click: EventClick): ClickFeedItem {
  const p = click.profile;
  const profile: SupabaseProfile = {
    id: p.user_id,
    user_id: p.user_id,
    first_name: p.first_name,
    last_name: null,
    phone: null,
    date_of_birth: p.date_of_birth,
    gender: null,
    photos: p.photos,
    occupation: p.occupation,
    region: p.region,
    bio: p.bio,
    interests: p.interests,
    avatar_url: p.avatar_url,
    role: 'member',
    status: null,
    subscription_status: null,
    profile_completion: null,
    super_role: null,
    suspended: null,
  };
  return {
    profile,
    compatibilityScore: click.compatibilityScore,
    sharedInterests: click.sharedInterests,
    isProfilePartial: false,
  };
}

export function useEventClicksTab(authId: string | null | undefined) {
  const { isShadowUser } = useUserMode();
  const [items, setItems] = useState<ClickFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!authId) {
      setItems([]);
      setEmptyMessage(null);
      setEventName(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const event = await getNextRegisteredUpcomingEvent(authId, isShadowUser);
      if (!event) {
        setItems([]);
        setEventName(null);
        setEmptyMessage('אין אירוע קרוב רשום');
        return;
      }

      setEventName(event.name);
      const clicks = await getEventClicks(event.id, authId, 20);
      setItems(clicks.map(eventClickToFeedItem));
      setEmptyMessage(clicks.length === 0 ? 'עדיין אין התאמות בולטות באירוע הקרוב' : null);
    } catch (err) {
      console.error('useEventClicksTab:', err);
      setItems([]);
      setEventName(null);
      setEmptyMessage('לא הצלחנו לטעון קליקים לאירוע');
    } finally {
      setLoading(false);
    }
  }, [authId, isShadowUser]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, emptyMessage, eventName, refresh };
}
