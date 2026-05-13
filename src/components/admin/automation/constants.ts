export const SEGMENT_OPTIONS = [
  { value: 'all_users', label: 'כל המשתמשים (לא מושעים)' },
  { value: 'all_members', label: 'כל החברים (member)' },
  { value: 'guests', label: 'אורחים' },
  { value: 'approved_members', label: 'חברים מאושרים' },
  { value: 'pending_users', label: 'ממתינים לאישור (סטטוס)' },
  { value: 'onboarding_pending', label: 'ממתינים / טרום אישור (מודרציה)' },
  { value: 'profile_incomplete', label: 'פרופיל לא הושלם' },
  { value: 'profile_completed_only', label: 'פרופיל הושלם' },
  { value: 'gender_male', label: 'מגדר: גברים' },
  { value: 'gender_female', label: 'מגדר: נשים' },
  { value: 'points_200', label: 'מעל 200 נקודות (ברירת מחדל)' },
  { value: 'points_min', label: 'מעל X נקודות (הגדר למטה)' },
  { value: 'birthday_today', label: 'יום הולדת היום' },
  { value: 'inactive_users', label: 'לא פעילים (לא נראה 30+ יום)' },
  { value: 'event_participants', label: 'משתתפי אירוע (בחר אירוע למטה)' },
] as const;

export const EVENT_REGISTRATION_FILTERS = [
  { value: 'registered', label: 'רשומים' },
  { value: 'approved', label: 'מאושרים' },
  { value: 'waitlist', label: 'רשימת המתנה' },
  { value: 'checked_in', label: 'נכנסו' },
  { value: 'cancelled', label: 'בוטלו' },
] as const;

export const FLOW_TRIGGERS = [
  { value: 'user_registered', label: 'הרשמת משתמש' },
  { value: 'user_approved', label: 'אישור לקהילה' },
  { value: 'birthday_today', label: 'יום הולדת היום' },
  { value: 'event_starting_soon', label: 'אירוע מתקרב' },
  { value: 'user_reached_200_points', label: 'הגיע ל־200 נקודות' },
  { value: 'manual_send', label: 'שליחה ידנית' },
] as const;

export const AUTOMATION_TAB_GROUPS = [
  {
    label: 'תוכן',
    tabs: [
      { id: 'templates', label: 'תבניות' },
      { id: 'flows', label: 'זרימות' },
    ],
  },
  {
    label: 'שליחה',
    tabs: [
      { id: 'campaigns', label: 'קמפיינים' },
      { id: 'birthdays', label: 'ימי הולדת' },
    ],
  },
  {
    label: 'נתונים',
    tabs: [
      { id: 'audience', label: 'קהל' },
      { id: 'logs', label: 'יומנים' },
    ],
  },
  {
    label: 'טכני',
    tabs: [{ id: 'integration', label: 'מפתחים' }],
  },
] as const;

export type AutomationTabId =
  (typeof AUTOMATION_TAB_GROUPS)[number]['tabs'][number]['id'];

export const AUTOMATION_TAB_IDS: AutomationTabId[] = AUTOMATION_TAB_GROUPS.flatMap((g) =>
  g.tabs.map((t) => t.id),
) as AutomationTabId[];

/** Short guide shown at the top of the automation screen (three steps per tab). */
export const AUTOMATION_TAB_INTRO: Record<
  AutomationTabId,
  { headline: string; steps: [string, string, string] }
> = {
  templates: {
    headline: 'תבניות — טקסט ונושא לפני שליחה ב-N8N',
    steps: [
      'כותבים נושא וגוף עם placeholders (למשל שם פרטי).',
      'בודקים תצוגה מקדימה HTML כפי שיתקבל אצל הנמען.',
      'שומרים; השליחה האמיתית מגיעה מזרימת ה-webhook.',
    ],
  },
  flows: {
    headline: 'זרימות — טריגרים ותנאים',
    steps: [
      'מגדירים מתי האוטומציה רצה (טריגר) ותנאים ב-JSON.',
      'מקשרים תבנית לכל זרימה.',
      'בודקים מכאן או בטאב מפתחים שה-payload מגיע ל-N8N.',
    ],
  },
  campaigns: {
    headline: 'קמפיינים — שליחה לקהל',
    steps: [
      'בוחרים תבנית וסגמנט או אירוע.',
      'טוענים נמענים ובודקים את הרשימה.',
      'שולחים קמפיין (מצב production נדרש לפי ההגדרות).',
    ],
  },
  birthdays: {
    headline: 'ימי הולדת — טריגרים תאריכיים',
    steps: [
      'מגדירים מתי לשלוח ואילו תבניות.',
      'מוודאים שהזרימות ב-N8N פעילות.',
      'בודקים ביומנים שה-webhook נקרא כמצופה.',
    ],
  },
  audience: {
    headline: 'קהל — סגמנטים וסטטיסטיקה',
    steps: [
      'בוחרים קריטריון (חברים, נקודות, אירוע וכו׳).',
      'רואים כמה רשומות נבחרו.',
      'משתמשים בנתונים לתכנון קמפיין.',
    ],
  },
  logs: {
    headline: 'יומנים — מעקב אחר webhook',
    steps: [
      'בודקים סטטוס הצלחה/כישלון.',
      'פותחים פרטים לראות payload שנשלח.',
      'משווים לריצות ב-N8N.',
    ],
  },
  integration: {
    headline: 'מפתחים — בדיקות ואינטגרציה',
    steps: [
      'מגדירים סודות ב-Supabase: כתובות webhook, EMAIL_LOGO_URL, מצב test/production.',
      'בוחרים תבנית והקשר (סגמנט/אירוע) כמו בקמפיין.',
      'שולחים בדיקה ל-webhook ובודקים ב-N8N את template.body_html.',
    ],
  },
};
