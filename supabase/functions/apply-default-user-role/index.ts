import {
  assertSelfUserId,
  jsonResponse,
  optionsOk,
  requireAuthUser,
} from "../_shared/edgeAuth.ts";
import { getDefaultNewUserRole } from "../_shared/defaultNewUserRole.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsOk();

  const auth = await requireAuthUser(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const forbidden = assertSelfUserId(auth.user.id, body.user_id);
    if (forbidden) return forbidden;

    const userId = auth.user.id;
    const defaultRole = await getDefaultNewUserRole(auth.admin);

    const { data: profile, error: fetchErr } = await auth.admin
      .from("profiles")
      .select("role, subscription_status, super_role")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchErr) {
      return jsonResponse({ error: fetchErr.message }, 500);
    }

    if (profile?.super_role) {
      return jsonResponse({ success: true, role: profile.role, skipped: true });
    }

    const currentRole = profile?.role ?? null;
    const subStatus = profile?.subscription_status ?? null;

    if (currentRole === "member" && subStatus === "active") {
      return jsonResponse({ success: true, role: "member", skipped: true });
    }

    if (currentRole === "member") {
      return jsonResponse({ success: true, role: currentRole, skipped: true });
    }

    if (!currentRole || currentRole === "guest") {
      if (subStatus === "active") {
        const { error: promoteErr } = await auth.admin
          .from("profiles")
          .update({ role: "member", updated_at: new Date().toISOString() })
          .eq("user_id", userId);
        if (promoteErr) return jsonResponse({ error: promoteErr.message }, 500);
        console.log("ROLE ASSIGNED", { userId, role: "member", reason: "active_subscription" });
        return jsonResponse({ success: true, role: "member" });
      }

      const { error: updateErr } = await auth.admin
        .from("profiles")
        .update({ role: defaultRole, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      if (updateErr) {
        return jsonResponse({ error: updateErr.message }, 500);
      }

      console.log("ROLE ASSIGNED", { userId, role: defaultRole });
      console.log("USER CREATED WITH ROLE", { userId, role: defaultRole });
      return jsonResponse({ success: true, role: defaultRole });
    }

    return jsonResponse({ success: true, role: currentRole, skipped: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
