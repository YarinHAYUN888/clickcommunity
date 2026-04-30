export interface UserProfile {
  id: string;
  firstName: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  occupation: string;
  bio: string;
  avatarUrl: string;
  photos: string[];
  interests: string[];
  role: 'guest' | 'member' | 'organizer';
  status: 'new' | 'veteran' | 'ambassador';
  eventsAttended: number;
  isOnline?: boolean;
}

export interface ClickMatch {
  id: string;
  userId: string;
  compatibilityScore: number;
  sharedInterests: string[];
  type: 'general' | 'event';
  eventId?: string;
  icebreakerText?: string;
}

export interface Event {
  id: string;
  name: string;
  coverUrl: string;
  date: string;
  time: string;
  locationName: string;
  locationAddress: string;
  description: string;
  hostId: string;
  maxCapacity: number;
  currentAttendees: number;
  reservedNewSpots: number;
  genderBalance: { female: number; male: number };
  status: 'open' | 'almost_full' | 'full' | 'past';
  isPastVotingOpen?: boolean;
}

export interface ChatConversation {
  id: string;
  type: 'direct' | 'group';
  participantIds: string[];
  eventId?: string;
  eventName?: string;
  lastMessage: string;
  lastMessageSender?: string;
  lastMessageTime: string;
  unreadCount: number;
  expiresAt?: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

// Current logged-in user (Community Member)
export const currentUser: UserProfile = {
  id: 'u1',
  firstName: 'אדם',
  age: 27,
  gender: 'male',
  occupation: 'מפתח תוכנה',
  bio: 'אוהב לגלות מקומות חדשים, לבשל ארוחות מטורפות ולדבר על סטארטאפים עד 3 בלילה. מחפש חברה טובה לערבי שישי 🍷',
  avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
  photos: [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=800&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=800&fit=crop',
  ],
  interests: ['טכנולוגיה', 'בישול', 'יין', 'טיולים', 'סטארטאפים', 'קפה'],
  role: 'member',
  status: 'veteran',
  eventsAttended: 6,
};

export const users: UserProfile[] = [
  currentUser,
  {
    id: 'u2',
    firstName: 'נועה',
    age: 25,
    gender: 'female',
    occupation: 'מעצבת גרפית',
    bio: 'מעצבת ביום, רוקדת בלילה 💃 אוהבת אומנות, מוזיקה חיה ושיחות עמוקות מעל כוס בירה.',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
    photos: ['https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=800&fit=crop&crop=face'],
    interests: ['אומנות', 'ריקוד', 'מוזיקה', 'צילום', 'יוגה', 'קפה'],
    role: 'member',
    status: 'veteran',
    eventsAttended: 8,
    isOnline: true,
  },
  {
    id: 'u3',
    firstName: 'אדיר',
    age: 29,
    gender: 'male',
    occupation: 'עורך דין',
    bio: 'גולש בסופ"ש, עורך דין בימי חול. תמיד מחפש את המסעדה הבאה ואנשים מעניינים לשבת איתם.',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face',
    photos: ['https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=800&fit=crop&crop=face'],
    interests: ['גלישה', 'אוכל', 'טיולים', 'ספורט', 'יין', 'ספרים'],
    role: 'member',
    status: 'new',
    eventsAttended: 2,
    isOnline: true,
  },
  {
    id: 'u4',
    firstName: 'מאיה',
    age: 26,
    gender: 'female',
    occupation: 'פסיכולוגית',
    bio: 'מאמינה שהקשרים הכי טובים נוצרים פנים אל פנים. אוהבת יוגה, טבע ושיחות על החיים ✨',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
    photos: ['https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&h=800&fit=crop&crop=face'],
    interests: ['יוגה', 'טבע', 'ספרים', 'מדיטציה', 'בישול', 'כלבים'],
    role: 'member',
    status: 'veteran',
    eventsAttended: 5,
  },
  {
    id: 'u5',
    firstName: 'תומר',
    age: 31,
    gender: 'male',
    occupation: 'שף',
    bio: 'שף במקצוע, פודי בנשמה. אם אתם אוהבים אוכל טוב ושיחות טובות — בואו נדבר 🍕',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
    photos: ['https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&h=800&fit=crop&crop=face'],
    interests: ['אוכל', 'בישול', 'יין', 'טיולים', 'מוזיקה', 'צילום'],
    role: 'member',
    status: 'ambassador',
    eventsAttended: 12,
    isOnline: true,
  },
  {
    id: 'u6',
    firstName: 'שירה',
    age: 24,
    gender: 'female',
    occupation: 'סטודנטית לקולנוע',
    bio: 'חיה ונושמת סרטים. בואו נדבר על הסרט האחרון שראיתם 🎬',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face',
    photos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=800&fit=crop&crop=face'],
    interests: ['סרטים', 'צילום', 'מוזיקה', 'תיאטרון', 'ספרים', 'קפה'],
    role: 'guest',
    status: 'new',
    eventsAttended: 0,
  },
  {
    id: 'u7',
    firstName: 'יונתן',
    age: 28,
    gender: 'male',
    occupation: 'מוזיקאי',
    bio: 'גיטריסט, כותב שירים ומחפש אנשים שאוהבים מוזיקה חיה ושיחות טובות 🎸',
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop&crop=face',
    photos: ['https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&h=800&fit=crop&crop=face'],
    interests: ['מוזיקה', 'גיטרה', 'הופעות', 'בירה', 'טיולים', 'ספורט'],
    role: 'member',
    status: 'new',
    eventsAttended: 3,
  },
  {
    id: 'u8',
    firstName: 'דנה',
    age: 27,
    gender: 'female',
    occupation: 'מנהלת שיווק',
    bio: 'אנרגיות טובות, אנשים טובים, ערבים טובים. זה מה שאני מחפשת 🌟',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=face',
    photos: ['https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&h=800&fit=crop&crop=face'],
    interests: ['שיווק', 'טכנולוגיה', 'יוגה', 'אוכל', 'ריקוד', 'טיולים'],
    role: 'member',
    status: 'veteran',
    eventsAttended: 7,
    isOnline: true,
  },
];

export const clicks: ClickMatch[] = [
  { id: 'c1', userId: 'u2', compatibilityScore: 92, sharedInterests: ['קפה', 'מוזיקה', 'צילום'], type: 'general' },
  { id: 'c2', userId: 'u3', compatibilityScore: 87, sharedInterests: ['טיולים', 'יין', 'אוכל'], type: 'event', eventId: 'e1', icebreakerText: 'היי אדיר, חייב לשמוע לאן היה הטיול האחרון שלך! 🌍' },
  { id: 'c3', userId: 'u4', compatibilityScore: 78, sharedInterests: ['בישול', 'טבע'], type: 'general' },
  { id: 'c4', userId: 'u5', compatibilityScore: 95, sharedInterests: ['בישול', 'יין', 'אוכל', 'טיולים'], type: 'event', eventId: 'e1', icebreakerText: 'הייי תומר! חייבים לדבר על המסעדות הכי טובות בת"א 🍕' },
  { id: 'c5', userId: 'u7', compatibilityScore: 72, sharedInterests: ['מוזיקה', 'טיולים'], type: 'general' },
  { id: 'c6', userId: 'u8', compatibilityScore: 85, sharedInterests: ['טכנולוגיה', 'אוכל', 'טיולים'], type: 'event', eventId: 'e1' },
];

export const events: Event[] = [
  {
    id: 'e1',
    name: 'שישי בבר — Joya TLV',
    coverUrl: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800&h=400&fit=crop',
    date: '2026-04-10',
    time: '21:00',
    locationName: 'Joya TLV',
    locationAddress: 'דיזנגוף 99, תל אביב',
    description: 'ערב חברתי מושלם עם מוזיקה, שתייה ואנשים מדהימים. בואו להכיר את הקליקים שלכם פנים אל פנים!',
    hostId: 'u5',
    maxCapacity: 40,
    currentAttendees: 32,
    reservedNewSpots: 10,
    genderBalance: { female: 48, male: 52 },
    status: 'open',
  },
  {
    id: 'e2',
    name: 'ערב קוקטיילים — Pasáž',
    coverUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&h=400&fit=crop',
    date: '2026-04-17',
    time: '20:30',
    locationName: 'Pasáž',
    locationAddress: 'אלנבי 94, תל אביב',
    description: 'ערב קוקטיילים אינטימי עם DJ סט ושיחות מעניינות. מקום מוגבל!',
    hostId: 'u5',
    maxCapacity: 30,
    currentAttendees: 27,
    reservedNewSpots: 8,
    genderBalance: { female: 50, male: 50 },
    status: 'almost_full',
  },
  {
    id: 'e3',
    name: 'Rooftop Vibes — Beit Kandinof',
    coverUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=400&fit=crop',
    date: '2026-04-24',
    time: '19:00',
    locationName: 'בית קנדינוף',
    locationAddress: 'קנדינוף 9, תל אביב',
    description: 'ערב על הגג עם שקיעה מטורפת, מוזיקה חיה ואווירה מדהימה.',
    hostId: 'u4',
    maxCapacity: 50,
    currentAttendees: 50,
    reservedNewSpots: 10,
    genderBalance: { female: 46, male: 54 },
    status: 'full',
  },
  {
    id: 'e4',
    name: 'ערב ג׳אז — Kuli Alma',
    coverUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800&h=400&fit=crop',
    date: '2026-03-28',
    time: '21:00',
    locationName: 'Kuli Alma',
    locationAddress: 'מיכה 10, תל אביב',
    description: 'ערב ג׳אז אינטימי עם הופעה חיה. היה מדהים!',
    hostId: 'u5',
    maxCapacity: 35,
    currentAttendees: 38,
    reservedNewSpots: 10,
    genderBalance: { female: 52, male: 48 },
    status: 'past',
    isPastVotingOpen: true,
  },
  {
    id: 'e5',
    name: 'Friday Night — Radio EPGB',
    coverUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=400&fit=crop',
    date: '2026-03-21',
    time: '22:00',
    locationName: 'Radio EPGB',
    locationAddress: 'שדרות ירושלים 7, תל אביב',
    description: 'לילה מטורף עם מוזיקה אלקטרונית ואנשים מדהימים.',
    hostId: 'u5',
    maxCapacity: 60,
    currentAttendees: 55,
    reservedNewSpots: 10,
    genderBalance: { female: 47, male: 53 },
    status: 'past',
  },
];

export const chats: ChatConversation[] = [
  {
    id: 'ch1',
    type: 'direct',
    participantIds: ['u1', 'u2'],
    lastMessage: 'כן! בטח, נדבר שם 😊',
    lastMessageTime: '14:32',
    unreadCount: 2,
  },
  {
    id: 'ch2',
    type: 'direct',
    participantIds: ['u1', 'u5'],
    lastMessage: 'אחי, חייבים לבשל ביחד פעם',
    lastMessageTime: 'אתמול',
    unreadCount: 0,
  },
  {
    id: 'ch3',
    type: 'direct',
    participantIds: ['u1', 'u8'],
    lastMessage: 'היי! ראיתי שאנחנו קליק 😄',
    lastMessageTime: 'אתמול',
    unreadCount: 1,
  },
  {
    id: 'ch4',
    type: 'group',
    participantIds: ['u1', 'u2', 'u3', 'u4', 'u5'],
    eventId: 'e1',
    eventName: 'שישי בבר — Joya TLV',
    lastMessage: 'מי מביא לימונים? 🍋',
    lastMessageSender: 'תומר',
    lastMessageTime: '12:00',
    unreadCount: 5,
    expiresAt: '2026-04-13',
  },
  {
    id: 'ch5',
    type: 'group',
    participantIds: ['u1', 'u2', 'u5', 'u7'],
    eventId: 'e4',
    eventName: 'ערב ג׳אז — Kuli Alma',
    lastMessage: 'היה ערב מדהים!',
    lastMessageSender: 'נועה',
    lastMessageTime: '29.3',
    unreadCount: 0,
    expiresAt: '2026-03-31',
  },
];

export const chatMessages: ChatMessage[] = [
  { id: 'm1', chatId: 'ch1', senderId: 'u2', content: 'היי אדם! ראיתי שיש לנו כמה תחומי עניין משותפים 😊', createdAt: '14:20', isRead: true },
  { id: 'm2', chatId: 'ch1', senderId: 'u1', content: 'היי נועה! כן, חייבים לדבר על צילום! מה את מצלמת?', createdAt: '14:25', isRead: true },
  { id: 'm3', chatId: 'ch1', senderId: 'u2', content: 'בעיקר סטריט ופורטרטים. את/ה גם מצלם/ת?', createdAt: '14:28', isRead: true },
  { id: 'm4', chatId: 'ch1', senderId: 'u1', content: 'כן! בטוח מגיעה לאירוע ביום שישי?', createdAt: '14:30', isRead: true },
  { id: 'm5', chatId: 'ch1', senderId: 'u2', content: 'כן! בטח, נדבר שם 😊', createdAt: '14:32', isRead: false },
];

export const allInterests = [
  { emoji: '🎵', label: 'מוזיקה' },
  { emoji: '🏃', label: 'ספורט' },
  { emoji: '✈️', label: 'טיולים' },
  { emoji: '🍕', label: 'אוכל' },
  { emoji: '📚', label: 'ספרים' },
  { emoji: '🎬', label: 'סרטים' },
  { emoji: '💻', label: 'טכנולוגיה' },
  { emoji: '🎨', label: 'אומנות' },
  { emoji: '🧘', label: 'יוגה' },
  { emoji: '🎮', label: 'גיימינג' },
  { emoji: '📷', label: 'צילום' },
  { emoji: '🍷', label: 'יין' },
  { emoji: '🐕', label: 'כלבים' },
  { emoji: '🌱', label: 'טבע' },
  { emoji: '💃', label: 'ריקוד' },
  { emoji: '🎭', label: 'תיאטרון' },
  { emoji: '☕', label: 'קפה' },
  { emoji: '🏄', label: 'גלישה' },
  { emoji: '🎸', label: 'גיטרה' },
  { emoji: '🏋️', label: 'חדר כושר' },
  { emoji: '🍳', label: 'בישול' },
  { emoji: '🚀', label: 'סטארטאפים' },
  { emoji: '🧘‍♀️', label: 'מדיטציה' },
  { emoji: '🎤', label: 'הופעות' },
  { emoji: '🍺', label: 'בירה' },
  { emoji: '💼', label: 'שיווק' },
];

export function getUserById(id: string): UserProfile | undefined {
  return users.find(u => u.id === id);
}
