import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { checkSuperUser } from '@/services/admin';

interface AdminContextType {
  superRole: string | null;
  isSuperUser: boolean;
  loading: boolean;
}

const AdminContext = createContext<AdminContextType>({ superRole: null, isSuperUser: false, loading: true });

export function AdminProvider({ children }: { children: ReactNode }) {
  const [superRole, setSuperRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && mounted) {
        const role = await checkSuperUser(session.user.id);
        if (mounted) setSuperRole(role);
      }
      if (mounted) setLoading(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // Fire and forget — never await inside onAuthStateChange
        checkSuperUser(session.user.id).then(role => {
          if (mounted) setSuperRole(role);
        });
      } else {
        if (mounted) setSuperRole(null);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  return (
    <AdminContext.Provider value={{ superRole, isSuperUser: !!superRole, loading }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
