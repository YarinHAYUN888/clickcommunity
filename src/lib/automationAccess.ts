/** localStorage: super users may opt in to technical automation UI (webhooks, logs, JSON). */
export const AUTOMATION_TECHNICAL_VIEW_LS_KEY = 'clicks_automation_technical_view';

export function parseAutomationDeveloperEmails(): Set<string> {
  const raw = import.meta.env.VITE_AUTOMATION_DEVELOPER_EMAILS?.trim() ?? '';
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Technical / developer automation surfaces (N8N, webhooks, raw logs, retries). */
export function computeAutomationTechnicalAccess(params: {
  isSuperUser: boolean;
  superRole: string | null;
  userEmail: string | null | undefined;
  /** true when super user explicitly enabled via LS or hidden gesture */
  localStorageTechnicalView: boolean;
}): boolean {
  const email = (params.userEmail ?? '').trim().toLowerCase();
  if (params.superRole === 'developer') return true;
  if (email && parseAutomationDeveloperEmails().has(email)) return true;
  if (params.isSuperUser && params.localStorageTechnicalView) return true;
  return false;
}

export function readTechnicalViewFromStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(AUTOMATION_TECHNICAL_VIEW_LS_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeTechnicalViewToStorage(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(AUTOMATION_TECHNICAL_VIEW_LS_KEY, '1');
    else localStorage.removeItem(AUTOMATION_TECHNICAL_VIEW_LS_KEY);
  } catch {
    /* ignore */
  }
}
