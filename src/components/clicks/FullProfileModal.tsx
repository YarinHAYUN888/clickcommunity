import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MoreVertical, Flag, Ban, Lock, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { SupabaseProfile } from '@/hooks/useCurrentUser';
import { getInterestEmoji } from '@/hooks/useClicksFeed';
import InterestPill from './InterestPill';
import CompatibilityArc from './CompatibilityArc';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface FullProfileModalProps {
  open: boolean;
  onClose: () => void;
  profile: SupabaseProfile;
  compatibilityScore: number;
  sharedInterests: string[];
  isMember: boolean;
}

export default function FullProfileModal({
  open,
  onClose,
  profile,
  compatibilityScore,
  sharedInterests,
  isMember,
}: FullProfileModalProps) {
  const navigate = useNavigate();
  const [photoIdx, setPhotoIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  const photos = profile.photos?.length ? profile.photos : (profile.avatar_url ? [profile.avatar_url] : []);
  const age = profile.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / 31557600000)
    : null;

  const handleScroll = () => {
    if (scrollRef.current) setScrollY(scrollRef.current.scrollTop);
  };

  const handleMessage = () => {
    if (!isMember) {
      toast('שליחת הודעות זמינה לחברי קהילה בלבד', { icon: '🔒' });
      return;
    }
    navigate(`/chats/new-${profile.user_id}`);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-3xl overflow-hidden"
            style={{ height: '90vh', maxWidth: 560, margin: '0 auto' }}
          >
            <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto">
              {/* Photo Carousel */}
              <div className="relative overflow-hidden" style={{ height: 400 }}>
                <div style={{ transform: `translateY(${scrollY * 0.3}px)` }} className="absolute inset-0">
                  {photos.length > 0 ? (
                    <img src={photos[photoIdx]} alt={profile.first_name || ''} className="w-full h-full object-cover" style={{ minHeight: 500 }} />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center text-6xl">👤</div>
                  )}
                </div>

                {/* Dots */}
                {photos.length > 1 && (
                  <div className="absolute bottom-20 inset-x-0 flex justify-center gap-2 z-10">
                    {photos.map((_, i) => (
                      <button key={i} onClick={() => setPhotoIdx(i)} className={`w-2 h-2 rounded-full transition-all ${i === photoIdx ? 'bg-primary scale-125' : 'bg-white/50'}`} />
                    ))}
                  </div>
                )}

                {/* Nav arrows */}
                {photos.length > 1 && photoIdx > 0 && (
                  <button onClick={() => setPhotoIdx(i => i - 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 rounded-full p-1.5 z-10">
                    <ChevronRight size={20} className="text-white" />
                  </button>
                )}
                {photos.length > 1 && photoIdx < photos.length - 1 && (
                  <button onClick={() => setPhotoIdx(i => i + 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 rounded-full p-1.5 z-10">
                    <ChevronLeft size={20} className="text-white" />
                  </button>
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 pt-20 z-10">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
                      {profile.first_name || 'אנונימי'}{age ? `, ${age}` : ''}
                    </h2>
                  </div>
                  {profile.occupation && <p className="text-white/80 text-base mt-0.5">{profile.occupation}</p>}
                </div>

                {/* Menu */}
                <div className="absolute top-4 left-4 z-20">
                  <button onClick={() => setMenuOpen(v => !v)} className="w-9 h-9 rounded-full bg-black/30 flex items-center justify-center">
                    <MoreVertical size={20} className="text-white" />
                  </button>
                  <AnimatePresence>
                    {menuOpen && (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="absolute top-11 left-0 bg-card rounded-2xl shadow-glass-md overflow-hidden min-w-[140px] z-30">
                        <button className="flex items-center gap-2 w-full px-4 py-3 text-sm text-muted-foreground hover:bg-muted transition-colors"><Flag size={16} /> דווח/י</button>
                        <button className="flex items-center gap-2 w-full px-4 py-3 text-sm text-destructive hover:bg-muted transition-colors"><Ban size={16} /> חסום/י</button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Close */}
                <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/30 flex items-center justify-center z-20">
                  <X size={20} className="text-white" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 pb-28 space-y-6">
                {profile.bio && (
                  <div>
                    <h4 className="text-base font-semibold text-muted-foreground mb-2">קצת עליי</h4>
                    <p className="text-base text-foreground leading-relaxed">{profile.bio}</p>
                  </div>
                )}

                {(profile.interests?.length ?? 0) > 0 && (
                  <div>
                    <h4 className="text-base font-semibold text-muted-foreground mb-3">תחומי עניין</h4>
                    <div className="flex flex-wrap gap-2">
                      {profile.interests!.map(interest => (
                        <InterestPill key={interest} label={interest} emoji={getInterestEmoji(interest)} shared={sharedInterests.includes(interest)} size="md" />
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-center">
                  <CompatibilityArc score={compatibilityScore} size="lg" animate />
                </div>
              </div>
            </div>

            {/* Sticky bottom action */}
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-card via-card to-transparent pb-[calc(16px+env(safe-area-inset-bottom))]">
              <motion.button onClick={handleMessage} whileTap={{ scale: 0.97 }} className="w-full h-[52px] rounded-full gradient-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2">
                {isMember ? <><MessageCircle size={18} /> שלח/י הודעה</> : <><Lock size={18} /> שלח/י הודעה 🔒</>}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
