import type { LucideIcon } from 'lucide-react';
import {
  Cake,
  CalendarHeart,
  Award,
  Gift,
  Megaphone,
  PartyPopper,
  RefreshCw,
  Send,
  UserPlus,
  Users,
} from 'lucide-react';

export type AutomationPreset = {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: LucideIcon;
};

/** Maps wizard cards to existing template categories in DB */
export const AUTOMATION_PRESETS: AutomationPreset[] = [
  {
    id: 'birthday',
    title: 'ברכת יום הולדת',
    description: 'הודעה חמה לחברי הקהילה ביום ההולדת',
    category: 'birthday',
    icon: Cake,
  },
  {
    id: 'event_reminder',
    title: 'תזכורת לאירוע',
    description: 'תאריך, שעה ומיקום לפני מפגש',
    category: 'event_reminder',
    icon: CalendarHeart,
  },
  {
    id: 'welcome',
    title: 'ברוכים הבאים',
    description: 'הודעת קליטה לחברים חדשים',
    category: 'approval',
    icon: UserPlus,
  },
  {
    id: 'vip_points',
    title: 'חברי VIP / נקודות',
    description: 'הענקת הוקרה למצטיינים',
    category: 'points',
    icon: Award,
  },
  {
    id: 'announcement',
    title: 'הודעת קהילה',
    description: 'עדכון כללי לכל המנויים',
    category: 'custom',
    icon: Megaphone,
  },
  {
    id: 'manual',
    title: 'קמפיין ידני',
    description: 'בחירת תבנית וקהל בחופשיות',
    category: 'custom',
    icon: Send,
  },
  {
    id: 'reengage',
    title: 'החזרת מעורבות',
    description: 'פנייה למשתמשים פחות פעילים',
    category: 'custom',
    icon: RefreshCw,
  },
  {
    id: 'event_audience',
    title: 'משתתפי אירוע',
    description: 'שליחה לפי רישום לאירוע שנבחר',
    category: 'event_reminder',
    icon: Users,
  },
  {
    id: 'party',
    title: 'חגיגה ומפגש',
    description: 'הזמנה או סיכום מפגש קהילתי',
    category: 'custom',
    icon: PartyPopper,
  },
  {
    id: 'gift',
    title: 'מבצע / מתנה',
    description: 'הטבות והצעות לחברים',
    category: 'custom',
    icon: Gift,
  },
];

/** Curated segments for the marketing wizard (full list remains in constants for developer tools). */
export const MANAGER_WIZARD_SEGMENT_GROUPS: { label: string; options: { value: string; label: string }[] }[] = [
  {
    label: 'קהילה',
    options: [
      { value: 'all_members', label: 'כל החברים' },
      { value: 'approved_members', label: 'חברים מאושרים' },
      { value: 'guests', label: 'אורחים' },
    ],
  },
  {
    label: 'מעורבות',
    options: [
      { value: 'points_200', label: 'מעל 200 נקודות' },
      { value: 'points_min', label: 'מעל X נקודות (הגדר למטה)' },
      { value: 'inactive_users', label: 'לא פעילים (30+ יום)' },
      { value: 'birthday_today', label: 'יום הולדת היום' },
    ],
  },
  {
    label: 'סטטוס',
    options: [
      { value: 'pending_users', label: 'ממתינים לאישור' },
      { value: 'profile_incomplete', label: 'פרופיל לא הושלם' },
    ],
  },
  {
    label: 'נוספים',
    options: [
      { value: 'all_users', label: 'כל המשתמשים (לא מושעים)' },
      { value: 'event_participants', label: 'משתתפי אירוע (בחר אירוע)' },
    ],
  },
];
