import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type RateLimitConfig = {
  action: string;
  key: string;
  maxCount: number;
  windowMs: number;
  blockMs?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSec?: number;
};

export async function checkRateLimit(
  admin: SupabaseClient,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(now - config.windowMs).toISOString();

  const { data: row } = await admin
    .from("security_rate_limits")
    .select("id, count, window_start, blocked_until")
    .eq("key", config.key)
    .eq("action", config.action)
    .maybeSingle();

  if (row?.blocked_until && new Date(row.blocked_until).getTime() > now) {
    const retryAfterSec = Math.ceil(
      (new Date(row.blocked_until).getTime() - now) / 1000,
    );
    return { allowed: false, retryAfterSec };
  }

  const inWindow =
    row?.window_start && new Date(row.window_start).getTime() >= now - config.windowMs;
  const count = inWindow ? (row?.count ?? 0) : 0;

  if (count >= config.maxCount) {
    const blockUntil = config.blockMs
      ? new Date(now + config.blockMs).toISOString()
      : null;
    if (row?.id) {
      await admin
        .from("security_rate_limits")
        .update({
          count: count + 1,
          blocked_until: blockUntil,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
    return {
      allowed: false,
      retryAfterSec: blockUntil
        ? Math.ceil((new Date(blockUntil).getTime() - now) / 1000)
        : 300,
    };
  }

  const nextCount = inWindow ? count + 1 : 1;
  const nextWindowStart = inWindow ? row!.window_start : new Date().toISOString();

  await admin.from("security_rate_limits").upsert(
    {
      key: config.key,
      action: config.action,
      count: nextCount,
      window_start: nextWindowStart,
      blocked_until: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key,action" },
  );

  return { allowed: true };
}
