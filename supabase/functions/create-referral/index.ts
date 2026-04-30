import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { REFERRALS_PER_MONTH_DEFAULT } from "../_shared/points.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { referrer_id, method, contact } = await req.json();
    if (!referrer_id || !method || !contact)
      return new Response(JSON.stringify({ error: "referrer_id, method, contact required" }), { status: 400, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, referral_disabled, referral_cap_override")
      .eq("user_id", referrer_id)
      .single();

    if (!profile || profile.role !== "member")
      return new Response(JSON.stringify({ error: "members_only" }), { status: 403, headers: corsHeaders });

    if (profile.referral_disabled)
      return new Response(JSON.stringify({ error: "referrals_disabled" }), { status: 403, headers: corsHeaders });

    const cap = profile.referral_cap_override ?? REFERRALS_PER_MONTH_DEFAULT;

    const { data: cnt } = await supabase.rpc("count_referrals_this_month", { p_user_id: referrer_id });
    if ((cnt ?? 0) >= cap)
      return new Response(JSON.stringify({ error: "monthly_cap_reached" }), { status: 400, headers: corsHeaders });

    const monthYear = new Date().toISOString().slice(0, 7);
    const insertData: Record<string, unknown> = {
      referrer_id,
      month_year: monthYear,
      status: "pending",
    };
    if (method === "phone") insertData.referred_phone = contact;
    else insertData.referred_email = contact;

    const { error } = await supabase.from("referrals").insert(insertData);
    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      referrals_remaining: Math.max(0, cap - (cnt ?? 0) - 1),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
