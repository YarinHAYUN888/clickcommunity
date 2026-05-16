/**
 * Deterministic weighted compatibility (no OpenAI per pair).
 * Weights: interests 20%, age 10%, location 10%, personality 30%, intent 20%, community 10%.
 */

/** Same band as client feed UI: scores shown in [50, 100]. */
function clampDisplayScore(n: number): number {
  return Math.max(50, Math.min(100, Math.round(n)));
}

function interestOverlapCount(a: string[], b: string[]): number {
  const A = new Set(a.map((x) => x.trim().toLowerCase()).filter(Boolean));
  const B = new Set(b.map((x) => x.trim().toLowerCase()).filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter;
}

export type ProfileLite = {
  user_id: string;
  date_of_birth: string | null;
  region: string | null;
  interests: string[] | null;
  gender: string | null;
};

export type PreferencesLite = {
  preferred_gender: string | null;
  min_age: number | null;
  max_age: number | null;
  preferred_regions: string[] | null;
  relationship_goal: string | null;
} | null;

export type PersonalityLite = {
  ai_score: number | null;
  relationship_intent: string | null;
  energy_type: string | null;
  community_risk: string;
  personality_summary: string | null;
} | null;

export function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const t = new Date(dob).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 31557600000);
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a.map((x) => x.trim().toLowerCase()).filter(Boolean));
  const B = new Set(b.map((x) => x.trim().toLowerCase()).filter(Boolean));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function riskPoints(r: string): number {
  if (r === "high") return 0;
  if (r === "medium") return 5;
  return 10;
}

function intentOverlap(a: string | null, b: string | null, pa: string | null, pb: string | null): number {
  const parts = [a, b, pa, pb].filter(Boolean).map((s) => String(s).toLowerCase());
  if (parts.length < 2) return 10;
  let best = 0;
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      if (parts[i].includes(parts[j]) || parts[j].includes(parts[i])) best = 20;
      const toks = (s: string) => new Set(s.split(/[\s,.;]+/).filter((t) => t.length > 2));
      const Ti = toks(parts[i]);
      const Tj = toks(parts[j]);
      let c = 0;
      for (const t of Ti) if (Tj.has(t)) c++;
      if (c >= 2) best = Math.max(best, 16);
      else if (c === 1) best = Math.max(best, 10);
    }
  }
  return best;
}

function genderPrefMatch(pref: string | null, gender: string | null): number {
  if (!pref || !gender) return 10;
  const p = pref.toLowerCase();
  const g = gender.toLowerCase();
  if (p === "everyone" || p === "all" || p === "any") return 10;
  if (p.includes(g) || g.includes(p)) return 10;
  return 4;
}

export function computeWeightedCompatibility(
  me: ProfileLite,
  other: ProfileLite,
  myPrefs: PreferencesLite,
  otherPrefs: PreferencesLite,
  myPers: PersonalityLite,
  otherPers: PersonalityLite,
): {
  score: number;
  breakdown: Record<string, number>;
  reasonHe: string;
  aiSummary: string;
} {
  const myInts = me.interests || [];
  const otInts = other.interests || [];
  const interestsPts = Math.round(jaccard(myInts, otInts) * 20);

  const myAge = ageFromDob(me.date_of_birth);
  const otAge = ageFromDob(other.date_of_birth);
  let agePts = 10;
  if (myAge != null && otAge != null && myPrefs?.min_age != null && myPrefs?.max_age != null) {
    agePts = otAge >= myPrefs.min_age && otAge <= myPrefs.max_age ? 10 : 3;
  } else if (myAge != null && otAge != null) {
    const diff = Math.abs(myAge - otAge);
    agePts = diff <= 5 ? 10 : diff <= 12 ? 6 : 3;
  }

  let locPts = 0;
  if (me.region && other.region && me.region === other.region) locPts = 10;
  else if (myPrefs?.preferred_regions?.length && other.region) {
    locPts = myPrefs.preferred_regions.includes(other.region) ? 8 : 2;
  } else locPts = 5;

  let persPts = 15;
  if (myPers?.ai_score != null && otherPers?.ai_score != null) {
    persPts = Math.round(((myPers.ai_score + otherPers.ai_score) / 2 / 100) * 30);
  } else if (myPers?.ai_score != null || otherPers?.ai_score != null) {
    const s = myPers?.ai_score ?? otherPers?.ai_score ?? 0;
    persPts = Math.round((s / 100) * 22);
  }

  const intentPts = intentOverlap(
    myPrefs?.relationship_goal ?? null,
    otherPrefs?.relationship_goal ?? null,
    myPers?.relationship_intent ?? null,
    otherPers?.relationship_intent ?? null,
  );

  const commPts = Math.round(
    (riskPoints(myPers?.community_risk || "low") + riskPoints(otherPers?.community_risk || "low")) / 2,
  );

  let penalty = 0;
  if (myPrefs?.preferred_gender && other.gender) {
    const g = genderPrefMatch(myPrefs.preferred_gender, other.gender);
    if (g < 8) penalty += 4;
  }
  if (otherPrefs?.preferred_gender && me.gender) {
    const g = genderPrefMatch(otherPrefs.preferred_gender, me.gender);
    if (g < 8) penalty += 4;
  }

  let total = interestsPts + agePts + locPts + persPts + intentPts + commPts - penalty;
  total = Math.max(0, Math.min(100, total));
  const displayScore = clampDisplayScore(total);

  const lines: string[] = [];
  const hasSharedInterestLabels = interestOverlapCount(myInts, otInts) > 0;
  if (hasSharedInterestLabels && interestsPts >= 6) {
    lines.push("יש לכם תחומי עניין משותפים.");
  }
  if (locPts >= 8) lines.push("אזור מגורים או העדפה גיאוגרפית מתאימים.");
  if (persPts >= 20) lines.push("פרופילים עשירים וברורים מבחינת אישיות.");
  if (intentPts >= 14) lines.push("כיוון דומה ביחסים או בקהילה.");
  if (myPers?.energy_type && otherPers?.energy_type && myPers.energy_type === otherPers.energy_type) {
    lines.push(`סגנון אנרגיה דומה (${myPers.energy_type}).`);
  }
  if (lines.length === 0) {
    lines.push("יש בסיס להכיר — פרטים נוספים ישפרו את ההתאמה.");
  }

  const aiSummary = [myPers?.personality_summary, otherPers?.personality_summary]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 400);

  return {
    score: displayScore,
    breakdown: {
      interests: interestsPts,
      age: agePts,
      location: locPts,
      personality: persPts,
      relationship_intent: intentPts,
      community_quality: commPts,
    },
    reasonHe: lines.join("\n"),
    aiSummary: aiSummary || "סיכום אישיות יתעדכן לאחר ניתוח AI לפרופילים.",
  };
}
