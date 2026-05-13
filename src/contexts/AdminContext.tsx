import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { checkSuperUser } from '@/services/admin';
import {
  computeAutomationTechnicalAccess,
  parseAutomationDeveloperEmails,
  readTechnicalViewFromStorage,
  writeTechnicalViewToStorage,
} from '@/lib/automationAccess';

interface AdminContextType {
  superRole: string | null;
  isSuperUser: boolean;
  loading: boolean;
  userEmail: string | null;
  /** Webhooks, n8n, raw logs, retries — never for pure community-manager UX */
  automationTechnicalAccess: boolean;
  /** Super users who are not forced-developer may toggle technical surfaces */
  canToggleAutomationTechnicalView: boolean;
  setAutomationTechnicalView: (enabled: boolean) => void;
}

const AdminContext = createContext<AdminContextType>({
  superRole: null,
  isSuperUser: false,
  loading: true,
  userEmail: null,
  automationTechnicalAccess: false,
  canToggleAutomationTechnicalView: false,
  setAutomationTechnicalView: () => {},
});

export function AdminProvider({ children }: { children: ReactNode }) {
  const [superRole, setSuperRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lsTechnicalView, setLsTechnicalView] = useState(() => readTechnicalViewFromStorage());

  const isSuperUser = !!superRole;

  const emailInDevAllowlist = useMemo(() => {
    const e = (userEmail ?? '').trim().toLowerCase();
    return e.length > 0 && parseAutomationDeveloperEmails().has(e);
  }, [userEmail]);

  const forcedTechnicalAccess = superRole === 'developer' || emailInDevAllowlist;

  const canToggleAutomationTechnicalView = isSuperUser && !forcedTechnicalAccess;

  const automationTechnicalAccess = useMemo(
    () =>
      computeAutomationTechnicalAccess({
        isSuperUser,
        superRole,
        userEmail,
        localStorageTechnicalView: lsTechnicalView,
      }),
    [isSuperUser, superRole, userEmail, lsTechnicalView],
  );

  const setAutomationTechnicalView = useCallback(
    (enabled: boolean) => {
      if (!canToggleAutomationTechnicalView) return;
      writeTechnicalViewToStorage(enabled);
      setLsTechnicalView(enabled);
    },
    [canToggleAutomationTechnicalView],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && mounted) {
        setUserEmail(session.user.email ?? null);
        const role = await checkSuperUser(session.user.id);
        if (mounted) setSuperRole(role);
      } else if (mounted) {
        setUserEmail(null);
        setSuperRole(null);
      }
      if (mounted) setLoading(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email ?? null);
        checkSuperUser(session.user.id).then((role) => {
          if (mounted) setSuperRole(role);
        });
      } else {
        setUserEmail(null);
        setSuperRole(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      superRole,
      isSuperUser,
      loading,
      userEmail,
      automationTechnicalAccess,
      canToggleAutomationTechnicalView,
      setAutomationTechnicalView,
    }),
    [
      superRole,
      isSuperUser,
      loading,
      userEmail,
      automationTechnicalAccess,
      canToggleAutomationTechnicalView,
      setAutomationTechnicalView,
    ],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  return useContext(AdminContext);
}
