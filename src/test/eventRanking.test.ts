import { describe, expect, it } from 'vitest';
import {
  computeAttendeeCompatScore,
  sortEventsByMatchPriority,
  EVENT_CLICK_COMPAT_THRESHOLD,
  type EventRow,
} from '@/services/events';

const baseEvent = (id: string, date: string, time: string): EventRow => ({
  id,
  name: `Event ${id}`,
  description: null,
  cover_image_url: null,
  date,
  time,
  location_name: 'TLV',
  location_address: null,
  location_url: null,
  host_id: null,
  max_capacity: 40,
  reserved_new_spots: 0,
  requires_subscription: false,
  gender_balance_target: 0.5,
  status: 'open',
  is_past_voting_open: false,
  created_at: '',
  updated_at: '',
});

describe('computeAttendeeCompatScore', () => {
  it('returns higher score for shared interests and region', () => {
    const viewer = { interests: ['a', 'b', 'c'], region: 'מרכז' };
    const close = { interests: ['a', 'b', 'd'], region: 'מרכז' };
    const far = { interests: ['x'], region: 'צפון' };
    expect(computeAttendeeCompatScore(viewer, close)).toBeGreaterThanOrEqual(EVENT_CLICK_COMPAT_THRESHOLD);
    expect(computeAttendeeCompatScore(viewer, far)).toBeLessThan(EVENT_CLICK_COMPAT_THRESHOLD);
  });
});

describe('sortEventsByMatchPriority', () => {
  it('sorts by mutual then click score without removing events', () => {
    const events = [
      baseEvent('e1', '2026-12-01', '20:00:00'),
      baseEvent('e2', '2026-12-02', '19:00:00'),
      baseEvent('e3', '2026-11-28', '18:00:00'),
    ];
    const scores = new Map([
      ['e1', { mutual_score: 0, click_score: 1, veteran_score: 0 }],
      ['e2', { mutual_score: 2, click_score: 0, veteran_score: 0 }],
      ['e3', { mutual_score: 1, click_score: 3, veteran_score: 0 }],
    ]);
    const sorted = sortEventsByMatchPriority(events, scores);
    expect(sorted.map((e) => e.id)).toEqual(['e2', 'e3', 'e1']);
    expect(sorted.length).toBe(3);
  });

  it('uses veteran_score as tertiary sort key', () => {
    const events = [
      baseEvent('e1', '2026-12-01', '20:00:00'),
      baseEvent('e2', '2026-12-02', '19:00:00'),
    ];
    const scores = new Map([
      ['e1', { mutual_score: 1, click_score: 1, veteran_score: 0 }],
      ['e2', { mutual_score: 1, click_score: 1, veteran_score: 3 }],
    ]);
    const sorted = sortEventsByMatchPriority(events, scores);
    expect(sorted.map((e) => e.id)).toEqual(['e2', 'e1']);
    expect(sorted[0].veteran_score).toBe(3);
  });
});
