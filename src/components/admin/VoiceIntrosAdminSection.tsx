import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Search, X, User } from 'lucide-react';
import { toast } from 'sonner';
import GlassCard from '@/components/clicks/GlassCard';
import { supabase } from '@/integrations/supabase/client';
import { updateProfileSuitability } from '@/services/admin';
import { notifyProfileUpdated } from '@/hooks/useCurrentUser';
import type { Database } from '@/integrations/supabase/types';
import { VoiceIntroReviewPlayer } from '@/components/admin/VoiceIntroReviewPlayer';
import { subscribePostgresChannel, unsubscribeRealtimeChannel } from '@/lib/supabaseRealtime';

type ProfileRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  | 'user_id'
  | 'first_name'
  | 'last_name'
  | 'avatar_url'
  | 'photos'
  | 'created_at'
  | 'profile_completed'
  | 'voice_intro_url'
  | 'voice_intro_duration'
  | 'voice_intro_status'
  | 'moderation_status'
  | 'moderation_reason'
  | 'suitability_status'
  | 'is_shadow'
>;

const PAGE_SIZE = 50;

const filterOptions = [
  { key: 'all', label: 'כל המשתמשים' },
  { key: 'has_recording', label: 'קיימת הקלטה' },
  { key: 'no_recording', label: 'אין הקלטה' },
  { key: 'pending', label: 'דורש אימות ידני' },
  { key: 'approved', label: 'אושר' },
  { key: 'rejected', label: 'נדחה' },
] as const;

type FilterKey = (typeof filterOptions)[number]['key'];

function formatDate(d: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('he-IL');
  } catch {
    return '—';
  }
}

function voiceStatusLabel(row: ProfileRow) {
  if (row.voice_intro_url && row.voice_intro_status === 'uploaded') return 'הועלה';
  if (row.voice_intro_status === 'pending') return 'בהעלאה';
  if (row.voice_intro_status === 'failed') return 'העלאה נכשלה';
  return 'לא קיימת הקלטה';
}

import {
  hasPlayableVoiceIntro,
  moderationDisplayLabel,
} from '@/lib/admin/voiceIntroAccess';

export function VoiceIntrosAdminSection() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [playingUserId, setPlayingUserId] = useState<string | null>(null);
  const [shadowConfirmUserId, setShadowConfirmUserId] = useState<string | null>(null);

  const shadowConfirmRow = useMemo(
    () => rows.find((r) => r.user_id === shadowConfirmUserId) ?? null,
    [rows, shadowConfirmUserId],
  );

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const buildQuery = useCallback(
    (from: number, to: number) => {
      let q = supabase
        .from('profiles')
        .select(
          'user_id, first_name, last_name, avatar_url, photos, created_at, profile_completed, voice_intro_url, voice_intro_duration, voice_intro_status, moderation_status, moderation_reason, suitability_status, is_shadow',
        )
        .or('profile_completed.eq.true,moderation_status.eq.pending,moderation_status.eq.rejected');

      if (filter === 'has_recording') {
        q = q.eq('voice_intro_status', 'uploaded').not('voice_intro_url', 'is', null);
      } else if (filter === 'no_recording') {
        q = q.or('voice_intro_url.is.null,voice_intro_status.neq.uploaded');
      } else if (filter === 'pending') {
        q = q.eq('moderation_status', 'pending');
      } else if (filter === 'approved') {
        q = q.eq('moderation_status', 'approved');
      } else if (filter === 'rejected') {
        q = q.eq('moderation_status', 'rejected');
      }

      if (searchDebounced) {
        const s = searchDebounced.replace(/%/g, '');
        q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%`);
      }

      return q.order('created_at', { ascending: false }).range(from, to);
    },
    [filter, searchDebounced],
  );

  const loadRows = useCallback(
    async (reset = true) => {
      const start = reset ? 0 : offsetRef.current;
      if (reset) {
        setLoading(true);
        offsetRef.current = 0;
      } else {
        setLoadingMore(true);
      }

      const { data, error } = await buildQuery(start, start + PAGE_SIZE - 1);

      if (error) {
        console.error(error);
        if (reset) setRows([]);
        toast.error('לא ניתן לטעון רשימת הקלטות');
      } else {
        const next = (data || []) as ProfileRow[];
        if (reset) {
          setRows(next);
          offsetRef.current = next.length;
        } else {
          setRows((prev) => {
            const ids = new Set(prev.map((r) => r.user_id));
            return [...prev, ...next.filter((r) => !ids.has(r.user_id))];
          });
          offsetRef.current = start + next.length;
        }
        setHasMore(next.length === PAGE_SIZE);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [buildQuery],
  );

  const loadRowsRef = useRef(loadRows);
  loadRowsRef.current = loadRows;

  useEffect(() => {
    if (!panelOpen) {
      setPlayingUserId(null);
      return;
    }
    const channel = subscribePostgresChannel('admin-voice-intros', [
      {
        event: '*',
        schema: 'public',
        table: 'profiles',
        callback: () => void loadRowsRef.current(true),
      },
    ]);
    return () => unsubscribeRealtimeChannel(channel);
  }, [panelOpen]);

  useEffect(() => {
    if (!panelOpen) return;
    void loadRows(true);
  }, [panelOpen, filter, searchDebounced, loadRows]);

  const closePanel = () => {
    setPlayingUserId(null);
    setPanelOpen(false);
  };

  async function act(userId: string, suitability_status: 'active' | 'shadow' | 'blocked') {
    setBusyId(userId);
    try {
      const is_shadow = suitability_status === 'shadow';
      const moderation_status =
        suitability_status === 'active'
          ? 'approved'
          : suitability_status === 'blocked'
            ? 'rejected'
            : 'approved';
      const row = rows.find((r) => r.user_id === userId);
      const hasPhotos =
        (Array.isArray(row?.photos) && row.photos.some((u) => typeof u === 'string' && u.length > 0)) ||
        !!(row?.avatar_url && String(row.avatar_url).length > 0);
      const { data: admin } = await supabase.auth.getUser();
      await updateProfileSuitability(userId, {
        suitability_status,
        is_shadow,
        moderation_status,
        moderation_reviewed_at: new Date().toISOString(),
        moderation_reviewed_by: admin.user?.id ?? null,
        ...(suitability_status === 'active' && {
          profile_completed: true,
          ...(hasPhotos ? { image_upload_status: 'success' as const } : {}),
        }),
      });
      await loadRows(true);
      notifyProfileUpdated(userId);
      toast.success('סטטוס המשתמש עודכן בהצלחה');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'עדכון סטטוס נכשל');
    } finally {
      setBusyId(null);
    }
  }

  const uploadedCount = useMemo(
    () => rows.filter((r) => hasPlayableVoiceIntro(r)).length,
    [rows],
  );

  return (
    <>
      <motion.div whileTap={{ scale: 0.98 }}>
        <GlassCard
          variant="strong"
          className="p-4 h-20 flex items-center gap-3 cursor-pointer"
          onClick={() => setPanelOpen(true)}
        >
          <Mic size={28} className="text-primary flex-shrink-0" />
          <span className="font-semibold text-foreground text-sm flex-1">הקלטות משתמשים</span>
        </GlassCard>
      </motion.div>

      <AnimatePresence>
        {panelOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              aria-label="סגירה"
              onClick={closePanel}
            />
            <motion.div
              dir="rtl"
              className="relative w-full max-w-lg max-h-[min(90dvh,720px)] overflow-hidden rounded-2xl bg-card border border-border shadow-2xl flex flex-col"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-foreground">הקלטות משתמשים</h2>
                  {!loading && rows.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {rows.length} משתמשים · {uploadedCount} עם הקלטה
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={closePanel}
                  className="p-2 rounded-xl hover:bg-muted/80 transition-colors"
                >
                  <X size={20} className="text-muted-foreground" />
                </button>
              </div>

              <div className="shrink-0 px-4 py-3 border-b border-border space-y-3">
                <div className="relative">
                  <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="חיפוש לפי שם..."
                    className="w-full h-10 rounded-xl border border-border bg-background pr-10 pl-3 text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setFilter(opt.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        filter === opt.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:bg-muted/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-8">טוען…</p>
                ) : rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">אין משתמשים להצגה</p>
                ) : (
                  rows.map((r) => {
                    const img = r.photos?.[0] || r.avatar_url;
                    const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || 'ללא שם';
                    const isPending = r.moderation_status === 'pending';
                    const playable = hasPlayableVoiceIntro(r);

                    return (
                      <GlassCard
                        key={r.user_id}
                        variant="strong"
                        className={`p-4 flex flex-col gap-2 ${
                          isPending ? 'border-destructive/40 bg-destructive/5' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                            {img ? (
                              <img src={img} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User size={20} className="text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-right">
                            <p className="font-semibold text-foreground truncate">{name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              הרשמה: {formatDate(r.created_at)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                          <p>
                            סטטוס הרשמה:{' '}
                            <span className="text-foreground font-medium">
                              {r.profile_completed ? 'הושלם' : 'בתהליך'}
                            </span>
                          </p>
                          <p>
                            סטטוס הקלטה:{' '}
                            <span className="text-foreground font-medium">{voiceStatusLabel(r)}</span>
                          </p>
                          <p>
                            משך:{' '}
                            <span className="text-foreground font-medium">
                              {r.voice_intro_duration != null && r.voice_intro_duration > 0
                                ? `${r.voice_intro_duration} שנ׳`
                                : '—'}
                            </span>
                          </p>
                          <p>
                            אימות:{' '}
                            <span
                              className={`font-medium ${
                                isPending ? 'text-destructive' : 'text-foreground'
                              }`}
                            >
                              {moderationDisplayLabel(r.moderation_status)}
                            </span>
                          </p>
                        </div>

                        {r.moderation_reason && isPending && (
                          <p className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-2 py-1.5">
                            סיבה: <span className="text-foreground">{r.moderation_reason}</span>
                          </p>
                        )}

                        {playable && (
                          <VoiceIntroReviewPlayer
                            objectPath={r.voice_intro_url}
                            durationSeconds={r.voice_intro_duration}
                            userId={r.user_id}
                            lazy
                            hideDownload
                            isActive={playingUserId === null || playingUserId === r.user_id}
                            onRequestPlay={() => setPlayingUserId(r.user_id)}
                          />
                        )}

                        {isPending && (
                          <div className="flex flex-col gap-2 pt-1">
                            <button
                              type="button"
                              disabled={busyId === r.user_id}
                              onClick={() => void act(r.user_id, 'active')}
                              className="w-full py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-50"
                            >
                              אישור לקהילה
                            </button>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                disabled={busyId === r.user_id}
                                onClick={() => setShadowConfirmUserId(r.user_id)}
                                className="py-2 rounded-xl text-xs font-semibold border border-border hover:bg-muted/60 disabled:opacity-50"
                              >
                                סביבה מבודדת
                              </button>
                              <button
                                type="button"
                                disabled={busyId === r.user_id}
                                onClick={() => void act(r.user_id, 'blocked')}
                                className="py-2 rounded-xl text-xs font-semibold text-destructive border border-destructive/40 hover:bg-destructive/10 disabled:opacity-50"
                              >
                                דחייה
                              </button>
                            </div>
                          </div>
                        )}
                      </GlassCard>
                    );
                  })
                )}

                {!loading && hasMore && (
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void loadRows(false)}
                    className="w-full py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-muted/60 disabled:opacity-50"
                  >
                    {loadingMore ? 'טוען…' : 'הצג עוד'}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shadowConfirmRow && (
          <motion.div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              aria-label="סגירה"
              onClick={() => setShadowConfirmUserId(null)}
            />
            <motion.div
              dir="rtl"
              className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-5 space-y-4"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
            >
              <h3 className="text-lg font-bold text-foreground">העברה לסביבה מבודדת</h3>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {shadowConfirmRow.first_name || 'משתמש/ת'}
                </span>
                {' '}יועבר/ת לקהילה נפרדת. המשתמש/ת לא יראה/תראה את המילה &quot;מבודד&quot;.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShadowConfirmUserId(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-border"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  disabled={busyId === shadowConfirmRow.user_id}
                  onClick={() => {
                    const userId = shadowConfirmRow.user_id;
                    setShadowConfirmUserId(null);
                    void act(userId, 'shadow');
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50"
                >
                  אישור העברה
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
