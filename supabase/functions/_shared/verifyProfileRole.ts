import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type DbProfileRole = "guest" | "member";

export async function verifyProfileRole(
  supabaseAdmin: SupabaseClient,
  userId: string,
  expectedRole: DbProfileRole,
): Promise<{ ok: true; role: DbProfileRole } | { ok: false; message: string; actual: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message, actual: null };
  }

  const actual = (data?.role as string | null) ?? null;
  if (actual !== expectedRole) {
    console.error("ROLE VERIFY FAILED", { userId, expected: expectedRole, actual });
    return { ok: false, message: "role_update_not_applied", actual };
  }

  return { ok: true, role: expectedRole };
}
