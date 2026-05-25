import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { openaiChatJson } from "../_shared/openaiChatCompletion.ts";
import { getRequestMeta } from "../_shared/requestMeta.ts";
import { checkRateLimit } from "../_shared/securityRateLimit.ts";
import { writeSecurityAudit } from "../_shared/securityAudit.ts";
import { jsonResponse, optionsOk } from "../_shared/edgeAuth.ts";

const SUITABILITY_PROMPT = `You are a strict gatekeeper for a serious community. Analyze the profile JSON and return JSON only:
{"score":0-100,"label":"fit"|"borderline"|"not_fit","reasons":[],"decision":"approved"|"pending"|"rejected","confidence":0-1,"reason":"","flags":[]}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsOk();

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const admin = createClient(supabaseUrl, serviceKey);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const userId = userData.user.id;

  try {
    const body = await req.json().catch(() => ({})) as { user_id?: string; profile?: Record<string, unknown> };
    const targetId = typeof body.user_id === "string" && /^[0-9a-f-]{36}$/i.test(body.user_id)
      ? body.user_id
      : userId;
    if (targetId !== userId) {
      return jsonResponse({ error: "forbidden_self_only" }, 403);
    }

    const meta = await getRequestMeta(req);
    const rate = await checkRateLimit(admin, {
      action: "analyze_registration_suitability",
      key: userId,
      maxCount: 6,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.allowed) {
      return jsonResponse({ error: "rate_limited", retry_after_sec: rate.retryAfterSec }, 429);
    }

    const profileInput = body.profile && typeof body.profile === "object" ? body.profile : body;

    const ai = await openaiChatJson([
      { role: "system", content: SUITABILITY_PROMPT },
      { role: "user", content: JSON.stringify(profileInput) },
    ]);

    if (!ai.ok) {
      return jsonResponse({ error: "ai_unavailable", detail: ai.error }, 503);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(ai.content);
    } catch {
      return jsonResponse({ error: "ai_parse_failed" }, 502);
    }

    await writeSecurityAudit(admin, {
      action: "analyze_registration_suitability",
      userId,
      meta,
      metadata: { label: parsed.label, decision: parsed.decision },
    });

    return jsonResponse({ ok: true, result: parsed });
  } catch (err) {
    console.error("[analyze-registration-suitability]", err);
    return jsonResponse({ error: "unexpected_error" }, 500);
  }
});
