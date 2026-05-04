import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, X, User } from 'lucide-react';
import GlassCard from '@/components/clicks/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { updateProfileSuitability } from '@/services/admin';
import type { Database } from '@/integrations/supabase/types';
import { formatQuestionnaireForAdmin } from '@/data/introductionQuestionnaire';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export function UserReviewSection() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refreshCount = useCallback(async () => {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .neq('suitability_status', 'active');
    if (!error && count != null) setBadgeCount(count);
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('suitability_status', 'active')
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows((data || []) as ProfileRow[]);
    }
    setLoading(false);
    void refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    if (!panelOpen) return;
    void loadRows();
    const channel = supabase
      .channel('admin-profiles-suitability')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          void loadRows();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [panelOpen, loadRows]);

  async function act(userId: string, suitability_status: 'active' | 'shadow' | 'blocked') {
    setBusyId(userId);
    try {
      const is_shadow = suitability_status === 'shadow';
      await updateProfileSuitability(userId, { suitability_status, is_shadow });
      await loadRows();
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <motion.div whileTap={{ scale: 0.98 }}>
        <GlassCard
          variant="strong"
          className="p-4 h-20 flex items-center gap-3 cursor-pointer"
          onClick={() => setPanelOpen(true)}
        >
          <div className="relative">
            <ClipboardList size={28} className="text-primary flex-shrink-0" />
            {badgeCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
          </div>
          <span className="font-semibold text-foreground text-sm flex-1">אישור משתמשים</span>
        </GlassCard>
      </motion.div>

      <AnimatePresence>
        {panelOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              aria-label="סגירה"
              onClick={() => setPanelOpen(false)}
            />
            <motion.div
              dir="rtl"
              className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-t-3xl md:rounded-3xl bg-card border border-border shadow-2xl flex flex-col"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="text-lg font-bold text-foreground">אישור משתמשים</h2>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="p-2 rounded-xl hover:bg-muted/80 transition-colors"
                >
                  <X size={20} className="text-muted-foreground" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-3">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-8">טוען…</p>
                ) : rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">אין משתמשים הממתינים לאישור</p>
                ) : (
                  rows.map((r) => {
                    const img = r.photos?.[0] || r.avatar_url;
                    const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || 'ללא שם';
                    const email = '—';
                    const questionnaireRows = formatQuestionnaireForAdmin(r.questionnaire_responses);
                    return (
                      <GlassCard key={r.user_id} variant="strong" className="p-4 flex flex-col gap-3">
                        <div className="flex gap-3">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                            {img ? (
                              <img src={img} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User size={24} className="text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-right">
                            <p className="font-semibold text-foreground truncate">{name}</p>
                            <p className="text-xs text-muted-foreground">{email}</p>
                            <p className="text-xs font-medium text-primary mt-1">סטטוס: {r.suitability_status}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {(r.interests || []).join(', ') || 'אין תחומי עניין'}
                        </p>
                        {questionnaireRows.some((row) => row.answer !== '—') && (
                          <div className="text-xs bg-muted/30 rounded-xl p-3 space-y-2 text-right border border-border/50">
                            <p className="font-semibold text-foreground">שאלון היכרות</p>
                            <ul className="space-y-1.5 text-muted-foreground leading-relaxed">
                              {questionnaireRows.map((row) => (
                                <li key={row.title}>
                                  <span className="text-foreground/80 font-medium">{row.title}</span>
                                  <span className="mx-1">—</span>
                                  <span>{row.answer}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {r.ai_summary && (
                          <p className="text-xs text-foreground/90 bg-muted/40 rounded-xl p-2 leading-relaxed">
                            {r.ai_summary}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 justify-end">
                          <button
                            type="button"
                            disabled={busyId === r.user_id}
                            onClick={() => void act(r.user_id, 'active')}
                            className="px-3 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-50 transition-opacity"
                          >
                            אישור
                          </button>
                          <button
                            type="button"
                            disabled={busyId === r.user_id}
                            onClick={() => void act(r.user_id, 'shadow')}
                            className="px-3 py-2 rounded-xl text-xs font-semibold border border-border hover:bg-muted/60 disabled:opacity-50 transition-colors"
                          >
                            סביבה מבודדת
                          </button>
                          <button
                            type="button"
                            disabled={busyId === r.user_id}
                            onClick={() => void act(r.user_id, 'blocked')}
                            className="px-3 py-2 rounded-xl text-xs font-semibold text-destructive border border-destructive/40 hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                          >
                            חסימה
                          </button>
                        </div>
                      </GlassCard>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
