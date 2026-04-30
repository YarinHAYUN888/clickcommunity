import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, CalendarCheck, CalendarDays } from 'lucide-react';
import EventCard from '@/components/clicks/EventCard';
import EventsCalendarView from '@/components/clicks/EventsCalendarView';
import { getUpcomingEvents, getPastEvents, EventRow } from '@/services/events';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/hooks/useCurrentUser';

type TabId = 'upcoming' | 'past' | 'calendar';

const TABS: { id: TabId; label: string }[] = [
  { id: 'upcoming', label: 'הקרובים' },
  { id: 'calendar', label: 'לוח שנה' },
  { id: 'past', label: 'עברו' },
];

export default function EventsPage() {
  const [tab, setTab] = useState<TabId>('upcoming');
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { authId } = useCurrentUser();

  useEffect(() => {
    if (tab === 'calendar') {
      // Calendar view manages its own data
      setLoading(false);
      return;
    }
    setLoading(true);
    const fetch = tab === 'upcoming' ? getUpcomingEvents : getPastEvents;
    fetch()
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="min-h-screen pb-4">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 glass-strong px-6 pt-[env(safe-area-inset-top)] pb-3 border-b border-border/30">
        <div className="flex items-center gap-2 pt-4 mb-3">
          <h1 className="text-xl md:text-2xl text-h1-premium text-foreground">אירועים</h1>
          <Calendar size={22} className="text-accent" />
        </div>

        {/* Tab Toggle (3 segments) */}
        <div className="flex justify-center">
          <div className="relative flex bg-secondary rounded-[999px] p-1 w-full max-w-[360px]">
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="relative z-10 flex-1 px-3 py-2 text-sm font-medium transition-colors rounded-[999px] inline-flex items-center justify-center gap-1.5"
                  style={{
                    color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  }}
                >
                  {t.id === 'calendar' && <CalendarDays size={14} />}
                  {t.label}
                  {active && (
                    <motion.span
                      layoutId="events-tab-indicator"
                      className="absolute inset-0 rounded-[999px] bg-card shadow-sm"
                      style={{ zIndex: -1 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 lg:px-8 pt-4 max-w-[640px] mx-auto">
        <AnimatePresence mode="wait">
          {tab === 'calendar' ? (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <EventsCalendarView currentUserId={authId || undefined} />
            </motion.div>
          ) : loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {[0, 1].map(i => (
                <div key={i} className="rounded-2xl overflow-hidden shadow-glass">
                  <Skeleton className="h-44 w-full" />
                  <div className="p-4 space-y-3 bg-card">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-2 w-full rounded-full" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : events.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center py-20"
            >
              {tab === 'upcoming' ? (
                <>
                  <EmptyIcon icon={<Calendar size={42} className="text-primary" />} />
                  <p className="text-[22px] text-h1-premium text-foreground">אין אירועים כרגע</p>
                  <p className="text-sm text-muted-foreground mt-1">אירועים חדשים יפורסמו כאן בקרוב</p>
                </>
              ) : (
                <>
                  <EmptyIcon icon={<CalendarCheck size={42} className="text-primary" />} />
                  <p className="text-[22px] text-h1-premium text-foreground">אין אירועים קודמים</p>
                  <p className="text-sm text-muted-foreground mt-1">אחרי שתשתתף/י באירוע, הוא יופיע כאן</p>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {events.map((event, index) => (
                <EventCard key={event.id} event={event} index={index} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function EmptyIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="relative mx-auto mb-6 w-24 h-24 flex items-center justify-center">
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/15 to-accent/15 animate-breathe" />
      <span className="absolute -top-3 -left-4 w-12 h-12 rounded-full blur-2xl" style={{ background: 'rgba(236,72,153,0.18)' }} />
      <span className="absolute -bottom-2 -right-3 w-10 h-10 rounded-full blur-2xl" style={{ background: 'rgba(124,58,237,0.18)' }} />
      <span className="relative">{icon}</span>
    </div>
  );
}
