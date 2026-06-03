import { describe, expect, it } from 'vitest';
import {
  EventRegistrationError,
  mapEventRegistrationErrorMessage,
  mapEventRegistrationResponse,
  isOpaqueEdgeInvokeMessage,
  SubscriptionRequiredError,
} from '@/services/events';

describe('mapEventRegistrationResponse', () => {
  it('maps successful registration', () => {
    const result = mapEventRegistrationResponse({
      ok: true,
      status: 'registered',
      message: 'נרשמת לאירוע בהצלחה',
      registration_status: 'registered',
      entry_code: 'EVT-ABC',
    });
    expect(result.status).toBe('registered');
    expect(result.registration_status).toBe('registered');
    expect(result.entry_code).toBe('EVT-ABC');
    expect(result.success).toBe(true);
  });

  it('maps already_registered without throwing', () => {
    const result = mapEventRegistrationResponse({
      ok: true,
      status: 'already_registered',
      message: 'כבר נרשמת לאירוע',
      registration_status: 'registered',
      waitlist_position: null,
    });
    expect(result.status).toBe('already_registered');
    expect(result.message).toBe('כבר נרשמת לאירוע');
  });

  it('throws SubscriptionRequiredError for subscription_required', () => {
    expect(() =>
      mapEventRegistrationResponse({
        ok: false,
        error_code: 'subscription_required',
        message: 'אירוע זה דורש מנוי פעיל',
      }),
    ).toThrow(SubscriptionRequiredError);
  });

  it('throws EventRegistrationError with Hebrew message for server_error', () => {
    try {
      mapEventRegistrationResponse({
        ok: false,
        error_code: 'server_error',
        message: 'לא הצלחנו להשלים את ההרשמה. נסה/י שוב',
      });
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EventRegistrationError);
      expect((err as EventRegistrationError).errorCode).toBe('server_error');
      expect((err as EventRegistrationError).message).toBe('לא הצלחנו להשלים את ההרשמה. נסה/י שוב');
    }
  });

  it('uses Hebrew fallback when message missing', () => {
    try {
      mapEventRegistrationResponse({
        ok: false,
        error_code: 'subscription_required',
      });
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SubscriptionRequiredError);
    }
    expect(mapEventRegistrationErrorMessage('subscription_required')).toBe('אירוע זה דורש מנוי פעיל');
    expect(mapEventRegistrationErrorMessage('server_error')).toBe('לא הצלחנו להשלים את ההרשמה. נסה/י שוב');
  });
});

describe('isOpaqueEdgeInvokeMessage', () => {
  it('detects generic Supabase non-2xx messages', () => {
    expect(isOpaqueEdgeInvokeMessage('Edge Function returned a non-2xx status code')).toBe(true);
    expect(isOpaqueEdgeInvokeMessage('some other error')).toBe(false);
  });
});
