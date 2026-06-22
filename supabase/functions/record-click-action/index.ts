import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Boost duration (minutes); configurable via env, defaults to 30.
function boostDurationMinutes(): number {
  const raw = Number(Deno.env.get("BOOST_DURATION_MINUTES") || "30");
  if (!Number.isFinite(raw) || raw <= 0) return 30;
  return Math.min(1440, Math.floor(raw));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => null) as { action_type?: string } | null;
    const actionType = typeof body?.action_type === "string" ? body.action_type.trim() : "boost";
    if (actionType !== "boost") {
      return new Response(JSON.stringify({ error: "invalid_action" }), { status: 400, headers: corsHeaders });
    }

    console.log("CLICKS ACTION START", { action: "boost", from: userId });

    const { data: meProf, error: meErr } = await supabaseAdmin
      .from("profiles")
      .select("role, subscription_status, suspended, super_role")
      .eq("user_id", userId)
      .maybeSingle();
    if (meErr || !meProf) {
      console.error("CLICKS ACTION FAILED", { action: "boost", reason: "profile_not_found" });
      return new Response(JSON.stringify({ error: "profile_not_found" }), { status: 400, headers: corsHeaders });
    }
    if (meProf.suspended === true) {
      return new Response(JSON.stringify({ error: "not_allowed" }), { status: 403, headers: corsHeaders });
    }
    const isMember = meProf.role === "member" || meProf.subscription_status === "active" || !!meProf.super_role;
    if (!isMember) {
      return new Response(JSON.stringify({ error: "not_allowed" }), { status: 403, headers: corsHeaders });
    }

    const now = Date.now();
    const expiresAt = new Date(now + boostDurationMinutes() * 60 * 1000).toISOString();

    const { error: insertErr } = await supabaseAdmin.from("user_click_actions").insert({
      user_id: userId,
      target_user_id: null,
      action_type: "boost",
      metadata: {},
      expires_at: expiresAt,
    });
    if (insertErr) {
      console.error("CLICKS ACTION FAILED", { action: "boost", reason: "insert", message: insertErr.message });
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: corsHeaders });
    }

    console.log("BOOST SAVED", { from: userId, expires_at: expiresAt });
    console.log("CLICKS ACTION SUCCESS", { action: "boost" });
    return new Response(
      JSON.stringify({ ok: true, expires_at: expiresAt }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("CLICKS ACTION FAILED", { action: "boost", reason: "exception", message });
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
