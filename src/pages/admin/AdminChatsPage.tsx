import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MessageCircle, Users, Lock, Unlock, Megaphone, X } from 'lucide-react';
import { LumaSpin } from '@/components/ui/luma-spin';
import GlassCard from '@/components/clicks/GlassCard';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/integrations/supabase/client';
import { performAdminAction } from '@/services/admin';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';

export default function AdminChatsPage() {
  const navigate = useNavigate();
  const { isSuperUser } = useAdmin();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!isSuperUser) { navigate('/clicks', { replace: true }); return; }
    (async () => {
      const { data } = await supabase
        .from('chats')
        .select('*, chat_participants(user_id, removed)')
        .order('updated_at', { ascending: false });
      setChats(data || []);
      setLoading(false);
    })();
  }, [isSuperUser]);

  const doAction = async (action: string, chatId: string, details?: any) => {
    setActionLoading(true);
    try {
      await performAdminAction(action, 'chat', chatId, details);
      toast.success('הפעולה בוצעה ✓');
      setSelectedChat(null);
      // Refresh
      const { data } = await supabase.from('chats').select('*, chat_participants(user_id, removed)').order('updated_at', { ascending: false });
      setChats(data || []);
    } catch { toast.error('שגיאה'); }
    setActionLoading(false);
  };

  const getChatStatus = (chat: any) => {
    if (chat.announcements_only) return { label: 'הכרזות', cls: 'bg-warning/10 text-warning' };
    if (chat.is_closed) return { label: 'נסגר', cls: 'bg-muted text-muted-foreground' };
    if (chat.expires_at && new Date(chat.expires_at) <= new Date()) return { label: 'פג תוקף', cls: 'bg-muted text-muted-foreground' };
    return { label: 'פעיל', cls: 'bg-success/10 text-success' };
  };

  return (
    <div className="min-h-screen gradient-bg pb-24">
      <div className="px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 pt-4 mb-4">
          <button onClick={() => navigate('/admin')} className="text-primary"><ArrowRight size={24} /></button>
          <h1 className="text-xl font-bold text-foreground">ניהול צ׳אטים</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><LumaSpin size={48} /></div>
        ) : chats.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">אין צ׳אטים</p>
        ) : (
          <div className="space-y-2">
            {chats.map(chat => {
              const status = getChatStatus(chat);
              const participantCount = chat.chat_participants?.filter((p: any) => !p.removed)?.length || 0;
              return (
                <GlassCard key={chat.id} variant="strong" className="p-3 cursor-pointer" onClick={() => setSelectedChat(chat)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {chat.type === 'dm' ? <MessageCircle size={18} className="text-primary" /> : <Users size={18} className="text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{chat.type === 'dm' ? 'הודעה פרטית' : 'קבוצתי'}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${status.cls}`}>{status.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{participantCount} משתתפים · {new Date(chat.updated_at).toLocaleDateString('he-IL')}</p>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Chat Panel */}
      <AnimatePresence>
        {selectedChat && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40" onClick={() => setSelectedChat(null)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed bottom-0 inset-x-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl">
              <GlassCard variant="strong" className="p-5 space-y-4 rounded-t-2xl rounded-b-none">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-foreground">{selectedChat.type === 'dm' ? 'הודעה פרטית' : 'צ׳אט קבוצתי'}</h3>
                  <button onClick={() => setSelectedChat(null)}><X size={20} className="text-muted-foreground" /></button>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => doAction('set_announcements_mode', selectedChat.id, { enabled: !selectedChat.announcements_only })}
                    disabled={actionLoading}
                    className="w-full h-11 rounded-xl border border-primary text-primary text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Megaphone size={16} />
                    {selectedChat.announcements_only ? 'בטל מצב הכרזות' : 'הפעל מצב הכרזות'}
                  </button>

                  {selectedChat.is_closed ? (
                    <button onClick={() => doAction('reopen_chat', selectedChat.id)} disabled={actionLoading} className="w-full h-11 rounded-xl bg-success/10 text-success text-sm font-medium flex items-center justify-center gap-2">
                      <Unlock size={16} /> פתח מחדש
                    </button>
                  ) : (
                    <button onClick={() => doAction('close_chat', selectedChat.id)} disabled={actionLoading} className="w-full h-11 rounded-xl bg-destructive/10 text-destructive text-sm font-medium flex items-center justify-center gap-2">
                      <Lock size={16} /> סגור צ׳אט
                    </button>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
