import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getRequestMeta } from "../_shared/requestMeta.ts";
import { checkRateLimit } from "../_shared/securityRateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalizeCode = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const isValidReferralCodeFormat = (code: string) => /^[a-zA-Z0-9]{4,16}$/.test(code);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const code = normalizeCode(body?.code);
    if (!isValidReferralCodeFormat(code)) {
      return new Response(JSON.stringify({ first_name: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const meta = await getRequestMeta(req);
    const rate = await checkRateLimit(admin, {
      action: "referral_preview",
      key: meta.ipHash ?? "unknown",
      maxCount: 40,
      windowMs: 60 * 1000,
      blockMs: 5 * 60 * 1000,
    });
    if (!rate.allowed) {
      return new Response(JSON.stringify({ first_name: null }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("first_name, referral_disabled")
      .eq("referral_code", code)
      .maybeSingle();

    if (!profile || profile.referral_disabled) {
      return new Response(JSON.stringify({ first_name: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ first_name: profile.first_name || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_err) {
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
