import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { REFERRALS_PER_MONTH_DEFAULT } from "../_shared/points.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user_id } = await req.json();
    if (!user_id) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { count: eventsAttended } = await supabase
      .from("event_registrations")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user_id)
      .in("status", ["registered", "approved"]);

    const today = new Date().toISOString().split("T")[0];
    const { data: nextEventReg } = await supabase
      .from("event_registrations")
      .select("event_id, events(id, name, date)")
      .eq("user_id", user_id)
      .in("status", ["registered", "approved"])
      .gte("events.date", today)
      .order("events(date)", { ascending: true })
      .limit(1);

    let nextEvent = null;
    if (nextEventReg && nextEventReg.length > 0) {
      const ev = (nextEventReg[0] as any).events;
      if (ev) nextEvent = { id: ev.id, name: ev.name, date: ev.date };
    }

    const { data: eventsThisMonthData } = await supabase.rpc("count_events_this_month", { p_user_id: user_id });
    const eventsThisMonth = eventsThisMonthData ?? 0;

    const { data: voteScoreData } = await supabase.rpc("get_user_vote_score", { p_user_id: user_id });
    const voteScore = voteScoreData ?? 0;

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "profile_completion, status, role, points, referral_code, referral_disabled, referral_cap_override",
      )
      .eq("user_id", user_id)
      .single();

    let referralsThisMonth = 0;
    if (profile?.role === "member") {
      const { data: refData } = await supabase.rpc("count_referrals_this_month", { p_user_id: user_id });
      referralsThisMonth = refData ?? 0;
    }

    const referralCap = profile?.referral_cap_override ?? REFERRALS_PER_MONTH_DEFAULT;
    const referralsRemaining =
      profile?.referral_disabled ? 0 : Math.max(0, referralCap - referralsThisMonth);

    const { count: referralsJoined } = await supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_id", user_id)
      .not("referred_user_id", "is", null);

    const { data: refPtsRows } = await supabase
      .from("points_history")
      .select("amount")
      .eq("user_id", user_id)
      .eq("type", "referral_signup");

    const referralPointsEarned = (refPtsRows ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);

    return new Response(JSON.stringify({
      events_attended: eventsAttended ?? 0,
      next_event: nextEvent,
      events_this_month: eventsThisMonth,
      events_remaining: Math.max(0, 3 - eventsThisMonth),
      vote_score: voteScore,
      profile_completion: profile?.profile_completion ?? 0,
      referrals_this_month: referralsThisMonth,
      referrals_remaining: referralsRemaining,
      referral_cap: referralCap,
      referral_code: profile?.referral_code ?? null,
      referral_disabled: profile?.referral_disabled ?? false,
      points: profile?.points ?? 0,
      referrals_joined_count: referralsJoined ?? 0,
      referral_points_earned: referralPointsEarned,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
