import type { SupabaseProfile } from '@/hooks/useCurrentUser';
import { blendRawToDisplay } from '@/lib/matching/displayCompatibility';

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const t = new Date(dob).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 31557600000);
}

function hasText(v: string | null | undefined): boolean {
  return !!v?.trim();
}

/** Jaccard on interest labels; empty/one-side → partial signal (not hard zero). */
function interestJaccard(a: string[], b: string[]): number {
  const A = new Set(a.map((x) => x.trim().toLowerCase()).filter(Boolean));
  const B = new Set(b.map((x) => x.trim().toLowerCase()).filter(Boolean));
  if (A.size === 0 && B.size === 0) return 0.35;
  if (A.size === 0 || B.size === 0) return 0.15;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Multi-signal raw fit in [0,1] from data already on profiles (no Edge).
 * Tuned for spread: same community feed still yields different scores per pair.
 */
export function computeFeedPairRaw01(me: SupabaseProfile | null | undefined, their: SupabaseProfile): number {
  const myI = me?.interests || [];
  const thI = their.interests || [];
  const j = interestJaccard(myI, thI);

  const myR = (me?.region || '').trim();
  const thR = (their.region || '').trim();
  let regionSig = 0.12;
  if (myR && thR) regionSig = myR === thR ? 0.22 : 0.08;

  const myAge = ageFromDob(me?.date_of_birth ?? null);
  const thAge = ageFromDob(their.date_of_birth);
  let ageSig = 0.1;
  if (myAge != null && thAge != null) {
    const d = Math.abs(myAge - thAge);
    ageSig = d <= 5 ? 0.18 : d <= 10 ? 0.13 : d <= 15 ? 0.09 : 0.06;
  }

  let rich = 0.06;
  if (hasText(me?.bio) && hasText(their.bio)) rich += 0.07;
  if (hasText(me?.occupation) && hasText(their.occupation)) rich += 0.06;

  const myN = (me?.life_niche || '').trim();
  const thN = (their.life_niche || '').trim();
  const nicheBonus = myN.length > 0 && myN === thN ? 0.04 : 0;

  const raw = j * 0.42 + regionSig * 0.28 + ageSig * 0.22 + Math.min(0.18, rich) + nicheBonus;
  return Math.max(0, Math.min(1, raw));
}

export function computeFeedPairScore(
  me: SupabaseProfile | null | undefined,
  their: SupabaseProfile,
): { score: number; sharedInterests: string[] } {
  const myI = me?.interests || [];
  const thI = their.interests || [];
  const shared = myI.filter((i) => thI.includes(i));
  const raw = computeFeedPairRaw01(me, their);
  return { score: blendRawToDisplay(raw), sharedInterests: shared };
}
