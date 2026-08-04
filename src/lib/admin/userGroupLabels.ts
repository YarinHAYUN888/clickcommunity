/** Admin-only labels for Group A/B. Do not import from member-facing screens. */

export type AdminUserGroup = 'A' | 'B' | 'unassigned' | 'rejected';

export type GroupProfileLike = {
  suitability_status?: string | null;
  is_shadow?: boolean | null;
  moderation_status?: string | null;
};

export function isApprovedGroupA(p: GroupProfileLike | null | undefined): boolean {
  if (!p) return false;
  return (
    p.suitability_status === 'active' &&
    !p.is_shadow &&
    (p.moderation_status ?? 'pending') === 'approved'
  );
}

/** B access requires all three: shadow + is_shadow + approved */
export function isApprovedGroupB(p: GroupProfileLike | null | undefined): boolean {
  if (!p) return false;
  return (
    p.suitability_status === 'shadow' &&
    p.is_shadow === true &&
    (p.moderation_status ?? 'pending') === 'approved'
  );
}

export function isPendingGroupBCandidate(p: GroupProfileLike | null | undefined): boolean {
  if (!p) return false;
  return (
    p.suitability_status === 'shadow' &&
    p.is_shadow === true &&
    (p.moderation_status ?? 'pending') === 'pending'
  );
}

export function deriveAdminUserGroup(p: GroupProfileLike | null | undefined): AdminUserGroup {
  if (!p) return 'unassigned';
  if ((p.moderation_status ?? '') === 'rejected' || p.suitability_status === 'blocked') {
    return 'rejected';
  }
  if (isApprovedGroupA(p)) return 'A';
  if (isApprovedGroupB(p)) return 'B';
  return 'unassigned';
}

export function adminUserGroupLabel(group: AdminUserGroup): string {
  if (group === 'A') return 'קבוצה A';
  if (group === 'B') return 'קבוצה B';
  if (group === 'rejected') return 'נדחה';
  return 'טרם שויך';
}

export type EventAudienceGroup = 'A' | 'B' | 'ALL';

export function eventAudienceLabel(ag: string | null | undefined): string {
  if (ag === 'A') return 'קבוצה A';
  if (ag === 'B') return 'קבוצה B';
  if (ag === 'ALL') return 'כל המשתמשים';
  return 'כל המשתמשים';
}

export function canAccessEventAudience(
  p: GroupProfileLike | null | undefined,
  audienceGroup: string | null | undefined,
): boolean {
  const audience = audienceGroup === 'A' || audienceGroup === 'B' || audienceGroup === 'ALL'
    ? audienceGroup
    : 'ALL';
  if (isApprovedGroupA(p)) return audience === 'A' || audience === 'ALL';
  if (isApprovedGroupB(p)) return audience === 'B' || audience === 'ALL';
  return false;
}
