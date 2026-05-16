/** Display band for compatibility UI: never below 50%, never above 100%. */

export function clampDisplayScore(n: number): number {
  return Math.max(50, Math.min(100, Math.round(n)));
}

/** Map a 0–1 fit signal to 50–100 (0 → 50, 1 → 100). */
export function blendRawToDisplay(raw01: number): number {
  const r = Math.max(0, Math.min(1, raw01));
  return clampDisplayScore(50 + r * 50);
}
