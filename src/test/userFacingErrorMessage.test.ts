import { describe, expect, it } from 'vitest';
import { userFacingErrorMessage } from '@/lib/userFacingErrorMessage';

describe('userFacingErrorMessage', () => {
  it('maps realtime SDK errors to Hebrew', () => {
    const msg = userFacingErrorMessage(
      new Error('cannot add postgres_changes callbacks after subscribe'),
    );
    expect(msg).toContain('זמן אמת');
    expect(msg).not.toContain('postgres_changes');
  });

  it('returns generic message for unknown errors', () => {
    expect(userFacingErrorMessage(new Error('random'))).toContain('שגיאה לא צפויה');
  });
});
