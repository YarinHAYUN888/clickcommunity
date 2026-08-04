import { useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import BottomTabBar from '@/components/clicks/BottomTabBar';
import PremiumBackground from '@/components/ui/PremiumBackground';
import { ChatUnreadProvider } from '@/contexts/ChatUnreadContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNotifications } from '@/hooks/useNotifications';

/** Remount only when switching primary tabs — keeps nested routes/state warm. */
function primaryTabKey(pathname: string): string {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/events')) return 'events';
  if (pathname.startsWith('/chats')) return 'chats';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/subscription')) return 'subscription';
  if (pathname.startsWith('/clicks')) return 'clicks';
  return pathname;
}

export default function MainLayout() {
  const location = useLocation();
  const { authId } = useCurrentUser();
  useNotifications(authId);
  const tabKey = useMemo(() => primaryTabKey(location.pathname), [location.pathname]);

  return (
    <ChatUnreadProvider>
      <div className="relative min-h-screen min-h-[100dvh]">
        <PremiumBackground />
        <div className="relative" style={{ zIndex: 1 }}>
          <AnimatePresence initial={false}>
            <motion.div
              key={tabKey}
              initial={{ opacity: 0.97 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.1, ease: 'easeOut' }}
              className="pb-20"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
          <BottomTabBar />
        </div>
      </div>
    </ChatUnreadProvider>
  );
}
