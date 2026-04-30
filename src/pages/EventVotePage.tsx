import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import GlassCard from '@/components/clicks/GlassCard';
import { getEventById, getVotableAttendees, submitVotes, EventRow } from '@/services/events';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';

interface VoteEntry {
  votee_id: string;
  vote: 'clicked' | 'didnt_talk' | 'no_click';
}

export default function EventVotePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { authId } = useCurrentUser();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [votes, setVotes] = useState<Record<string, VoteEntry['vote']>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!eventId || !authId) return;
    Promise.all([
      getEventById(eventId),
      getVotableAttendees(eventId, authId),
    ]).then(([ev, att]) => {
      setEvent(ev);
      setAttendees(att);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [eventId, authId]);

  const votedCount = Object.keys(votes).length;

  const handleSubmit = async () => {
    if (!eventId) return;
    setSubmitting(true);
    try {
      const voteArray = Object.entries(votes).map(([votee_id, vote]) => ({ votee_id, vote }));
      await submitVotes(eventId, voteArray);
      toast({ title: 'תודה על ההצבעה! 🙏' });
      navigate('/events');
    } catch (err: any) {
      toast({ title: 'שגיאה', description: err.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-4">
        <div className="sticky top-0 z-40 glass-strong px-4 py-3 border-b border-border/30">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="px-4 pt-4 space-y-4">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const formatDate = (d: string) => {
    const date = new Date(d);
    return `${date.getDate()}.${date.getMonth() + 1}`;
  };

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <div className="sticky top-0 z-40 glass-strong px-6 pt-[env(safe-area-inset-top)] pb-4 border-b border-border/30">
        <div className="flex items-center gap-3 pt-4 mb-2">
          <button onClick={() => navigate('/events')} className="p-1"><ArrowRight size={20} /></button>
          <h1 className="text-xl font-bold text-foreground">מי עשה עליך רושם?</h1>
        </div>
        <p className="text-sm text-muted-foreground">דרגו את החדשים שפגשתם באירוע</p>
        {event && (
          <p className="text-sm text-primary font-medium mt-1">{event.name} — {formatDate(event.date)}</p>
        )}
      </div>

      {/* Voting Cards */}
      <div className="px-4 pt-4 space-y-4 max-w-[560px] mx-auto">
        {attendees.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg font-semibold text-foreground">אין חדשים להצבעה באירוע הזה</p>
          </div>
        ) : (
          attendees.map((attendee, i) => (
            <motion.div
              key={attendee.user_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <GlassCard className="p-4">
                <div className="flex items-center gap-4 mb-4">
                  <img
                    src={attendee.avatar_url || attendee.photos?.[0] || '/placeholder.svg'}
                    alt={attendee.first_name || ''}
                    className="w-16 h-16 rounded-full object-cover border-2 border-primary/20"
                  />
                  <div>
                    <h3 className="font-bold text-foreground">{attendee.first_name}</h3>
                    <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-[999px]">חדש 🌱</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { value: 'clicked' as const, label: 'היה קליק 💜', selected: 'bg-primary text-primary-foreground', unselected: 'bg-secondary border border-primary/30 text-primary' },
                    { value: 'didnt_talk' as const, label: 'לא יצא לדבר 🤷', selected: 'bg-muted-foreground text-white', unselected: 'bg-card border border-border text-muted-foreground' },
                    { value: 'no_click' as const, label: 'לא היה קליק', selected: 'bg-destructive/10 text-destructive', unselected: 'bg-card border border-border text-muted-foreground' },
                  ]).map(opt => (
                    <motion.button
                      key={opt.value}
                      whileTap={{ scale: 1.1 }}
                      onClick={() => setVotes(prev => ({ ...prev, [attendee.user_id]: opt.value }))}
                      className={`px-3.5 py-2 rounded-[999px] text-xs font-medium transition-all ${
                        votes[attendee.user_id] === opt.value ? opt.selected : opt.unselected
                      }`}
                    >
                      {opt.label}
                    </motion.button>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          ))
        )}
      </div>

      {/* Sticky Progress + Submit */}
      {attendees.length > 0 && (
        <div className="fixed bottom-20 inset-x-0 z-30 px-6 pb-2 pt-4 bg-gradient-to-t from-background to-transparent">
          <div className="max-w-[560px] mx-auto space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{votedCount}/{attendees.length} הוצבעו</span>
              <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  animate={{ width: `${(votedCount / attendees.length) * 100}%` }}
                />
              </div>
            </div>
            {votedCount === attendees.length && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full rounded-[999px] gradient-primary text-primary-foreground py-3.5 font-semibold text-base active:scale-[0.97] transition-transform disabled:opacity-50"
              >
                {submitting ? '...' : 'סיימתי!'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
