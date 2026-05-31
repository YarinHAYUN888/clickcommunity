import { describe, expect, it } from 'vitest';
import { getLoginErrorMessage } from '@/lib/authErrors';

describe('getLoginErrorMessage', () => {
  it('maps Supabase service restriction (402) to a clear Hebrew message', () => {
    const msg = getLoginErrorMessage({
      name: 'AuthApiError',
      message:
        'Service for this project is restricted due to the following violations: exceed_cached_egress_quota.',
      status: 402,
    });
    expect(msg).toContain('מושהה');
    expect(msg).not.toBe('אימייל או סיסמה שגויים');
  });

  it('maps invalid credentials', () => {
    expect(
      getLoginErrorMessage({
        name: 'AuthApiError',
        message: 'Invalid login credentials',
        status: 400,
      }),
    ).toBe('אימייל או סיסמה שגויים');
  });
});
