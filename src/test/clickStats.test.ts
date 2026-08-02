import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockMaybeSingle } = vi.hoisted(() => ({
  mockMaybeSingle: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: mockMaybeSingle,
        })),
      })),
    })),
  },
}));

import {
  EMPTY_CLICK_STATS,
  fetchMyClickStats,
  hasEventAccessFromStats,
} from '@/services/clickStats';

describe('clickStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns zero stats when no row exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const stats = await fetchMyClickStats('user-1');
    expect(stats).toEqual(EMPTY_CLICK_STATS);
  });

  it('throws on server error', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST205', message: 'table not found' },
    });
    await expect(fetchMyClickStats('user-1')).rejects.toThrow('לא הצלחנו לטעון מספר הקליקים');
  });

  it('hasEventAccessFromStats unlocks at 5 or unlocked_at', () => {
    expect(hasEventAccessFromStats({ incoming_click_count: 4, event_access_unlocked_at: null })).toBe(
      false,
    );
    expect(hasEventAccessFromStats({ incoming_click_count: 5, event_access_unlocked_at: null })).toBe(
      true,
    );
    expect(
      hasEventAccessFromStats({
        incoming_click_count: 2,
        event_access_unlocked_at: '2026-01-01T00:00:00Z',
      }),
    ).toBe(true);
  });
});
