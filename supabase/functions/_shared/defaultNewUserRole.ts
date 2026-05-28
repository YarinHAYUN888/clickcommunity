import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type NewUserRole = "guest" | "member";

export function normalizeDefaultRole(raw: unknown): NewUserRole {
  const role = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (role === "guest") return "guest";
  if (role === "community_member") return "member";
  if (role === "member") return "member";
  return "member";
}

export async function getDefaultNewUserRole(
  supabaseAdmin: SupabaseClient,
): Promise<NewUserRole> {
  try {
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", "default_new_user_role")
      .maybeSingle();
    if (error) {
      console.warn("[defaultNewUserRole] lookup failed, fallback member", error.message);
      return "member";
    }
    const role = normalizeDefaultRole(data?.value);
    console.log("DEFAULT ROLE FOUND", { role, raw: data?.value ?? null });
    return role;
  } catch (e) {
    console.warn("[defaultNewUserRole] lookup crashed, fallback member", e);
    return "member";
  }
}
