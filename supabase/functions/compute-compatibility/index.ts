import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { computeWeightedCompatibility } from "../_shared/compatibilityEngine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BATCH = 25;

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
    const meId = userData.user.id;

    const body = await req.json().catch(() => ({})) as {
      other_user_id?: string;
      other_user_ids?: string[];
    };

    let others: string[] = [];
    if (Array.isArray(body.other_user_ids) && body.other_user_ids.length) {
      others = [...new Set(body.other_user_ids.filter((x) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)))];
    } else if (typeof body.other_user_id === "string" && /^[0-9a-f-]{36}$/i.test(body.other_user_id)) {
      others = [body.other_user_id];
    }
    others = others.filter((id) => id !== meId).slice(0, MAX_BATCH);
    if (others.length === 0) {
      return new Response(JSON.stringify({ error: "other_user_ids required" }), { status: 400, headers: corsHeaders });
    }

    const { data: meProf, error: meErr } = await supabaseAdmin
      .from("profiles")
      .select("user_id, date_of_birth, region, interests, gender, suspended, moderation_status")
      .eq("user_id", meId)
      .maybeSingle();
    if (meErr || !meProf || meProf.suspended === true || meProf.moderation_status !== "approved") {
      return new Response(JSON.stringify({ error: "not_allowed" }), { status: 403, headers: corsHeaders });
    }

    const { data: myPrefs } = await supabaseAdmin.from("profile_preferences").select("*").eq("user_id", meId).maybeSingle();
    const { data: myPers } = await supabaseAdmin.from("profile_personality_ai").select("*").eq("user_id", meId).maybeSingle();

    const results: Record<string, unknown>[] = [];

    for (const otherId of others) {
      const { data: otProf, error: otErr } = await supabaseAdmin
        .from("profiles")
        .select("user_id, date_of_birth, region, interests, gender, suspended, moderation_status")
        .eq("user_id", otherId)
        .maybeSingle();
      if (otErr || !otProf || otProf.suspended === true || otProf.moderation_status !== "approved") {
        continue;
      }

      const { data: otPrefs } = await supabaseAdmin.from("profile_preferences").select("*").eq("user_id", otherId).maybeSingle();
      const { data: otPers } = await supabaseAdmin.from("profile_personality_ai").select("*").eq("user_id", otherId).maybeSingle();

      const { score, breakdown, reasonHe, aiSummary } = computeWeightedCompatibility(
        {
          user_id: meProf.user_id,
          date_of_birth: meProf.date_of_birth,
          region: meProf.region,
          interests: meProf.interests,
          gender: meProf.gender,
        },
        {
          user_id: otProf.user_id,
          date_of_birth: otProf.date_of_birth,
          region: otProf.region,
          interests: otProf.interests,
          gender: otProf.gender,
        },
        myPrefs
          ? {
            preferred_gender: myPrefs.preferred_gender,
            min_age: myPrefs.min_age,
            max_age: myPrefs.max_age,
            preferred_regions: myPrefs.preferred_regions,
            relationship_goal: myPrefs.relationship_goal,
          }
          : null,
        otPrefs
          ? {
            preferred_gender: otPrefs.preferred_gender,
            min_age: otPrefs.min_age,
            max_age: otPrefs.max_age,
            preferred_regions: otPrefs.preferred_regions,
            relationship_goal: otPrefs.relationship_goal,
          }
          : null,
        myPers
          ? {
            ai_score: myPers.ai_score != null ? Number(myPers.ai_score) : null,
            relationship_intent: myPers.relationship_intent,
            energy_type: myPers.energy_type,
            community_risk: myPers.community_risk || "low",
            personality_summary: myPers.personality_summary,
          }
          : null,
        otPers
          ? {
            ai_score: otPers.ai_score != null ? Number(otPers.ai_score) : null,
            relationship_intent: otPers.relationship_intent,
            energy_type: otPers.energy_type,
            community_risk: otPers.community_risk || "low",
            personality_summary: otPers.personality_summary,
          }
          : null,
      );

      const user_a = meId < otherId ? meId : otherId;
      const user_b = meId < otherId ? otherId : meId;

      const { data: saved, error: saveErr } = await supabaseAdmin
        .from("profile_matches")
        .upsert(
          {
            user_a,
            user_b,
            compatibility_score: score,
            compatibility_breakdown: breakdown,
            compatibility_reason: reasonHe,
            ai_summary: aiSummary,
            match_status: "active",
          },
          { onConflict: "user_a,user_b" },
        )
        .select("id, user_a, user_b, compatibility_score, compatibility_breakdown, compatibility_reason, ai_summary, match_status, updated_at")
        .single();

      if (!saveErr && saved) {
        results.push({
          other_user_id: otherId,
          match: saved,
          highlights: {
            other_energy_type: otPers?.energy_type ?? null,
            my_energy_type: myPers?.energy_type ?? null,
            other_lifestyle: otPers?.lifestyle_type ?? null,
            other_communication: otPers?.communication_style ?? null,
          },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
