import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ensureCommunityMemberDefaults } from '@/services/profileSavePipeline';
import { DEFAULT_NEW_USER_ROLE_FALLBACK } from '@/lib/profileCompletion';
import type { CurrentUser, SupabaseProfile } from '@/hooks/useCurrentUser';
import { profileListeners } from '@/hooks/useCurrentUser';

const CurrentUserContext = createContext<CurrentUser | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [authId, setAuthId] = useState<string | null>(null);
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const profileRef = useRef<SupabaseProfile | null>(null);
  profileRef.current = profile;

  const fetchProfile = useCallback(
    (userId: string, userMeta?: { first_name?: unknown; last_name?: unknown }, silent = false) => {
      if (!silent && mountedRef.current) setLoading(true);
      supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
        .then(async ({ data, error }) => {
          if (error && import.meta.env.DEV) console.error('useCurrentUser fetchProfile:', error.message);
          if (!error && import.meta.env.DEV) {
            console.info('[useCurrentUser] profile fetch success', { userId, found: !!data });
          }
          let profileData = (data as SupabaseProfile | null) ?? null;
          if (!profileData) {
            const firstName =
              typeof userMeta?.first_name === 'string' ? userMeta.first_name.trim() : '';
            const lastName =
              typeof userMeta?.last_name === 'string' ? userMeta.last_name.trim() : '';

            const { error: upsertErr } = await supabase
              .from('profiles')
              .upsert(
                {
                  user_id: userId,
                  first_name: firstName || null,
                  last_name: lastName || null,
                  role: DEFAULT_NEW_USER_ROLE_FALLBACK,
                  moderation_status: 'pending',
                  suitability_status: 'pending',
                  is_shadow: false,
                  profile_completed: false,
                  image_upload_status: 'pending',
                },
                { onConflict: 'user_id' },
              );
            if (upsertErr) {
              console.error('useCurrentUser profile self-heal failed:', upsertErr.message);
            } else {
              const { data: refetched, error: refetchErr } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();
              if (refetchErr) console.error('useCurrentUser refetch after self-heal failed:', refetchErr.message);
              profileData = (refetched as SupabaseProfile | null) ?? null;
            }
          }

          if (profileData && !profileData.role) {
            try {
              await ensureCommunityMemberDefaults(userId);
              const { data: healed } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();
              if (healed) profileData = healed as SupabaseProfile;
            } catch (healErr) {
              console.warn('[useCurrentUser] profile defaults heal failed', healErr);
            }
          }

          if (mountedRef.current) setProfile(profileData);
          if (profileData) {
            console.info('[useCurrentUser] profile state', {
              userId,
              role: profileData.role,
              suitability: profileData.suitability_status,
              completed: profileData.profile_completed,
              imageUpload: profileData.image_upload_status,
            });
          }
          if (mountedRef.current) setLoading(false);
        })
        .catch((e) => {
          console.error('useCurrentUser fetchProfile failed:', e);
          if (mountedRef.current) setLoading(false);
        });
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        if (session?.user?.id) setAuthId(session.user.id);
        return;
      }

      if (!session?.user) {
        setAuthId(null);
        setProfile(null);
        if (mountedRef.current) setLoading(false);
        return;
      }

      const userId = session.user.id;
      setAuthId(userId);

      const hasProfile = !!profileRef.current;
      const silent = event !== 'SIGNED_IN' && hasProfile;
      if (event === 'SIGNED_IN' && mountedRef.current) setProfile(null);

      fetchProfile(userId, session.user.user_metadata ?? undefined, silent);
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  useEffect(() => {
    if (!authId) return;

    const pull = () => {
      supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!mountedRef.current || error) return;
          setProfile((data as SupabaseProfile) ?? null);
        });
    };

    const onExternalUpdate = (userId: string) => {
      if (userId === authId) pull();
    };
    profileListeners.add(onExternalUpdate);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`profiles-self-${authId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${authId}` },
          () => {
            pull();
          },
        )
        .subscribe();
    } catch (e) {
      console.warn('[useCurrentUser] profile realtime subscribe failed:', e);
    }

    return () => {
      profileListeners.delete(onExternalUpdate);
      if (channel) {
        try {
          void supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [authId]);

  const value: CurrentUser = {
    authId: authId || '',
    profile,
    role: (profile?.role as 'guest' | 'member') || 'guest',
    loading,
  };

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUserContext(): CurrentUser {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) throw new Error('useCurrentUser must be used within CurrentUserProvider');
  return ctx;
}
