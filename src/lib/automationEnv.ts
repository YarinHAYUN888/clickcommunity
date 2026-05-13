/** Client-visible automation mode (banner / campaign UX). Real webhook URLs live on the server (Edge secrets). */
export function getClientAutomationMode(): 'test' | 'production' {
  const m = import.meta.env.VITE_AUTOMATION_WEBHOOK_MODE?.toLowerCase();
  return m === 'production' ? 'production' : 'test';
}

export function isProductionCampaignsEnabled(): boolean {
  return getClientAutomationMode() === 'production';
}
