import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Calendar, MapPin, Clock, Users, Lock, CheckCircle, X, ChevronLeft, ChevronRight, MessageCircle, Loader2 } from 'lucide-react';
import GlassCard from '@/components/clicks/GlassCard';
import StatusBadge from '@/components/clicks/StatusBadge';
import AttendeesModal from '@/components/clicks/AttendeesModal';
import EventClicksSection from '@/components/clicks/EventClicksSection';
import { EventRow, getEventById, getEventStats, getEventAttendees, getUserRegistration, getEventPhotos, registerForEvent, downloadIcs, EventStats, EventRegistration } from '@/services/events';
import { createOrGetDm } from '@/services/chat';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { toast as sonner } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { authId, role } = useCurrentUser();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [stats, setStats] = useState<EventStats>({ total: 0, femalePercent: 50, malePercent: 50 });
  const [attendees, setAttendees] = useState<any[]>([]);
  const [registration, setRegistration] = useState<EventRegistration | null>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [attendeesModalOpen, setAttendeesModalOpen] = useState(false);
  const [pendingDmFor, setPendingDmFor] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      getEventById(eventId),
      getEventStats(eventId),
      getEventAttendees(eventId),
      getEventPhotos(eventId),
      authId ? getUserRegistration(eventId, authId) : Promise.resolve(null),
    ]).then(([ev, st, att, ph, reg]) => {
      setEvent(ev);
      setStats(st);
      setAttendees(att);
      setPhotos(ph);
      setRegistration(reg);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [eventId, authId]);

  // Countdown
  useEffect(() => {
    if (!event || event.status === 'past') return;
    const update = () => {
      const target = new Date(`${event.date}T${event.time}`);
      const diff = Math.max(0, target.getTime() - Date.now());
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [event]);

  const handleRegister = async () => {
    if (!eventId || !authId) return;
    if (role === 'guest') {
      sonner('Registration is available for members only', { icon: '🔒' });
      return;
    }
    setRegistering(true);
    try {
      const result = await registerForEvent(eventId);
      if (result.success) {
        setRegistration({
          id: '',
          event_id: eventId,
          user_id: authId,
          status: result.registration_status,
          waitlist_position: result.waitlist_position,
          paid_amount: null,
          payment_status: 'unpaid',
          entry_code: result.entry_code || null,
          created_at: '',
        });
        if (result.registration_status === 'registered') setShowSuccess(true);
        else toast({ title: `ברשימת המתנה (מקום ${result.waitlist_position})` });
      }
    } catch (err: any) {
      toast({ title: 'שגיאה', description: err.message || 'נסו שוב', variant: 'destructive' });
    }
    setRegistering(false);
  };

  const handleStartChatWithAttendee = async (otherUserId: string) => {
    if (!authId || otherUserId === authId) return;
    if (role !== 'member') {
      sonner('שליחת הודעות זמינה לחברי קהילה בלבד', { icon: '🔒' });
      return;
    }
    if (pendingDmFor) return;
    setPendingDmFor(otherUserId);
    try {
      const result = await createOrGetDm(otherUserId);
      const chatId = result?.chat_id || result?.id;
      if (!chatId) throw new Error('no_chat_id');
      navigate(`/chats/${chatId}`);
    } catch (err) {
      console.error('Failed to start DM:', err);
      sonner.error('לא הצלחנו לפתוח צ׳אט. נסו שוב.');
    } finally {
      setPendingDmFor(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-4">
        <Skeleton className="h-60 w-full" />
        <div className="p-6 space-y-4">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen pb-4">
        <div className="sticky top-0 z-40 glass-strong px-4 py-3 flex items-center gap-3 border-b border-border/30">
          <button onClick={() => navigate('/events')} className="p-1"><ArrowRight size={20} /></button>
          <h2 className="font-semibold text-sm text-foreground">פרטי אירוע</h2>
        </div>
        <div className="text-center py-20 px-6">
          <Calendar size={48} className="mx-auto mb-4 text-accent" />
          <p className="text-lg font-semibold text-foreground">אירוע לא נמצא</p>
        </div>
      </div>
    );
  }

  const isPast = event.status === 'past';
  const isRegistered =
    registration?.status === 'registered' ||
    registration?.status === 'approved' ||
    registration?.status === 'checked_in';
  const canRegister = role === 'member';

  const formatDate = (d: string) => {
    const date = new Date(d);
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    return `${days[date.getDay()]}, ${date.getDate()}.${date.getMonth() + 1}`;
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Hero */}
      <div className="relative h-60 md:h-72 overflow-hidden">
        {event.cover_image_url ? (
          <img src={event.cover_image_url} alt={event.name} className="w-full h-full object-cover animate-ken-burns" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary to-primary/80" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <button onClick={() => navigate('/events')} className="absolute top-4 end-4 w-9 h-9 rounded-full bg-black/30 flex items-center justify-center">
          <ArrowRight size={20} className="text-white" />
        </button>
        <div className="absolute top-4 start-4">
          <StatusBadge status={event.status} />
        </div>
      </div>

      {/* Info */}
      <div className="px-6 -mt-6 relative z-10 space-y-5">
        <GlassCard variant="strong" className="p-5 space-y-4">
          <h1 className="font-bold text-2xl text-foreground">{event.name}</h1>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-primary" />
              <span className="font-medium">{formatDate(event.date)} | {event.time.slice(0, 5)}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-primary" />
              <a
                href={event.location_url || `https://maps.google.com/maps?q=${encodeURIComponent(event.location_address || event.location_name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline font-medium"
                onClick={e => e.stopPropagation()}
              >
                {event.location_name}
              </a>
            </div>
          </div>
        </GlassCard>

        {/* Countdown */}
        {!isPast && (
          <GlassCard className="p-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { value: countdown.days, label: 'ימים' },
                { value: countdown.hours, label: 'שעות' },
                { value: countdown.minutes, label: 'דקות' },
                { value: countdown.seconds, label: 'שניות' },
              ].map(item => (
                <div key={item.label} className="bg-secondary rounded-xl p-3">
                  <span className="text-2xl font-bold text-primary">{item.value}</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Description */}
        {event.description && (
          <div>
            <h3 className="text-base font-semibold text-muted-foreground mb-2">על האירוע</h3>
            <p className="text-base text-foreground leading-relaxed">{event.description}</p>
          </div>
        )}

        {/* Attendees */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-muted-foreground flex items-center gap-2">
              <Users size={16} /> מי מגיע? <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{stats.total}</span>
            </h3>
            {attendees.length > 0 && role !== 'guest' && (
              <button
                type="button"
                onClick={() => setAttendeesModalOpen(true)}
                className="text-xs font-semibold text-primary hover:underline transition-colors"
              >
                ראה את כולם
              </button>
            )}
          </div>

          {attendees.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">עדיין אין נרשמים</p>
          ) : role === 'guest' ? (
            <div className="relative">
              <div className="flex gap-3 overflow-x-auto pb-2 blur-sm">
                {attendees.slice(0, 8).map((a, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 min-w-[56px]">
                    <div className="w-12 h-12 rounded-full bg-muted" />
                    <span className="text-xs text-muted-foreground">???</span>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 glass rounded-2xl flex flex-col items-center justify-center gap-2 py-6">
                <Lock size={24} className="text-accent" />
                <p className="text-sm text-foreground font-medium text-center">רשימת המשתתפים זמינה לחברי קהילה</p>
                <button onClick={() => navigate('/subscription')} className="text-xs text-primary font-medium underline">למידע על מנוי</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {attendees.slice(0, 15).map((a, i) => {
                  const isSelf = a.user_id === authId;
                  const isPending = pendingDmFor === a.user_id;
                  return (
                    <motion.button
                      type="button"
                      key={a.user_id}
                      onClick={() => !isSelf && handleStartChatWithAttendee(a.user_id)}
                      disabled={isSelf || isPending}
                      aria-label={isSelf ? 'זה אתה' : `פתיחת צ׳אט עם ${a.first_name || 'משתמש'}`}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.05, type: 'spring' }}
                      whileHover={isSelf ? undefined : { scale: 1.05 }}
                      whileTap={isSelf ? undefined : { scale: 0.95 }}
                      className="group relative flex flex-col items-center gap-1 min-w-[56px] outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-2xl disabled:cursor-default"
                    >
                      <div className="relative">
                        <img
                          src={a.avatar_url || a.photos?.[0] || '/placeholder.svg'}
                          alt={a.first_name || ''}
                          className="w-12 h-12 rounded-full object-cover border-2 border-primary/20 transition-shadow"
                          style={{
                            boxShadow: isSelf ? 'none' : '0 2px 8px rgba(124,58,237,0.10)',
                          }}
                        />
                        {!isSelf && (
                          <span
                            aria-hidden
                            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 group-active:scale-95"
                            style={{
                              background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
                              boxShadow: '0 2px 6px rgba(124,58,237,0.40)',
                              border: '2px solid hsl(var(--card))',
                            }}
                          >
                            {isPending ? (
                              <Loader2 size={9} className="text-white animate-spin" />
                            ) : (
                              <MessageCircle size={9} className="text-white" />
                            )}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate max-w-[56px]">
                        {isSelf ? 'אתה' : a.first_name}
                      </span>
                    </motion.button>
                  );
                })}
                {attendees.length > 15 && (
                  <button
                    type="button"
                    onClick={() => setAttendeesModalOpen(true)}
                    className="flex flex-col items-center justify-center min-w-[56px] text-xs font-semibold text-primary hover:underline transition-colors"
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center mb-1"
                      style={{
                        background: 'rgba(124,58,237,0.10)',
                        border: '2px dashed rgba(124,58,237,0.30)',
                      }}
                    >
                      +{attendees.length - 15}
                    </div>
                    הצג הכל
                  </button>
                )}
              </div>
              <p className="text-[12px] text-muted-foreground/70 mt-1.5 flex items-center gap-1">
                <MessageCircle size={11} />
                לחיצה על אווטאר פותחת צ׳אט אישי
              </p>
            </>
          )}
        </div>

        {/* Group Chat Button */}
        {isRegistered && role === 'member' && (
          <GlassCard className="p-4 flex items-center gap-3" onClick={() => navigate(`/chats/event-${event.id}`)}>
            <MessageCircle size={20} className="text-primary" />
            <span className="font-medium text-foreground">צ'אט קבוצתי</span>
          </GlassCard>
        )}

        {/* Event Entry QR */}
        {isRegistered && registration?.entry_code && (
          <GlassCard className="p-5 space-y-3 text-center">
            <h3 className="text-base font-semibold text-foreground">כרטיס כניסה לאירוע</h3>
            <div className="flex justify-center">
              <div className="bg-white p-3 rounded-2xl">
                <QRCodeSVG value={registration.entry_code} size={168} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">קוד כניסה: <span className="font-semibold text-foreground">{registration.entry_code}</span></p>
          </GlassCard>
        )}

        {/* Personalized "Clicks" — visible after registration */}
        {isRegistered && role === 'member' && authId && (
          <EventClicksSection
            eventId={event.id}
            currentUserId={authId}
            isMember={role === 'member'}
          />
        )}

        {/* Attendee Stats */}
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">{stats.total}/{event.max_capacity} משתתפים</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-l from-primary to-accent"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((stats.total / event.max_capacity) * 100, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>♀ {stats.femalePercent}% ♂ {stats.malePercent}%</span>
            <div className="flex-1 h-1 rounded-full overflow-hidden bg-secondary">
              <motion.div className="h-full" style={{ background: 'linear-gradient(90deg, #EC4899, #7C3AED)' }}
                initial={{ width: 0 }} animate={{ width: `${stats.femalePercent}%` }}
                transition={{ duration: 0.6, delay: 0.2 }}
              />
            </div>
          </div>
        </GlassCard>

        {/* Photo Gallery (past events) */}
        {isPast && photos.length > 0 && (
          <div>
            <h3 className="text-base font-semibold text-muted-foreground mb-3">תמונות מהאירוע</h3>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-1">
              {photos.map((photo, i) => (
                <img
                  key={photo.id}
                  src={photo.photo_url}
                  alt=""
                  className="aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setLightboxIndex(i)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      {!isPast && (
        <div className="fixed bottom-20 inset-x-0 z-30 px-6 pb-2 pt-4 bg-gradient-to-t from-background to-transparent">
          <div className="max-w-[640px] mx-auto">
            {isRegistered ? (
              <button className="w-full rounded-[999px] py-3.5 font-semibold text-base bg-success/20 text-success" disabled>
                רשום/ה ✓
              </button>
            ) : registration?.status === 'waitlist' ? (
              <button className="w-full rounded-[999px] py-3.5 font-semibold text-base bg-warning/10 text-warning" disabled>
                ברשימת המתנה (מקום {registration.waitlist_position})
              </button>
            ) : (
              <button
                onClick={handleRegister}
                disabled={registering || !authId}
                className="w-full rounded-[999px] gradient-primary text-primary-foreground py-3.5 font-semibold text-base active:scale-[0.97] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {!canRegister ? (
                  <>
                    <Lock size={16} />
                    הרשמה לחברי קהילה בלבד
                  </>
                ) : registering ? '...' : event.status === 'full' ? 'הצטרף/י לרשימת המתנה' : 'הירשם/י'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Success Overlay */}
      <AnimatePresence>
        {showSuccess && event && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center px-6"
            onClick={() => setShowSuccess(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-card rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.4, type: 'spring' }}>
                <CheckCircle size={56} className="mx-auto text-success" />
              </motion.div>
              <h2 className="font-bold text-2xl text-foreground">נרשמת בהצלחה! 🎉</h2>
              <p className="text-sm text-muted-foreground">{event.name}, {formatDate(event.date)} ב-{event.time.slice(0, 5)}</p>
              <button
                onClick={() => downloadIcs(event)}
                className="w-full rounded-xl border border-primary text-primary py-3 font-medium text-sm"
              >
                הוסף ליומן 📅
              </button>
              <button onClick={() => setShowSuccess(false)} className="text-sm text-muted-foreground">סגור</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attendees full list */}
      <AttendeesModal
        open={attendeesModalOpen}
        onClose={() => setAttendeesModalOpen(false)}
        attendees={attendees}
        currentUserId={authId || ''}
        isMember={role === 'member'}
        eventName={event.name}
      />

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setLightboxIndex(null)}
          >
            <button className="absolute top-4 end-4 text-white" onClick={() => setLightboxIndex(null)}>
              <X size={24} />
            </button>
            {lightboxIndex > 0 && (
              <button className="absolute start-4 text-white" onClick={e => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}>
                <ChevronRight size={32} />
              </button>
            )}
            {lightboxIndex < photos.length - 1 && (
              <button className="absolute end-4 text-white" onClick={e => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}>
                <ChevronLeft size={32} />
              </button>
            )}
            <img
              src={photos[lightboxIndex].photo_url}
              alt=""
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
              onClick={e => e.stopPropagation()}
            />
            <div className="absolute bottom-4 flex gap-2">
              {photos.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i === lightboxIndex ? 'bg-primary' : 'bg-white/50'}`} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
