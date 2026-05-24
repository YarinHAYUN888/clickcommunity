/**
 * Stable keys stored in profiles.life_niche — must match DB check constraint.
 * Labels align with product personas (PDF spec).
 */
export const LIFE_NICHE_OPTIONS = [
  { value: 'soldier_post_service', label: '🪖 אחרי שירות / חיילות' },
  { value: 'post_big_trip', label: '✈️ אחרי טיול גדול' },
  { value: 'student', label: '📚 סטודנט/ית' },
  { value: 'first_job', label: '💼 בעבודה הראשונה' },
  { value: 'soldier_active_service', label: 'חייל בשירות צבאי🪖' },
  { value: 'discharged', label: 'משוחרר✂️' },
  { value: 'business_world', label: 'בעולם העסקים🤝' },
] as const;

export type LifeNicheValue = (typeof LIFE_NICHE_OPTIONS)[number]['value'];

const ALLOWED = new Set<string>(LIFE_NICHE_OPTIONS.map((o) => o.value));

/** Conservative adjacency for tier-4 feed expansion (same life-stage family). */
export const LIFE_NICHE_ADJACENCY: Record<string, string[]> = {
  soldier_post_service: ['discharged', 'soldier_active_service', 'first_job'],
  soldier_active_service: ['soldier_post_service', 'discharged'],
  discharged: ['soldier_post_service', 'first_job'],
  post_big_trip: ['student', 'first_job'],
  student: ['first_job', 'post_big_trip'],
  first_job: ['student', 'business_world', 'post_big_trip'],
  business_world: ['first_job'],
};

export function isValidLifeNiche(v: string | null | undefined): v is LifeNicheValue {
  return typeof v === 'string' && ALLOWED.has(v);
}

export function lifeNicheLabel(v: string | null | undefined): string {
  if (!v) return '';
  const o = LIFE_NICHE_OPTIONS.find((x) => x.value === v);
  return o?.label ?? '';
}

export function areAdjacentNiches(a: string, b: string): boolean {
  if (!a || !b || a === b) return false;
  const adj = LIFE_NICHE_ADJACENCY[a];
  return adj?.includes(b) ?? false;
}
