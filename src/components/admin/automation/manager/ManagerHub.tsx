import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, FileText, Send, Users } from 'lucide-react';
import { AudiencePickerModal } from '@/components/admin/automation/manager/AudiencePickerModal';

export type ManagerSection = 'hub' | 'wizard' | 'templates' | 'history';

type HubCard = {
  id: ManagerSection | 'audience';
  icon: React.ElementType;
  title: string;
  description: string;
  primary?: boolean;
};

const CARDS: HubCard[] = [
  {
    id: 'wizard',
    icon: Send,
    title: 'שליחת מייל',
    description: 'בחר סוג הודעה, קהל יעד ושלח מייל ממותג בכמה שלבים פשוטים',
    primary: true,
  },
  {
    id: 'templates',
    icon: FileText,
    title: 'תבניות מייל',
    description: 'עיין בתבניות הזמינות ובחר את המתאימה לכל מצב',
  },
  {
    id: 'audience',
    icon: Users,
    title: 'קהלים ומשתמשים',
    description: 'חפש וצפה בחברי הקהילה — סינון לפי קבוצות, ימי הולדת ונקודות',
  },
  {
    id: 'history',
    icon: Clock,
    title: 'היסטוריית שליחות',
    description: 'צפה בשליחות קודמות ובדוק סטטוס הגעה',
  },
];

export function ManagerHub({ onNavigate }: { onNavigate: (t: ManagerSection) => void }) {
  const [audienceOpen, setAudienceOpen] = useState(false);

  function handleCard(id: ManagerSection | 'audience') {
    if (id === 'audience') {
      setAudienceOpen(true);
    } else {
      onNavigate(id);
    }
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-violet-950">מה תרצה לעשות?</h2>
        <p className="text-sm text-muted-foreground mt-1">בחר פעולה מהרשימה כדי להתחיל</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <motion.button
              key={card.id}
              type="button"
              whileHover={{ y: -3, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleCard(card.id)}
              className={[
                'text-right w-full rounded-3xl p-6 flex gap-4 items-start transition-all shadow-sm border',
                card.primary
                  ? 'bg-gradient-to-br from-violet-600 to-purple-500 text-white border-transparent shadow-[0_12px_40px_-16px_rgba(124,58,237,0.45)]'
                  : 'bg-white/90 backdrop-blur border-violet-100/80 hover:border-violet-200 hover:shadow-md',
              ].join(' ')}
            >
              <span
                className={[
                  'rounded-2xl p-3 shrink-0',
                  card.primary ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700',
                ].join(' ')}
              >
                <Icon className="h-6 w-6" />
              </span>
              <div className="text-right min-w-0">
                <p
                  className={[
                    'font-bold text-lg leading-snug',
                    card.primary ? 'text-white' : 'text-violet-950',
                  ].join(' ')}
                >
                  {card.title}
                </p>
                <p
                  className={[
                    'text-sm mt-1.5 leading-relaxed',
                    card.primary ? 'text-white/80' : 'text-muted-foreground',
                  ].join(' ')}
                >
                  {card.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Audience picker — browse only, no selection applied */}
      <AudiencePickerModal
        open={audienceOpen}
        onOpenChange={setAudienceOpen}
        initialSelectedIds={new Set()}
        initialUsers={[]}
        events={[]}
        loadWizardAudience={async () => []}
        onApply={() => setAudienceOpen(false)}
      />
    </div>
  );
}
