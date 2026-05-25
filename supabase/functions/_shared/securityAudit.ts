import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { RequestMeta } from "./requestMeta.ts";

export type AuditSeverity = "info" | "warn" | "high" | "critical";

export async function writeSecurityAudit(
  admin: SupabaseClient,
  entry: {
    action: string;
    severity?: AuditSeverity;
    userId?: string | null;
    targetType?: string | null;
    targetId?: string | null;
    meta?: RequestMeta;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await admin.from("security_audit_logs").insert({
      user_id: entry.userId ?? null,
      action: entry.action,
      severity: entry.severity ?? "info",
      ip_hash: entry.meta?.ipHash ?? null,
      user_agent_hash: entry.meta?.userAgentHash ?? null,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch (e) {
    console.error("[security_audit] insert failed", e);
  }
}
