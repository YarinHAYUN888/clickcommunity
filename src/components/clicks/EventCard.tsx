import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Users, Calendar } from 'lucide-react';
import { motion, useInView } from 'framer-motion';
import GlassCard from './GlassCard';
import StatusBadge from './StatusBadge';
import { EventRow, getEventStats, getUserRegistration, EventStats, EventRegistration } from '@/services/events';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { springs } from '@/lib/motion';

interface EventCardProps {
  event: EventRow;
  index: number;
}

function useCountdown(dateStr: string, timeStr: string) {
  const [text, setText] = useState('');
  const [urgency, setUrgency] = useState<'normal' | 'warning' | 'error'>('normal');

  useEffect(() => {
    const update = () => {
      const target = new Date(`${dateStr}T${timeStr}`);
      const diff = target.getTime() - Date.now();
      if (diff <= 0) { setText(''); return; }

      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);

      if (diff < 2 * 3600000) setUrgency('error');
      else if (diff < 24 * 3600000) setUrgency('warning');
      else setUrgency('normal');

      if (days > 0) setText(`מתחיל בעוד ${days} ימים ${hours} שעות`);
      else if (hours > 0) setText(`מתחיל בעוד ${hours} שעות ${mins} דקות`);
      else setText(`מתחיל בעוד ${mins} דקות`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [dateStr, timeStr]);

  return { text, urgency };
}

export default function EventCard({ event, index }: EventCardProps) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const { authId } = useCurrentUser();
  const [stats, setStats] = useState<EventStats>({ total: 0, femalePercent: 50, malePercent: 50 });
  const [registration, setRegistration] = useState<EventRegistration | null>(null);
  const countdown = useCountdown(event.date, event.time);

  useEffect(() => {
    getEventStats(event.id).then(setStats).catch(console.error);
    if (authId) getUserRegistration(event.id, authId).then(setRegistration).catch(console.error);
  }, [event.id, authId]);

  const capacityPercent = stats.total > 0 ? (stats.total / event.max_capacity) * 100 : 0;

  const formatDate = (d: string) => {
    const date = new Date(d);
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    return `${days[date.getDay()]}, ${date.getDate()}.${date.getMonth() + 1}`;
  };

  const isPast = event.status === 'past';

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.08, ...springs.gentle }}
    >
      <GlassCard
        className={`overflow-hidden ${isPast ? 'opacity-70' : ''}`}
        onClick={() => navigate(`/events/${event.id}`)}
      >
        {/* Cover Image */}
        <div className="relative h-44 md:h-56 overflow-hidden" style={{ boxShadow: '0 12px 32px rgba(124,58,237,0.18)' }}>
          {event.cover_image_url ? (
            <motion.img
              src={event.cover_image_url}
              alt={event.name}
              className="w-full h-full object-cover"
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl text-center px-4">{event.name}</span>
            </div>
          )}
          {/* Vignette */}
          <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 60px rgba(0,0,0,0.18)' }} />
          <div className="absolute top-3 start-3">
            <StatusBadge status={event.status} />
          </div>
          {isPast && event.is_past_voting_open && (
            <div className="absolute top-3 end-3">
              <motion.span
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="bg-primary text-primary-foreground px-3 py-1 rounded-[999px] text-xs font-bold cursor-pointer"
                onClick={(e) => { e.stopPropagation(); navigate(`/events/${event.id}/vote`); }}
              >
                הצביעו עכשיו!
              </motion.span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4 space-y-3">
          <h3 className="font-bold text-lg text-foreground truncate">{event.name}</h3>

          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar size={14} />
              <span>{formatDate(event.date)} | {event.time.slice(0, 5)}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={14} />
              <span>{event.location_name}</span>
            </div>
            {!isPast && countdown.text && (
              <div className="flex items-center gap-2">
                <Clock size={14} />
                <span className={
                  countdown.urgency === 'error' ? 'text-destructive font-medium'
                    : countdown.urgency === 'warning' ? 'text-warning font-medium'
                    : 'text-primary font-medium'
                }>{countdown.text}</span>
              </div>
            )}
          </div>

          {/* Attendee Progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users size={13} />
                <span className="font-semibold">{stats.total}/{event.max_capacity} משתתפים</span>
              </div>
              {capacityPercent > 0 && (
                <span className="font-bold text-gradient-premium text-[11px]">
                  {Math.round(capacityPercent)}%
                </span>
              )}
            </div>
            <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="relative h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #7C3AED, #9333EA, #EC4899)',
                  boxShadow: '0 0 8px rgba(124,58,237,0.5)',
                }}
                initial={{ width: 0 }}
                animate={inView ? { width: `${Math.min(capacityPercent, 100)}%` } : {}}
                transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1], delay: 0.3 }}
              />
            </div>
            {/* Gender Balance */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>♀ {stats.femalePercent}% ♂ {stats.malePercent}%</span>
              <div className="flex-1 h-1 rounded-full overflow-hidden bg-secondary">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #EC4899, #A78BFA, #7C3AED)' }}
                  initial={{ width: 0 }}
                  animate={inView ? { width: `${stats.femalePercent}%` } : {}}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: 0.4 }}
                />
              </div>
            </div>
          </div>

          {/* Reserved spots */}
          {!isPast && event.reserved_new_spots > 0 && (
            <p className="text-xs text-center text-primary bg-secondary px-3 py-1.5 rounded-lg">
              🆕 {event.reserved_new_spots} מקומות שמורים לחדשים
            </p>
          )}

          {/* CTA */}
          {isPast ? (
            <p className="text-sm text-center text-muted-foreground">היו {stats.total} משתתפים</p>
          ) : (
            <EventCTAButton event={event} registration={registration} />
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
}

function EventCTAButton({ event, registration }: { event: EventRow; registration: EventRegistration | null }) {
  const navigate = useNavigate();

  if (registration) {
    if (registration.status === 'registered' || registration.status === 'approved') {
      return (
        <button className="w-full rounded-xl py-3 font-medium text-sm text-center bg-success/20 text-success" disabled>
          רשום/ה ✓
        </button>
      );
    }
    if (registration.status === 'waitlist') {
      return (
        <button className="w-full rounded-xl py-3 font-medium text-sm text-center bg-warning/10 text-warning" disabled>
          ברשימת המתנה (מקום {registration.waitlist_position})
        </button>
      );
    }
  }

  if (event.status === 'full') {
    return (
      <button
        className="w-full rounded-xl py-3 font-medium text-sm text-center border border-primary text-primary active:scale-[0.97] transition-transform"
        onClick={(e) => { e.stopPropagation(); navigate(`/events/${event.id}`); }}
      >
        הצטרף/י לרשימת המתנה
      </button>
    );
  }

  return (
    <button
      className="btn-shine-loop w-full rounded-xl gradient-primary text-primary-foreground py-3 font-semibold text-sm text-center active:scale-[0.97] transition-transform shadow-[0_8px_24px_rgba(124,58,237,0.35)]"
      onClick={(e) => { e.stopPropagation(); navigate(`/events/${event.id}`); }}
    >
      הירשם/י
    </button>
  );
}
