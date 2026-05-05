import { useLocation, useNavigate } from 'react-router-dom';
import { Heart, Calendar, MessageCircle, User, Crown, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useAdmin } from '@/contexts/AdminContext';
import { useChatUnreadCount } from '@/contexts/ChatUnreadContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { springs } from '@/lib/motion';

const baseTabs = [
  { icon: Heart, label: 'קליקים', path: '/clicks' },
  { icon: Calendar, label: 'אירועים', path: '/events' },
  { icon: MessageCircle, label: 'צ׳אטים', path: '/chats' },
  { icon: User, label: 'פרופיל', path: '/profile' },
  { icon: Crown, label: 'מנוי', path: '/subscription' },
] as const;

export default function BottomTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSuperUser } = useAdmin();
  const { profile } = useCurrentUser();
  const chatUnread = useChatUnreadCount();

  /** גם super_role מהפרופיל — למקרה שיש פער טעינה בין AdminContext לפרופיל */
  const showAdminTab = isSuperUser || !!profile?.super_role?.trim();

  const tabs = showAdminTab
    ? [...baseTabs, { icon: Shield, label: 'ניהול' as const, path: '/admin' as const }]
    : [...baseTabs];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 glass-strong pb-[env(safe-area-inset-bottom)]" style={{ borderTop: '1px solid transparent', backgroundImage: 'linear-gradient(rgba(255,255,255,0.85), rgba(255,255,255,0.85)), linear-gradient(90deg, transparent, rgba(124,58,237,0.18), transparent)', backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box' }}>
      {/* SVG defs for gradient icon fills */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <linearGradient id="tab-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
        </defs>
      </svg>
      <div className="flex items-center justify-around h-16 w-full max-w-[1200px] mx-auto px-2 sm:px-6">
        {tabs.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname.startsWith(path);
          const showChatBadge = path === '/chats' && chatUnread > 0;

          return (
            <motion.button
              key={path}
              onClick={() => navigate(path)}
              whileTap={{ scale: 0.92 }}
              transition={springs.snappy}
              className={cn(
                'relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="tabPill"
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.14), rgba(167,139,250,0.10))',
                    boxShadow: '0 4px 12px rgba(124,58,237,0.18), inset 0 0 0 1px rgba(124,58,237,0.18)',
                  }}
                  transition={springs.snappy}
                />
              )}
              <div className="relative">
                <Icon
                  size={22}
                  stroke={isActive ? 'url(#tab-icon-gradient)' : 'currentColor'}
                  fill={isActive ? 'url(#tab-icon-gradient)' : 'none'}
                  strokeWidth={isActive ? 1.5 : 1.8}
                />
                {showChatBadge && (
                  <span
                    className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center shadow-sm border border-background"
                    aria-label={`הודעות שלא נקראו: ${chatUnread}`}
                  >
                    {chatUnread > 99 ? '99+' : chatUnread}
                  </span>
                )}
              </div>
              <span className={cn('relative text-[10px]', isActive ? 'font-bold' : 'font-normal')}>{label}</span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
