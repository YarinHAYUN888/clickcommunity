import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { checkSuperUser } from '@/services/admin';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface AdminContextType {
  superRole: string | null;
  isSuperUser: boolean;
  loading: boolean;
}

const AdminContext = createContext<AdminContextType>({ superRole: null, isSuperUser: false, loading: true });

export function AdminProvider({ children }: { children: ReactNode }) {
  const { profile, loading: profileLoading } = useCurrentUser();
  const [remoteSuperRole, setRemoteSuperRole] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  /** פרופיל מה־hook כולל super_role מיד כשהטעינה מסתיימת — לא תלוי רק בקריאה נפרדת */
  const superRole = useMemo(() => {
    const fromProfile = profile?.super_role?.trim();
    if (fromProfile) return fromProfile;
    return remoteSuperRole;
  }, [profile?.super_role, remoteSuperRole]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && mounted) {
        const role = await checkSuperUser(session.user.id);
        if (mounted) setRemoteSuperRole(role);
      } else if (mounted) {
        setRemoteSuperRole(null);
      }
      if (mounted) setSessionChecked(true);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        checkSuperUser(session.user.id).then((role) => {
          if (mounted) setRemoteSuperRole(role);
        });
      } else {
        if (mounted) setRemoteSuperRole(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loading = profileLoading || !sessionChecked;

  return (
    <AdminContext.Provider value={{ superRole, isSuperUser: !!superRole, loading }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
