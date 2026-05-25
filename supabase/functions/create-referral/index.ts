import { REFERRALS_PER_MONTH_DEFAULT } from "../_shared/points.ts";
import { jsonResponse, optionsOk, requireAuthUser } from "../_shared/edgeAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsOk();

  const auth = await requireAuthUser(req);
  if (!auth.ok) return auth.response;

  try {
    const { method, contact } = await req.json();
    const referrerId = auth.user.id;

    if (!method || !contact) {
      return jsonResponse({ error: "method, contact required" }, 400);
    }

    const supabase = auth.admin;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, referral_disabled, referral_cap_override")
      .eq("user_id", referrerId)
      .single();

    if (!profile || profile.role !== "member") {
      return jsonResponse({ error: "members_only" }, 403);
    }

    if (profile.referral_disabled) {
      return jsonResponse({ error: "referrals_disabled" }, 403);
    }

    const cap = profile.referral_cap_override ?? REFERRALS_PER_MONTH_DEFAULT;

    const { data: cnt } = await supabase.rpc("count_referrals_this_month", {
      p_user_id: referrerId,
    });
    if ((cnt ?? 0) >= cap) {
      return jsonResponse({ error: "monthly_cap_reached" }, 400);
    }

    const monthYear = new Date().toISOString().slice(0, 7);
    const insertData: Record<string, unknown> = {
      referrer_id: referrerId,
      month_year: monthYear,
      status: "pending",
    };
    if (method === "phone") insertData.referred_phone = contact;
    else insertData.referred_email = contact;

    const { error } = await supabase.from("referrals").insert(insertData);
    if (error) throw error;

    return jsonResponse({
      success: true,
      referrals_remaining: Math.max(0, cap - (cnt ?? 0) - 1),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
