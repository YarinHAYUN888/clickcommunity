import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SupabaseProfile {
  id: string;
  user_id: string;
  first_name: string | null;
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

    const fetchProfile = (userId: string) => {
      supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single()
        .then(({ data }) => {
          if (mountedRef.current && data) setProfile(data as SupabaseProfile);
          if (mountedRef.current) setLoading(false);
        });
    };

    // Set up listener BEFORE getSession to avoid missing events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthId(session.user.id);
        fetchProfile(session.user.id);
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
      fetchProfile(session.user.id);
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
