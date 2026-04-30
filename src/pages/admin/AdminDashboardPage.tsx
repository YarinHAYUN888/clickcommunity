import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, UserCheck, Calendar, MessageCircle, CreditCard, Shield, ChevronLeft } from 'lucide-react';
import { SpinnerOverlay } from '@/components/ui/luma-spin';
import GlassCard from '@/components/clicks/GlassCard';
import { useAdmin } from '@/contexts/AdminContext';
import { getAdminStats } from '@/services/admin';

function CountUp({ target, duration = 600 }: { target: number; duration?: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      setValue(Math.round(progress * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return <>{value}</>;
}

const statCards = [
  { key: 'users', icon: Users, label: 'משתמשים רשומים', path: 'users.total' },
  { key: 'members', icon: UserCheck, label: 'מנויים פעילים', path: 'subscriptions.active_total' },
  { key: 'events', icon: Calendar, label: 'אירועים פעילים', path: 'events.active_events' },
  { key: 'chats', icon: MessageCircle, label: 'צ׳אטים פתוחים', path: 'chats.active_chats' },
];

const navCards = [
  { icon: Users, label: 'ניהול משתמשים', route: '/admin/users' },
  { icon: Calendar, label: 'ניהול אירועים', route: '/admin/events' },
  { icon: MessageCircle, label: 'ניהול צ׳אטים', route: '/admin/chats' },
  { icon: CreditCard, label: 'ניהול מנויים', route: '/admin/subscriptions' },
];

function getNestedValue(obj: any, path: string): number {
  return path.split('.').reduce((o, k) => o?.[k], obj) ?? 0;
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { superRole, isSuperUser } = useAdmin();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperUser) { navigate('/clicks', { replace: true }); return; }
    getAdminStats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, [isSuperUser]);

  if (loading) return <SpinnerOverlay />;

  return (
    <div className="min-h-screen gradient-bg pb-24">
      <div className="px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 pt-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground">ניהול</h1>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground">
            {superRole === 'developer' ? 'מפתח' : 'מנהלת'}
          </span>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            const value = stats ? getNestedValue(stats, card.path) : 0;
            return (
              <GlassCard key={card.key} variant="strong" className="p-4 text-center">
                <Icon size={28} className="text-accent mx-auto mb-2" />
                <div className="text-2xl font-bold text-primary"><CountUp target={value} /></div>
                <div className="text-xs text-muted-foreground">{card.label}</div>
              </GlassCard>
            );
          })}
        </div>

        {/* Nav Cards */}
        <div className="grid grid-cols-2 gap-3">
          {navCards.map((card) => {
            const Icon = card.icon;
            return (
              <motion.div key={card.route} whileTap={{ scale: 0.97 }}>
                <GlassCard
                  variant="strong"
                  className="p-4 h-20 flex items-center gap-3 cursor-pointer"
                  onClick={() => navigate(card.route)}
                >
                  <Icon size={28} className="text-primary flex-shrink-0" />
                  <span className="font-semibold text-foreground text-sm flex-1">{card.label}</span>
                  <ChevronLeft size={18} className="text-muted-foreground" />
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
