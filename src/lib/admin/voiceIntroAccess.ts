/** Validates storage object path belongs to the given user (admin voice intro access). */
export function isVoiceIntroPathForUser(userId: string, objectPath: string): boolean {
  const trimmed = objectPath.trim();
  if (!trimmed || !userId) return false;
  return trimmed.startsWith(`${userId}/`);
}

export function hasPlayableVoiceIntro(row: {
  voice_intro_url?: string | null;
  voice_intro_status?: string | null;
}): boolean {
  return Boolean(row.voice_intro_url?.trim() && row.voice_intro_status === 'uploaded');
}

export function moderationDisplayLabel(status: string | null | undefined): string {
  if (status === 'pending') return 'דורש אימות ידני';
  if (status === 'approved') return 'אושר';
  if (status === 'rejected') return 'נדחה';
  return status || '—';
}
