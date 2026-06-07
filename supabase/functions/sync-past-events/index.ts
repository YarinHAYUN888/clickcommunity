import { jsonResponse, optionsOk, requireAuthUser } from "../_shared/edgeAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsOk();

  const auth = await requireAuthUser(req);
  if (!auth.ok) return auth.response;

  try {
    const { error } = await auth.admin.rpc("mark_past_events");
    if (error) {
      return jsonResponse({ ok: false, error_code: "server_error", message: error.message }, 500);
    }
    return jsonResponse({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ ok: false, error_code: "server_error", message }, 500);
  }
});
