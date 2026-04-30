

# סקשן חדש: "רגעים מהאירועים" בדף הנחיתה

הוספת גלריית תמונות אינטראקטיבית עם 6 תמונות שהעלית, אנימציית כניסה בגלילה, אפקט hover מתוחכם, ו-Lightbox פרימיום. **תוספת בלבד** — לא נוגעים בשום סקשן קיים.

---

## מה נבנה

### 1. נכסים (Assets)
מעתיק את 6 התמונות ל-`src/assets/moments/`:
- `moment-1.png` עד `moment-6.png` (Frame_2 עד Frame_7)

### 2. קומפוננטה ראשית: `src/components/landing/MomentsSection.tsx`
סקשן חדש עם ID `#moments` שמכיל:
- כותרת: **"רגעים מהאירועים —"** (Rubik 700, 40-56px, צבע `#1A1A2E`)
- תת-כותרת: **"קהילה אמיתית, חיבורים אמיתיים, זיכרונות אמיתיים —"** (Rubik 500, 18-22px, `#374151`)
- רקע: גרדיאנט עדין `linear-gradient(180deg, #FAFAFA 0%, #F5F3FF 100%)` תואם לשאר הסקשנים הבהירים
- כניסה לכותרת: `RevealOnScroll` קיים (fade + slide-up)

### 3. גריד Masonry — 6 כרטיסיות
- **Desktop (≥1024px)**: 3 עמודות (CSS `columns-3`)
- **Tablet/Mobile**: 2 עמודות (`columns-2`)
- Gap: 16px
- כל תמונה ב-aspect ratio טבעי שלה (התמונות שלך הן ~9:16 אנכיות → masonry יחלק אותן יפה)

### 4. אנימציית כניסה בגלילה (פרומפט 2)
לכל כרטיסיה, באמצעות `framer-motion` + `useInView`:
- מצב התחלתי: `opacity: 0, y: 40, scale: 0.95`
- מצב סופי: `opacity: 1, y: 0, scale: 1`
- Spring: `damping: 20, stiffness: 100` (מ-`springs.gentle` הקיים)
- Stagger: 100ms בין כרטיסיה לכרטיסיה
- `once: true` — מתבצע פעם אחת בלבד

### 5. אנימציה סטטית/אינטראקטיבית על הכרטיסיות (פרומפט 1 — Spotlight Glow)
מטמיע את רעיון ה-`GlowCard` כעטיפה לכל תמונה, מותאם לפרויקט:
- מעקב cursor → CSS variables `--x`, `--y` בתוך הכרטיס
- Spotlight גרדיאנט סגול (`hue` בסיס 280 — תואם למותג #7C3AED) שמופיע מתחת לעכבר
- Border זוהר עדין שעוקב אחרי הסמן (pseudo-elements `::before` / `::after`)
- ב-hover: `scale(1.02)`, רוויית צבע עולה (`saturate(0.92) → saturate(1.1)`), צל סגול חזק יותר
- אייקון `Maximize2` (lucide) שמופיע במרכז-תחתית ב-hover עם גרדיאנט עדין מלמטה
- במובייל (ללא hover): הזוהר מושבת, נשארות רק פינות מעוגלות + צל

הכל מוטמע **inline בתוך הסקשן** ולא כקומפוננטה חיצונית גנרית — כדי לא לזהם את `components/ui/`.

### 6. Lightbox — Expand to Center
קומפוננטה משנית באותו קובץ:
- לחיצה על תמונה → פתיחה במרכז המסך באמצעות **`layoutId`** של framer-motion (shared layout animation — התמונה "עפה" מהגריד למרכז)
- רקע: `rgba(10,10,20,0.88)` + `backdrop-blur(24px)`, `z-50`
- תמונה: `max-w-[90vw] max-h-[85vh]`, `object-contain`, פינות 16px, צל עמוק
- Spring: `damping: 30, stiffness: 300`

**פקדים** (RTL-aware):
- כפתור סגירה (`X`) — שמאל-עליון, עיגול 44px עם glass
- חץ קודם (`ChevronRight`) — ימין-אמצע (RTL: ימין = הקודם)
- חץ הבא (`ChevronLeft`) — שמאל-אמצע
- מונה "3 / 6" — מרכז-תחתון, pill עם glass
- מקלדת: `Esc` סוגר, `←` הבא, `→` קודם
- מובייל: swipe (drag) ימין/שמאל לניווט, מטה לסגירה (סף 80px / 120px)
- לחיצה על הרקע סוגרת
- `body.style.overflow = 'hidden'` כשפתוח
- Preload לתמונה הבאה והקודמת
- חיצים מוסתרים במובייל

### 7. Reduced Motion
שימוש ב-`useReducedMotion` של framer-motion:
- מבטל parallax, scale ב-hover, drag עם רוטציה
- משאיר fade בסיסי (150ms ease)

### 8. אינטגרציה ב-`LandingPage.tsx`
מוסיף `<MomentsSection />` בין `<SubscriptionSection />` ל-`<BottomLineSection />` — בדיוק היכן שהאפיון מבקש (סקשן 10.5).

---

## פרטים טכניים

**קבצים חדשים:**
- `src/assets/moments/moment-1.png` … `moment-6.png` (6 קבצים)
- `src/components/landing/MomentsSection.tsx` (סקשן + Lightbox + GlowImageCard פנימי)

**קבצים שעוברים עריכה:**
- `src/pages/LandingPage.tsx` — import + הוספת רכיב אחד
- ייתכן `src/index.css` — תוספת keyframe קלה אם נדרש (כנראה לא — הכל via framer-motion)

**ללא תלויות חדשות**: framer-motion כבר מותקן, lucide-react כבר מותקן, אין צורך ב-react-masonry-css (משתמשים ב-CSS columns של Tailwind).

**מה נשאר בדיוק כמו שהוא:**
- כל 11 הסקשנים הקיימים, הלוגו, ה-Header/Footer, הצבעים, הטקסטים, ה-routing
- ה-`SectionIndicators` יזהה אוטומטית את הסקשן החדש לפי ה-ID `#moments` (אם הוא סורק את ה-DOM) — אם זה לא המצב, נוסיף אותו ידנית למערך הסקשנים בלבד

---

לאחר אישור — בונה את הכל בגל אחד.

