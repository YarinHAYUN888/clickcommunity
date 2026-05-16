/**
 * מיפוי מוצרי לציר "כניסה לקהילה" מהאפיון — השדות ב-DB שמשרתים כל שלב.
 * SMS / אירוע ניסיון / חמשת האישורים: מתבססים על טבלאות ושדות אלה; אינטגרציית ספק חיצוני תתווסף בנפרד.
 */
export const COMMUNITY_PIPELINE = {
  moderationQueue: 'profiles.moderation_status = pending',
  approvedMember: 'profiles.moderation_status = approved',
  shadowOrIsolated: 'profiles.is_shadow או suitability_status לפי SuitabilityGate',
  welcomeSmsStub: 'profiles.community_welcome_sms_sent_at — מתעד שליחת SMS אחרי אישור (טריגר עתידי)',
  trialEvent: 'קישור לאירוע ניסיון דרך event_registrations / אירוע ייעודי (לוגיקה עתידית)',
  fiveVouches: 'טבלת community_vouches + profiles.community_vouch_count (מעודכן בטריגר)',
} as const;
