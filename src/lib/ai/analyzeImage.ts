export interface AnalyzeImageResult {
  valid: boolean;
  reason: string;
}

/**
 * Validates profile image URL: non-empty, loadable, basic size check.
 * Human-face detection is mocked (no API key) – extend with vision API later.
 */
export async function analyzeImage(imageUrl: string | null | undefined): Promise<AnalyzeImageResult> {
  if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim().length < 8) {
    return { valid: false, reason: 'חסרה תמונה או כתובת לא תקינה' };
  }

  const url = imageUrl.trim();

  if (url.startsWith('data:image/')) {
    return { valid: true, reason: 'תמונת נתונים מקומית' };
  }

  if (url.includes('/storage/v1/object/public/') || url.includes('/object/public/')) {
    return { valid: true, reason: 'תמונה מאחסון מערכת' };
  }

  try {
    const res = await fetch(url, { method: 'GET', mode: 'cors' });
    if (!res.ok) {
      return { valid: false, reason: 'לא ניתן לטעון את קובץ התמונה' };
    }
    const blob = await res.blob();
    if (!blob.size || blob.size < 800) {
      return { valid: false, reason: 'תמונה ריקה או קטנה מדי' };
    }
    if (!blob.type.startsWith('image/')) {
      return { valid: false, reason: 'הקובץ אינו מזוהה כתמונה' };
    }
    // Mock “human presence” – pass when image loads and looks reasonable
    return { valid: true, reason: 'תמונה נטענה ונבדקה (ללא זיהוי פנים חיצוני)' };
  } catch {
    return {
      valid: false,
      reason: 'שגיאת רשת או CORS בטעינת התמונה',
    };
  }
}

export async function analyzePrimaryPhotos(photoUrls: string[]): Promise<AnalyzeImageResult> {
  if (!photoUrls.length) {
    return { valid: false, reason: 'אין תמונות בפרופיל' };
  }
  const first = photoUrls[0];
  return analyzeImage(first);
}
