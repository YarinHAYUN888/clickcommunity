import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockMaybeSingle = vi.fn();
const mockProfilesIn = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: (...args: unknown[]) => mockMaybeSingle(...args),
            }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            in: (...args: unknown[]) => mockProfilesIn(...args),
          }),
        };
      }
      return {};
    }),
  },
}));

import {
  applyEventDetailSecondarySettled,
  getEventById,
  type EventRow,
} from '@/services/events';

const sampleEvent: EventRow = {
  id: 'evt-1',
  name: 'Test Event',
  description: null,
  cover_image_url: null,
  date: '2026-12-01',
  time: '20:00:00',
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
};

describe('applyEventDetailSecondarySettled', () => {
  it('keeps defaults when secondary promises reject', () => {
    const merged = applyEventDetailSecondarySettled([
      { status: 'rejected', reason: new Error('stats edge down') },
      { status: 'rejected', reason: new Error('attendees failed') },
      { status: 'rejected', reason: new Error('photos failed') },
      { status: 'rejected', reason: new Error('registration failed') },
    ]);

    expect(merged.stats).toBeNull();
    expect(merged.attendees).toEqual([]);
    expect(merged.photos).toEqual([]);
    expect(merged.registration).toBeNull();
  });

  it('uses fulfilled values when secondary loads succeed', () => {
    const merged = applyEventDetailSecondarySettled([
      { status: 'fulfilled', value: { total: 5, femalePercent: 50, malePercent: 50 } },
      { status: 'fulfilled', value: [{ user_id: 'u1' }] },
      { status: 'fulfilled', value: [{ id: 'ph1' }] },
      {
        status: 'fulfilled',
        value: {
          id: 'reg1',
          event_id: 'evt-1',
          user_id: 'u1',
          status: 'registered',
          waitlist_position: null,
          paid_amount: null,
          payment_status: 'unpaid',
          created_at: '',
        },
      },
    ]);

    expect(merged.stats?.total).toBe(5);
    expect(merged.attendees).toHaveLength(1);
    expect(merged.photos).toHaveLength(1);
    expect(merged.registration?.status).toBe('registered');
  });
});

describe('getEventById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfilesIn.mockResolvedValue({ data: [], error: null });
  });

  it('returns null when no row (PGRST116-style empty)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await getEventById('missing-id');
    expect(result).toBeNull();
  });

  it('returns null on query error', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });
    const result = await getEventById('evt-1');
    expect(result).toBeNull();
  });

  it('returns event when row exists and passes host isolation', async () => {
    mockMaybeSingle.mockResolvedValue({ data: sampleEvent, error: null });
    const result = await getEventById('evt-1', false);
    expect(result?.id).toBe('evt-1');
    expect(result?.name).toBe('Test Event');
  });

  it('returns null for empty event id', async () => {
    const result = await getEventById('  ');
    expect(result).toBeNull();
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });
});
