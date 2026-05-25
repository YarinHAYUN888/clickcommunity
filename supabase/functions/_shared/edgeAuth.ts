import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function optionsOk(): Response {
  return new Response("ok", { headers: corsHeaders });
}

/** Validates Bearer JWT and returns the authenticated user (anon client + getUser). */
export async function requireAuthUser(req: Request): Promise<
  | { ok: true; user: User; authHeader: string; admin: SupabaseClient }
  | { ok: false; response: Response }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, response: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabaseUser.auth.getUser();
  if (error || !user) {
    return { ok: false, response: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  const admin = createClient(supabaseUrl, serviceKey);
  return { ok: true, user, authHeader, admin };
}

/** Ensures JSON body user_id matches JWT subject (prevents IDOR with service role). */
export function assertSelfUserId(
  jwtUserId: string,
  bodyUserId: unknown,
): Response | null {
  if (typeof bodyUserId !== "string" || !bodyUserId) {
    return jsonResponse({ error: "user_id required" }, 400);
  }
  if (bodyUserId !== jwtUserId) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }
  return null;
}

/** Shared secret for pre-auth webhooks (OTP issue, registration relay). */
export function requireWebhookSecret(req: Request): Response | null {
  const expected = Deno.env.get("WEBHOOK_INTERNAL_SECRET")?.trim();
  if (!expected) {
    console.error("[security] WEBHOOK_INTERNAL_SECRET is not configured");
    return jsonResponse({ error: "Server misconfigured" }, 503);
  }
  const provided =
    req.headers.get("x-webhook-secret")?.trim() ||
    req.headers.get("X-Webhook-Secret")?.trim();
  if (!provided || provided !== expected) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }
  return null;
}
