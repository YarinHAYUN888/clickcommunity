import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import BottomTabBar from '@/components/clicks/BottomTabBar';
import PremiumBackground from '@/components/ui/PremiumBackground';
import { springs } from '@/lib/motion';

export default function MainLayout() {
  const location = useLocation();

  return (
    <div className="relative min-h-screen">
      <PremiumBackground />
      <div className="relative" style={{ zIndex: 1 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, scale: 0.99, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.99, filter: 'blur(4px)' }}
            transition={springs.gentle}
            className="pb-20"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
        <BottomTabBar />
      </div>
    </div>
  );
}
