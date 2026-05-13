# n8n — מיפוי אימייל HTML ממרכז האוטומציות

הפונקציה `automation-dispatch` (Supabase Edge) מוסיפה לכל שליחה שדות מוכנים לתיבת דואר HTML, בנוסף לשדות הקיימים לתאימות לאחור.

## שדות חשובים ב־JSON ל־webhook

לאחר שהזרימה מקבלת את גוף הבקשה מ־Webhook (בדרך כלל השדות יושבים בראש האובייקט), השתמשו ב:

| מטרה | ביטוי מומלץ (n8n) |
|------|---------------------|
| גוף HTML מלא (RTL, לוגו, פיסקאות) | `{{ $json.template.body_html }}` |
| טקסט גיבוי / multipart | `{{ $json.template.body_plain }}` |
| נושא | `{{ $json.template.subject }}` |
| גוף מקורי (טקסט התבנית אחרי משתנים) | `{{ $json.template.body }}` |

ב־**Gmail** או שליחת HTML דומה: מפו את שדה ה־**HTML / Body** ל־`template.body_html`, לא ל־`body` בלבד — כדי למנוע הצגת טקסט גולמי עם `\n` או ללא עיצוב.

> אם בזרימה שלכם עטפתם את ה-payload בשכבה נוספת (למשל `body.automation`), התאימו את הנתיב בהתאם — עבור גוף ה־POST שמגיע ישירות מ־`automation-dispatch`, השדות הם תחת `template`.

## סודות ב-Supabase (Edge Functions)

הגדרו ב-Dashboard → Edge Functions → Secrets (או `supabase secrets set`):

- `EMAIL_LOGO_URL` — כתובת HTTPS ציבורית לתמונת לוגו (למשל מ-Supabase Storage bucket ציבורי).
- אופציונלי: `EMAIL_BRAND_COLOR` (ברירת מחדל `#7c3aed`), `EMAIL_FOOTER_LINE` (ברירת מחדל טקסט פוטר בעברית).

בצד הלקוח, לתצוגה מקדימה באדמין בלבד: `VITE_EMAIL_LOGO_URL` לאותו URL (אופציונלי).

## בדיקה

1. שלחו **שליחת בדיקה** מטאב «מפתחים» במרכז האוטומציות.
2. ב־n8n, פתחו את הריצה האחרונה ובדקו ש־`template.body_html` מכיל HTML מלא.
3. ודאו שהצומת שולח את השדה הזה ל-Gmail/HTML ולא את גרסת הטקסט הגולמי בלבד.
