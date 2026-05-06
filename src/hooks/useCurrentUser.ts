import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SupabaseProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  photos: string[] | null;
  occupation: string | null;
  bio: string | null;
  interests: string[] | null;
  avatar_url: string | null;
  role: string | null;
  status: string | null;
  subscription_status: string | null;
  profile_completion: number | null;
  super_role: string | null;
  suspended: boolean | null;
  suitability_status?: string | null;
  is_shadow?: boolean | null;
  risk_flags?: unknown;
  ai_summary?: string | null;
  moderation_status?: string | null;
  moderation_reason?: string | null;
  moderation_confidence?: number | null;
  moderation_flags?: unknown;
  profile_completed?: boolean | null;
  image_upload_status?: string | null;
}

export interface CurrentUser {
  authId: string;
  profile: SupabaseProfile | null;
  role: 'guest' | 'member';
  loading: boolean;
}

export function useCurrentUser(): CurrentUser {
  const [authId, setAuthId] = useState<string | null>(null);
  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const fetchProfile = (userId: string, userMeta?: { first_name?: unknown; last_name?: unknown }) => {
      if (mountedRef.current) setLoading(true);
      supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
        .then(async ({ data, error }) => {
          if (error) console.error('useCurrentUser fetchProfile:', error.message);
          if (!error) console.info('[useCurrentUser] profile fetch success', { userId, found: !!data });
          let profileData = (data as SupabaseProfile | null) ?? null;
          if (!profileData) {
            const firstName =
              typeof userMeta?.first_name === 'string' ? userMeta.first_name.trim() : '';
            const lastName =
              typeof userMeta?.last_name === 'string' ? userMeta.last_name.trim() : '';

            // Self-heal: create missing profile row for authenticated user.
            const { error: upsertErr } = await supabase
              .from('profiles')
              .upsert(
                {
                  user_id: userId,
                  first_name: firstName || null,
                  last_name: lastName || null,
                },
                { onConflict: 'user_id' }
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

          if (mountedRef.current) setProfile(profileData);
          if (profileData) {
            console.info('[useCurrentUser] profile state', {
              userId,
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
    };

    // Set up listener BEFORE getSession to avoid missing events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        if (mountedRef.current) setProfile(null);
        setAuthId(session.user.id);
        fetchProfile(session.user.id, session.user.user_metadata ?? undefined);
      } else {
        setAuthId(null);
        setProfile(null);
        if (mountedRef.current) setLoading(false);
      }
    });

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        if (mountedRef.current) setLoading(false);
        return;
      }
      setAuthId(session.user.id);
      fetchProfile(session.user.id, session.user.user_metadata ?? undefined);
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    authId: authId || '',
    profile,
    role: (profile?.role as 'guest' | 'member') || 'guest',
    loading,
  };
}
