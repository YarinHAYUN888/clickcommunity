import { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Megaphone } from 'lucide-react';
import { SpinnerOverlay } from '@/components/ui/luma-spin';
import { useAdmin } from '@/contexts/AdminContext';
import { getClientAutomationMode } from '@/lib/automationEnv';
import { readTechnicalViewFromStorage } from '@/lib/automationAccess';
import { AUTOMATION_TAB_IDS, type AutomationTabId } from '@/components/admin/automation/constants';
import { AutomationDeveloperShell } from '@/components/admin/automation/AutomationDeveloperShell';
import { AutomationManagerWizard } from '@/components/admin/automation/manager/AutomationManagerWizard';
import { ManagerHub, type ManagerSection } from '@/components/admin/automation/manager/ManagerHub';
import { ManagerTemplatesPanel } from '@/components/admin/automation/manager/ManagerTemplatesPanel';
import { ManagerHistoryPanel } from '@/components/admin/automation/manager/ManagerHistoryPanel';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function AdminAutomationPage() {
  const navigate = useNavigate();
  const {
    isSuperUser,
    loading: adminLoading,
    automationTechnicalAccess,
    canToggleAutomationTechnicalView,
    setAutomationTechnicalView,
  } = useAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'templates';
  const view = searchParams.get('view') || 'manager';

  // Manager-side navigation state (hub / wizard / templates / history)
  const [managerSection, setManagerSection] = useState<ManagerSection | 'hub'>('hub');

  const validTab = useMemo((): AutomationTabId => {
    return AUTOMATION_TAB_IDS.includes(tab as AutomationTabId) ? (tab as AutomationTabId) : 'templates';
  }, [tab]);

  const managerTitleRef = useRef<HTMLHeadingElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTab = useCallback(
    (t: AutomationTabId) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', t);
        next.set('view', 'dev');
        return next;
      });
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (adminLoading) return;
    if (!isSuperUser) navigate('/clicks', { replace: true });
  }, [adminLoading, isSuperUser, navigate]);

  useEffect(() => {
    if (view === 'dev' && !automationTechnicalAccess) {
      setSearchParams({ view: 'manager' }, { replace: true });
    }
  }, [view, automationTechnicalAccess, setSearchParams]);

  useEffect(() => {
    if (view !== 'dev') return;
    if (tab !== validTab) setSearchParams({ view: 'dev', tab: validTab }, { replace: true });
  }, [view, tab, validTab, setSearchParams]);

  useEffect(() => {
    const technical = searchParams.get('technical');
    if (technical !== '1' || !canToggleAutomationTechnicalView) return;
    if (window.confirm('להפעיל מצב מתקדם (כלים טכניים)?')) {
      setAutomationTechnicalView(true);
      toast.success('מצב מתקדם הופעל');
    }
    const next = new URLSearchParams(searchParams);
    next.delete('technical');
    next.set('view', 'manager');
    setSearchParams(next, { replace: true });
  }, [searchParams, canToggleAutomationTechnicalView, setAutomationTechnicalView, setSearchParams]);

  // Reset manager section when switching back to manager view
  useEffect(() => {
    if (view === 'manager') setManagerSection('hub');
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  // Long-press secret activation on manager title
  const onManagerTitlePointerDown = () => {
    if (!canToggleAutomationTechnicalView) return;
    pressTimer.current = setTimeout(() => {
      const next = !readTechnicalViewFromStorage();
      setAutomationTechnicalView(next);
      toast.message(next ? 'מצב מתקדם: פעיל' : 'מצב מתקדם: כבוי');
    }, 900);
  };
  const clearPressTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  if (adminLoading) return <SpinnerOverlay />;

  const isDevView = view === 'dev' && automationTechnicalAccess;

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-violet-50/80 via-white to-white pb-28"
      dir="rtl"
    >
      <div className="px-4 pt-[env(safe-area-inset-top)] max-w-5xl mx-auto">
        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-4 mb-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (managerSection !== 'hub' && !isDevView) {
                setManagerSection('hub');
              } else {
                navigate('/admin');
              }
            }}
            className="p-2 rounded-xl hover:bg-violet-50 transition-colors -mr-1"
          >
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
          </motion.button>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Megaphone className="h-7 w-7 text-primary" />
              {isDevView ? (
                <>
                  <h1 className="text-2xl font-bold text-foreground">מרכז אוטומציות — מתקדם</h1>
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-violet-100 text-violet-800 font-medium border border-violet-200/80">
                    Webhook: {getClientAutomationMode() === 'production' ? 'production' : 'test'}
                  </span>
                </>
              ) : (
                <h1
                  ref={managerTitleRef}
                  className="text-2xl font-bold text-foreground select-none"
                  onPointerDown={onManagerTitlePointerDown}
                  onPointerUp={clearPressTimer}
                  onPointerLeave={clearPressTimer}
                >
                  מרכז שיווק קהילתי
                </h1>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isDevView
                ? 'תבניות, יומנים, זרימות ואינטגרציה — לשימוש צוות טכני'
                : 'שלח הודעות ממותגות לקהילה — מהיר, נקי ופשוט'}
            </p>
          </div>
        </div>

        {/* ── Mode controls ────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 justify-end mb-4">
          {canToggleAutomationTechnicalView && (
            <div className="flex items-center gap-2 rounded-full border border-violet-100 bg-white/80 px-3 py-1.5">
              <Switch
                id="technical-mode"
                checked={automationTechnicalAccess}
                onCheckedChange={(c) => setAutomationTechnicalView(!!c)}
              />
              <Label htmlFor="technical-mode" className="text-xs cursor-pointer">
                מצב מתקדם
              </Label>
            </div>
          )}
          {automationTechnicalAccess && !isDevView && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setSearchParams({ view: 'dev', tab: 'templates' })}
            >
              כניסה לאזור מפתחים
            </Button>
          )}
          {isDevView && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setSearchParams({ view: 'manager' })}
            >
              חזרה למצב מנהל
            </Button>
          )}
        </div>

        {/* ── Main content ─────────────────────────────────────────────── */}
        {isDevView ? (
          <AutomationDeveloperShell validTab={validTab} onTabChange={setTab} />
        ) : (
          <>
            {managerSection === 'hub' && (
              <ManagerHub onNavigate={(s) => setManagerSection(s)} />
            )}
            {managerSection === 'wizard' && (
              <AutomationManagerWizard onBackToHub={() => setManagerSection('hub')} />
            )}
            {managerSection === 'templates' && (
              <ManagerTemplatesPanel onBack={() => setManagerSection('hub')} />
            )}
            {managerSection === 'history' && (
              <ManagerHistoryPanel onBack={() => setManagerSection('hub')} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
