import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  PROFILE_COMPLETION_BONUS,
  REFERRAL_SIGNUP_POINTS,
  REFERRALS_PER_MONTH_DEFAULT,
} from "../_shared/points.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalizeCode = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const isValidReferralCodeFormat = (code: string) => /^[a-zA-Z0-9]{4,16}$/.test(code);

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

    const body = await req.json().catch(() => ({}));
    const referralCode = normalizeCode(body?.referral_code);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: alreadyBonus } = await admin
      .from("points_history")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "profile_completion_bonus")
      .maybeSingle();

    let profileBonusGranted = false;
    if (!alreadyBonus) {
      const { error: bErr } = await admin.from("points_history").insert({
        user_id: user.id,
        type: "profile_completion_bonus",
        amount: PROFILE_COMPLETION_BONUS,
        description: "בונוס השלמת פרופיל",
      });
      if (bErr) throw bErr;
      profileBonusGranted = true;
    }

    let referralGranted = false;
    let referralSkipReason: string | null = null;

    if (isValidReferralCodeFormat(referralCode)) {
      const { data: referee } = await admin
        .from("profiles")
        .select("user_id, referral_disabled, referral_cap_override")
        .eq("referral_code", referralCode)
        .maybeSingle();

      if (!referee?.user_id) {
        referralSkipReason = "invalid_code";
      } else if (referee.user_id === user.id) {
        referralSkipReason = "self_referral";
      } else if (referee.referral_disabled) {
        referralSkipReason = "referral_disabled";
      } else {
        const cap = referee.referral_cap_override ?? REFERRALS_PER_MONTH_DEFAULT;
        const { data: cnt } = await admin.rpc("count_referrals_this_month", { p_user_id: referee.user_id });
        const used = cnt ?? 0;
        if (used >= cap) {
          referralSkipReason = "monthly_cap";
        } else {
          const monthYear = new Date().toISOString().slice(0, 7);
          const { error: refErr } = await admin.from("referrals").insert({
            referrer_id: referee.user_id,
            referred_user_id: user.id,
            month_year: monthYear,
            status: "registered",
          });

          if (refErr?.code === "23505") {
            referralSkipReason = "duplicate";
          } else if (refErr) {
            throw refErr;
          } else {
            const { error: ptsErr } = await admin.from("points_history").insert({
              user_id: referee.user_id,
              type: "referral_signup",
              amount: REFERRAL_SIGNUP_POINTS,
              ref_id: user.id,
              description: "חבר/ה הצטרף/ה דרך הקישור שלך",
            });
            if (ptsErr) throw ptsErr;
            referralGranted = true;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        profile_bonus_granted: profileBonusGranted,
        referral_granted: referralGranted,
        referral_skip_reason: referralSkipReason,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("claim-signup-rewards:", err);
    return new Response(JSON.stringify({ error: "server_error" }), { status: 500, headers: corsHeaders });
  }
});
