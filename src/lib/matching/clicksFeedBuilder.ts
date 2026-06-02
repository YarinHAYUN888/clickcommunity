import type { SupabaseProfile } from '@/hooks/useCurrentUser';
import type { ClickFeedItem } from '@/hooks/useClicksFeed';
import { areAdjacentNiches, isValidLifeNiche } from '@/data/lifeNiche';
import { hasDisplayPhoto } from '@/lib/profileCompletion';
import { computeFeedPairScore } from '@/lib/matching/feedPairScore';

export type FeedTier =
  | 'tier1_niche_and_interest'
  | 'tier2_niche'
  | 'tier3_interest'
  | 'tier4_adjacent_niche'
  | 'tier5_pool';

export type ExclusionReason =
  | 'self'
  | 'guest'
  | 'not_member'
  | 'not_approved'
  | 'suspended'
  | 'not_active'
  | 'swiped'
  | 'tier_no_match';

export type FeedExclusionReport = {
  excludedCounts: Partial<Record<ExclusionReason, number>>;
  selectedTier: FeedTier | null;
  includedCount: number;
  includedSample: { user_id: string; tier: FeedTier; score: number }[];
};

const MAX_FEED = 50;

function sharedInterestsCount(a: string[], b: string[]): number {
  const B = new Set(b);
  return a.filter((i) => B.has(i)).length;
}

function isInPool(p: SupabaseProfile, swipeHidden: Set<string>, viewerId: string): ExclusionReason | null {
  if (p.user_id === viewerId) return 'self';
  if (p.role === 'guest') return 'guest';
  if (p.role !== 'member') return 'not_member';
  if (p.moderation_status !== 'approved') return 'not_approved';
  if (p.suspended === true) return 'suspended';
  if (p.suitability_status && p.suitability_status !== 'active') return 'not_active';
  if (swipeHidden.has(p.user_id)) return 'swiped';
  return null;
}

function tierMatch(
  tier: FeedTier,
  viewer: SupabaseProfile,
  candidate: SupabaseProfile,
): boolean {
  const myNiche = (viewer.life_niche || '').trim();
  const theirNiche = (candidate.life_niche || '').trim();
  const myInts = viewer.interests || [];
  const theirInts = candidate.interests || [];
  const shared = sharedInterestsCount(myInts, theirInts);

  switch (tier) {
    case 'tier1_niche_and_interest':
      return !!myNiche && myNiche === theirNiche && shared > 0;
    case 'tier2_niche':
      return !!myNiche && myNiche === theirNiche;
    case 'tier3_interest':
      return shared > 0;
    case 'tier4_adjacent_niche':
      return !!myNiche && isValidLifeNiche(myNiche) && areAdjacentNiches(myNiche, theirNiche);
    case 'tier5_pool':
      return true;
    default:
      return false;
  }
}

const TIER_ORDER: FeedTier[] = [
  'tier1_niche_and_interest',
  'tier2_niche',
  'tier3_interest',
  'tier4_adjacent_niche',
  'tier5_pool',
];

function isProfilePartial(p: SupabaseProfile): boolean {
  const hasName = !!p.first_name?.trim();
  const hasBio = !!p.bio?.trim();
  const hasOccupation = !!p.occupation?.trim();
  const hasInterestsList = Array.isArray(p.interests) && p.interests.length > 0;
  return !(hasName && hasDisplayPhoto(p) && (hasBio || hasOccupation || hasInterestsList));
}

export function buildClicksFeedCandidates(
  viewer: SupabaseProfile | null | undefined,
  candidates: SupabaseProfile[],
  swipeHidden: Set<string>,
  viewerId: string,
): { items: ClickFeedItem[]; report: FeedExclusionReport } {
  const report: FeedExclusionReport = {
    excludedCounts: {},
    selectedTier: null,
    includedCount: 0,
    includedSample: [],
  };

  const bump = (r: ExclusionReason) => {
    report.excludedCounts[r] = (report.excludedCounts[r] ?? 0) + 1;
  };

  const pool: SupabaseProfile[] = [];
  for (const p of candidates) {
    const reason = isInPool(p, swipeHidden, viewerId);
    if (reason) bump(reason);
    else pool.push(p);
  }

  let selected: { profile: SupabaseProfile; tier: FeedTier }[] = [];
  for (const tier of TIER_ORDER) {
    const matched = pool.filter((p) => tierMatch(tier, viewer ?? ({} as SupabaseProfile), p));
    if (matched.length > 0) {
      selected = matched.map((profile) => ({ profile, tier }));
      report.selectedTier = tier;
      break;
    }
  }

  if (selected.length === 0 && pool.length > 0) {
    selected = pool.map((profile) => ({ profile, tier: 'tier5_pool' as FeedTier }));
    report.selectedTier = 'tier5_pool';
  }

  const items: ClickFeedItem[] = selected
    .map(({ profile }) => {
      const { score, sharedInterests } = computeFeedPairScore(viewer ?? null, profile);
      return {
        profile,
        compatibilityScore: score,
        sharedInterests,
        isProfilePartial: isProfilePartial(profile),
      };
    })
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
    .slice(0, MAX_FEED);

  report.includedCount = items.length;
  report.includedSample = items.slice(0, 8).map((i) => ({
    user_id: i.profile.user_id,
    tier: report.selectedTier!,
    score: i.compatibilityScore,
  }));

  return { items, report };
}
