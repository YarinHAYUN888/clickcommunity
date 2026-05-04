import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, MapPin, Clock, CheckCircle, Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { getCalendarEvents, CalendarEvent } from '@/services/events';

interface EventsCalendarViewProps {
  currentUserId?: string;
  isShadowUser?: boolean;
}

/* ---------- Day cell with event dots ---------- */
function DayCellContent({
  date,
  hasClick,
  hasMine,
}: {
  date: Date;
  hasClick: boolean;
  hasMine: boolean;
}) {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <span className="leading-none">{date.getDate()}</span>
      {(hasClick || hasMine) && (
        <div
          className="absolute bottom-1 flex gap-0.5"
          style={{ left: '50%', transform: 'translateX(-50%)' }}
          aria-hidden
        >
          {hasMine && (
            <span
              className="block w-1.5 h-1.5 rounded-full"
              style={{ background: '#10B981' }}
            />
          )}
          {hasClick && !hasMine && (
            <span
              className="block w-1.5 h-1.5 rounded-full"
              style={{ background: '#7C3AED' }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Event row in the day list ---------- */
function DayEventRow({ event, index }: { event: CalendarEvent; index: number }) {
  const navigate = useNavigate();
  const isPast = event.status === 'past';

  return (
    <motion.button
      type="button"
      onClick={() => navigate(`/events/${event.id}`)}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3), ease: 'easeOut' }}
      whileTap={{ scale: 0.98 }}
      className="group w-full flex items-stretch gap-3 p-3 rounded-2xl bg-card border border-border/40 hover:border-primary/40 hover:shadow-[0_4px_14px_rgba(124,58,237,0.10)] transition-all text-right"
    >
      {/* Color stripe */}
      <span
        aria-hidden
        className="w-1 rounded-full shrink-0"
        style={{
          background: event.is_mine
            ? 'linear-gradient(180deg, #10B981, #059669)'
            : 'linear-gradient(180deg, #7C3AED, #EC4899)',
        }}
      />

      {/* Time bubble */}
      <div className="flex flex-col items-center justify-center px-2 shrink-0 min-w-[50px]">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold leading-none">
          שעה
        </span>
        <span className="text-[15px] font-bold text-foreground mt-0.5 leading-tight">
          {event.time?.slice(0, 5) || '--:--'}
        </span>
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          {event.is_mine && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{
                background: 'rgba(16,185,129,0.12)',
                color: '#10B981',
              }}
            >
              <CheckCircle size={9} />
              רשום/ה
            </span>
          )}
          {isPast && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
            >
              עבר
            </span>
          )}
        </div>
        <p className="font-semibold text-[14px] text-foreground truncate group-hover:text-primary transition-colors">
          {event.name}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin size={11} className="text-muted-foreground/70 shrink-0" />
          <span className="text-[12px] text-muted-foreground truncate">
            {event.location_name}
          </span>
        </div>
      </div>

      <ChevronLeft
        size={16}
        className="text-muted-foreground/50 self-center shrink-0 group-hover:text-primary group-hover:-translate-x-0.5 transition-all"
      />
    </motion.button>
  );
}

/* ---------- Main view ---------- */
export default function EventsCalendarView({ currentUserId, isShadowUser = false }: EventsCalendarViewProps) {
  const [month, setMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch events for the visible month
  useEffect(() => {
    let active = true;
    setLoading(true);
    const startDate = format(startOfMonth(month), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(month), 'yyyy-MM-dd');
    getCalendarEvents(startDate, endDate, currentUserId, isShadowUser)
      .then(res => {
        if (active) setEvents(res);
      })
      .catch(err => {
        console.error('Failed to load calendar events:', err);
        if (active) setEvents([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month, currentUserId, isShadowUser]);

  // Group events by date for fast lookup
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const key = ev.date;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [events]);

  // Modifiers for the picker
  const eventDates = useMemo(
    () => Object.keys(eventsByDate).map(d => new Date(d + 'T00:00')),
    [eventsByDate],
  );
  const myEventDates = useMemo(
    () =>
      Object.entries(eventsByDate)
        .filter(([, list]) => list.some(e => e.is_mine))
        .map(([d]) => new Date(d + 'T00:00')),
    [eventsByDate],
  );

  // Selected day events
  const selectedKey = format(selectedDate, 'yyyy-MM-dd');
  const dayEvents = (eventsByDate[selectedKey] || []).slice().sort((a, b) =>
    (a.time || '').localeCompare(b.time || ''),
  );

  const goPrevMonth = () => setMonth(m => subMonths(m, 1));
  const goNextMonth = () => setMonth(m => addMonths(m, 1));

  const isToday = format(new Date(), 'yyyy-MM-dd') === selectedKey;

  return (
    <div className="space-y-5">
      {/* Calendar card */}
      <div
        className="rounded-3xl overflow-hidden glass-premium"
        style={{ boxShadow: '0 8px 28px rgba(124,58,237,0.10)' }}
      >
        {/* Header strip */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(236,72,153,0.06))' }}
        >
          <button
            type="button"
            onClick={goPrevMonth}
            aria-label="חודש קודם"
            className="w-8 h-8 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary leading-none">
              לוח שנה
            </p>
            <p className="text-sm font-bold text-foreground mt-1 leading-none">
              {format(month, 'MMMM yyyy', { locale: he })}
            </p>
          </div>
          <button
            type="button"
            onClick={goNextMonth}
            aria-label="חודש הבא"
            className="w-8 h-8 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Calendar */}
        <div className="px-2 pb-2 pt-1" dir="rtl">
          <DayPicker
            mode="single"
            month={month}
            onMonthChange={setMonth}
            selected={selectedDate}
            onSelect={d => d && setSelectedDate(d)}
            locale={he}
            weekStartsOn={0}
            showOutsideDays
            modifiers={{
              hasEvent: eventDates,
              hasMyEvent: myEventDates,
            }}
            classNames={{
              months: 'flex flex-col w-full',
              month: 'space-y-2 w-full',
              caption: 'hidden',
              table: 'w-full border-collapse',
              head_row: 'flex w-full',
              head_cell: 'flex-1 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider py-2',
              row: 'flex w-full mt-1',
              cell: 'flex-1 aspect-square text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
              day: 'w-full h-full font-medium rounded-xl text-foreground transition-all hover:bg-primary/10 hover:text-primary aria-selected:opacity-100',
              day_selected:
                '!bg-gradient-to-br !from-primary !to-pink-500 !text-white !font-bold shadow-[0_4px_12px_rgba(124,58,237,0.35)] hover:!opacity-95',
              day_today: 'ring-1 ring-primary/40 font-bold text-primary',
              day_outside: 'text-muted-foreground/40',
              day_disabled: 'text-muted-foreground/30 cursor-not-allowed',
              day_hidden: 'invisible',
            }}
            components={{
              IconLeft: () => <ChevronLeft className="h-4 w-4" />,
              IconRight: () => <ChevronRight className="h-4 w-4" />,
              DayContent: ({ date }) => {
                const key = format(date, 'yyyy-MM-dd');
                const list = eventsByDate[key] || [];
                const hasMine = list.some(e => e.is_mine);
                const hasClick = list.length > 0;
                return <DayCellContent date={date} hasClick={hasClick} hasMine={hasMine} />;
              },
            }}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 px-4 py-2 border-t border-primary/10 bg-card/40">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="block w-1.5 h-1.5 rounded-full" style={{ background: '#7C3AED' }} />
            אירועי קליק
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="block w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} />
            רשום/ה אליו
          </span>
        </div>
      </div>

      {/* Selected day events */}
      <section aria-live="polite">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(124,58,237,0.10)' }}
            >
              <CalendarIcon size={14} className="text-primary" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary leading-none">
                {isToday ? 'היום' : 'יום נבחר'}
              </p>
              <p className="text-[14px] font-bold text-foreground mt-0.5 leading-none">
                {format(selectedDate, "EEEE, d 'ב'MMMM", { locale: he })}
              </p>
            </div>
          </div>
          {dayEvents.length > 0 && (
            <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full">
              {dayEvents.length} אירועים
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1].map(i => (
              <Skeleton key={i} className="h-[68px] w-full rounded-2xl" />
            ))}
          </div>
        ) : dayEvents.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{
              background: 'rgba(124,58,237,0.04)',
              border: '1px dashed rgba(124,58,237,0.20)',
            }}
          >
            <Sparkles size={20} className="text-primary/60 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">אין אירועים ביום זה</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">לחץ/י על יום אחר עם נקודה</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {dayEvents.map((ev, i) => (
                <DayEventRow key={ev.id} event={ev} index={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </section>
    </div>
  );
}
