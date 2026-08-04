import { describe, expect, it } from 'vitest';
import {
  canAccessEventAudience,
  isApprovedGroupA,
  isApprovedGroupB,
  isPendingGroupBCandidate,
} from '@/lib/admin/userGroupLabels';

const groupA = {
  suitability_status: 'active',
  is_shadow: false,
  moderation_status: 'approved',
};

const groupBApproved = {
  suitability_status: 'shadow',
  is_shadow: true,
  moderation_status: 'approved',
};

const groupBPending = {
  suitability_status: 'shadow',
  is_shadow: true,
  moderation_status: 'pending',
};

const rejected = {
  suitability_status: 'blocked',
  is_shadow: false,
  moderation_status: 'rejected',
};

describe('Group A/B approval helpers', () => {
  it('recognizes approved A and approved B', () => {
    expect(isApprovedGroupA(groupA)).toBe(true);
    expect(isApprovedGroupB(groupA)).toBe(false);
    expect(isApprovedGroupB(groupBApproved)).toBe(true);
    expect(isApprovedGroupA(groupBApproved)).toBe(false);
  });

  it('treats pending B candidate as not approved B', () => {
    expect(isPendingGroupBCandidate(groupBPending)).toBe(true);
    expect(isApprovedGroupB(groupBPending)).toBe(false);
    expect(isApprovedGroupA(groupBPending)).toBe(false);
  });
});

describe('canAccessEventAudience', () => {
  it('approved A sees A and ALL, not B', () => {
    expect(canAccessEventAudience(groupA, 'A')).toBe(true);
    expect(canAccessEventAudience(groupA, 'ALL')).toBe(true);
    expect(canAccessEventAudience(groupA, 'B')).toBe(false);
  });

  it('approved B sees B and ALL, not A', () => {
    expect(canAccessEventAudience(groupBApproved, 'B')).toBe(true);
    expect(canAccessEventAudience(groupBApproved, 'ALL')).toBe(true);
    expect(canAccessEventAudience(groupBApproved, 'A')).toBe(false);
  });

  it('pending B candidate cannot see B or ALL', () => {
    expect(canAccessEventAudience(groupBPending, 'B')).toBe(false);
    expect(canAccessEventAudience(groupBPending, 'ALL')).toBe(false);
    expect(canAccessEventAudience(groupBPending, 'A')).toBe(false);
  });

  it('rejected user cannot see any audience', () => {
    expect(canAccessEventAudience(rejected, 'A')).toBe(false);
    expect(canAccessEventAudience(rejected, 'B')).toBe(false);
    expect(canAccessEventAudience(rejected, 'ALL')).toBe(false);
  });
});
