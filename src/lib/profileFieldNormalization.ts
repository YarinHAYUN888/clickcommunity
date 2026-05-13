/**
 * Coerce Supabase `profiles.photos` / JSON into a string[] so UI never calls `.map` on a string.
 */
export function normalizePhotoUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return [];
    if (t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t) as unknown;
        if (Array.isArray(parsed)) return normalizePhotoUrls(parsed);
      } catch {
        return [];
      }
    }
  }
  return [];
}

/**
 * Coerce `profiles.interests` (array of strings, JSON string, comma list, or {label}[]) into string[].
 */
export function normalizeInterestLabels(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string' && item.trim()) return [item.trim()];
      if (item && typeof item === 'object' && 'label' in (item as Record<string, unknown>)) {
        const l = (item as { label?: unknown }).label;
        return typeof l === 'string' && l.trim() ? [l.trim()] : [];
      }
      return [];
    });
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return [];
    if (t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t) as unknown;
        if (Array.isArray(parsed)) return normalizeInterestLabels(parsed);
      } catch {
        /* fall through */
      }
    }
    return t.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}
