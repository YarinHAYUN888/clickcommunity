import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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
    return new Response(JSON.stringify({ error: "server_error" }), { status: 500, headers: corsHeaders });
  }
});
