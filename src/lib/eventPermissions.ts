/** Participant counts, gender ratio, capacity bars — super users (admins / system managers) only. */
export function canViewEventParticipantStats(superRole: string | null | undefined): boolean {
  return !!superRole?.trim();
}
