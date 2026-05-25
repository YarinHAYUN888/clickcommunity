import {
  assertSelfUserId,
  jsonResponse,
  optionsOk,
  requireAuthUser,
} from "../_shared/edgeAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsOk();

  const auth = await requireAuthUser(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const forbidden = assertSelfUserId(auth.user.id, body.user_id);
    if (forbidden) return forbidden;

    const userId = auth.user.id;
    const supabase = auth.admin;

    const { data: sub, error: fetchErr } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (fetchErr || !sub) {
      return jsonResponse({ error: "no_active_subscription" }, 404);
    }

    await supabase
      .from("subscriptions")
      .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
      .eq("id", sub.id);

    await supabase
      .from("profiles")
      .update({ subscription_status: "cancelled" })
      .eq("user_id", userId);

    return jsonResponse({
      success: true,
      ends_at: sub.current_period_end,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
