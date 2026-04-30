/** Tunable rewards — keep numeric parity with supabase/functions/_shared/points.ts */
export const TENURE_POINTS_PER_30_DAYS = 10;
export const REFERRAL_SIGNUP_POINTS = 100;
export const PROFILE_COMPLETION_BONUS = 50;
export const REFERRALS_PER_MONTH_DEFAULT = 5;

export const DISCOUNT_TIERS = [
  { points: 200, ils_off: 20 },
  { points: 500, ils_off: 60 },
  { points: 1000, ils_off: 150 },
] as const;
