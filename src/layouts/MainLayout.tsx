import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import BottomTabBar from '@/components/clicks/BottomTabBar';
import PremiumBackground from '@/components/ui/PremiumBackground';
import { ChatUnreadProvider } from '@/contexts/ChatUnreadContext';

export default function MainLayout() {
  const location = useLocation();

  return (
    <ChatUnreadProvider>
      <div className="relative min-h-screen">
        <PremiumBackground />
        <div className="relative" style={{ zIndex: 1 }}>
          <AnimatePresence initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0.96 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
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
