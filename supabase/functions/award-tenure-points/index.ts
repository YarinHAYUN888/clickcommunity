import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  TENURE_BLOCK_MS,
  TENURE_POINTS_PER_30_DAYS,
} from "../_shared/points.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("role, subscription_status, created_at, last_tenure_grant_at")
      .eq("user_id", user.id)
      .single();

    if (pErr || !profile) {
      return new Response(JSON.stringify({ error: "profile_not_found" }), { status: 404, headers: corsHeaders });
    }

    if (profile.role !== "member" || profile.subscription_status !== "active") {
      return new Response(
        JSON.stringify({ success: true, granted_blocks: 0, awarded_points: 0, skipped: "not_active_member" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const anchorMs = new Date(profile.last_tenure_grant_at || profile.created_at).getTime();
    const elapsed = Date.now() - anchorMs;
    const grantedBlocks = Math.floor(elapsed / TENURE_BLOCK_MS);

    if (grantedBlocks <= 0) {
      return new Response(
        JSON.stringify({ success: true, granted_blocks: 0, awarded_points: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const totalPoints = grantedBlocks * TENURE_POINTS_PER_30_DAYS;
    const newLast = new Date(anchorMs + grantedBlocks * TENURE_BLOCK_MS).toISOString();

    const { error: insErr } = await admin.from("points_history").insert({
      user_id: user.id,
      type: "tenure",
      amount: totalPoints,
      description: `ותק: ${grantedBlocks} × 30 יום`,
    });

    if (insErr) throw insErr;

    const { error: upErr } = await admin
      .from("profiles")
      .update({ last_tenure_grant_at: newLast })
      .eq("user_id", user.id);

    if (upErr) throw upErr;

    return new Response(
      JSON.stringify({
        success: true,
        granted_blocks: grantedBlocks,
        awarded_points: totalPoints,
        last_tenure_grant_at: newLast,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
