import { jsonResponse, optionsOk, requireAuthUser } from "../_shared/edgeAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsOk();

  const auth = await requireAuthUser(req);
  if (!auth.ok) return auth.response;

  try {
    const { data: adminProfile } = await auth.admin
      .from("profiles")
      .select("super_role")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!adminProfile?.super_role) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = typeof body.target_user_id === "string" ? body.target_user_id.trim() : "";
    if (!targetUserId) {
      return jsonResponse({ error: "target_user_id required" }, 400);
    }

    const { count, error } = await auth.admin
      .from("profile_swipes")
      .select("*", { count: "exact", head: true })
      .eq("to_user_id", targetUserId)
      .in("action", ["like", "super_like"]);

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ like_count: count ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
