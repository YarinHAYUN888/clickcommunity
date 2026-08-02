import { describe, it, expect } from 'vitest';
import {
  isVoiceIntroPathForUser,
  hasPlayableVoiceIntro,
  moderationDisplayLabel,
} from '@/lib/admin/voiceIntroAccess';

describe('isVoiceIntroPathForUser', () => {
  it('accepts path under user folder', () => {
    expect(isVoiceIntroPathForUser('abc-123', 'abc-123/intro-1.webm')).toBe(true);
  });

  it('rejects path for another user', () => {
    expect(isVoiceIntroPathForUser('abc-123', 'other-user/intro-1.webm')).toBe(false);
  });

  it('rejects empty path', () => {
    expect(isVoiceIntroPathForUser('abc-123', '')).toBe(false);
    expect(isVoiceIntroPathForUser('abc-123', '   ')).toBe(false);
  });
});

describe('hasPlayableVoiceIntro', () => {
  it('requires uploaded status and url', () => {
    expect(
      hasPlayableVoiceIntro({ voice_intro_url: 'u/intro.webm', voice_intro_status: 'uploaded' }),
    ).toBe(true);
    expect(
      hasPlayableVoiceIntro({ voice_intro_url: 'u/intro.webm', voice_intro_status: 'pending' }),
    ).toBe(false);
    expect(hasPlayableVoiceIntro({ voice_intro_url: null, voice_intro_status: 'uploaded' })).toBe(
      false,
    );
  });
});

describe('moderationDisplayLabel', () => {
  it('maps known moderation statuses', () => {
    expect(moderationDisplayLabel('pending')).toBe('דורש אימות ידני');
    expect(moderationDisplayLabel('approved')).toBe('אושר');
    expect(moderationDisplayLabel('rejected')).toBe('נדחה');
  });
});
