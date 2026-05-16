import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { openaiChatJson } from "../_shared/openaiChatCompletion.ts";
import { buildPersonalityUserPayload, PERSONALITY_SYSTEM_PROMPT } from "../_shared/aiPersonalityPrompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Parsed = {
  personality_summary?: string;
  energy_type?: string;
  communication_style?: string;
  emotional_style?: string;
  social_style?: string;
  relationship_intent?: string;
  lifestyle_type?: string;
  community_risk?: string;
  safety_confidence?: number;
  safety_flags?: string[];
  personality_tags?: string[];
  ai_score?: number;
};

function mergeRiskFlags(existing: unknown, additions: string[]): string[] {
  const base = Array.isArray(existing)
    ? (existing as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const set = new Set(base);
  for (const a of additions) set.add(a);
  return Array.from(set).slice(0, 40);
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

    const body = await req.json().catch(() => ({})) as { user_id?: string };
    const targetId = typeof body?.user_id === "string" && /^[0-9a-f-]{36}$/i.test(body.user_id)
      ? body.user_id
      : userId;
    if (targetId !== userId) {
      return new Response(JSON.stringify({ error: "forbidden_analyze_self_only" }), { status: 403, headers: corsHeaders });
    }

    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select(
        "user_id, first_name, last_name, bio, occupation, interests, region, gender, questionnaire_responses, voice_intro_meta, suitability_status, super_role",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (pErr || !profile) {
      return new Response(JSON.stringify({ error: "profile_not_found" }), { status: 400, headers: corsHeaders });
    }

    const userContent = buildPersonalityUserPayload({
      first_name: profile.first_name,
      last_name: profile.last_name,
      bio: profile.bio,
      occupation: profile.occupation,
      interests: profile.interests,
      region: profile.region,
      gender: profile.gender,
      questionnaire_responses: profile.questionnaire_responses as Record<string, unknown> | null,
      voice_intro_meta: profile.voice_intro_meta as Record<string, unknown> | null,
    });

    const ai = await openaiChatJson([
      { role: "system", content: PERSONALITY_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ]);

    if (!ai.ok) {
      return new Response(JSON.stringify({ error: ai.error }), { status: 503, headers: corsHeaders });
    }

    let parsed: Parsed;
    try {
      parsed = JSON.parse(ai.content) as Parsed;
    } catch {
      return new Response(JSON.stringify({ error: "invalid_ai_json" }), { status: 502, headers: corsHeaders });
    }

    const energy = ["calm", "social", "intense", "balanced"].includes(String(parsed.energy_type))
      ? parsed.energy_type
      : "balanced";
    const risk = ["low", "medium", "high"].includes(String(parsed.community_risk)) ? parsed.community_risk! : "low";
    const tags = {
      personality_tags: Array.isArray(parsed.personality_tags) ? parsed.personality_tags : [],
      safety_flags: Array.isArray(parsed.safety_flags) ? parsed.safety_flags : [],
    };

    const row = {
      user_id: userId,
      personality_summary: parsed.personality_summary?.slice(0, 4000) ?? null,
      energy_type: energy,
      communication_style: parsed.communication_style?.slice(0, 500) ?? null,
      emotional_style: parsed.emotional_style?.slice(0, 500) ?? null,
      social_style: parsed.social_style?.slice(0, 500) ?? null,
      relationship_intent: parsed.relationship_intent?.slice(0, 500) ?? null,
      lifestyle_type: parsed.lifestyle_type?.slice(0, 500) ?? null,
      community_risk: risk,
      ai_tags: tags as unknown as Record<string, unknown>,
      ai_score: typeof parsed.ai_score === "number"
        ? Math.max(0, Math.min(100, parsed.ai_score))
        : null,
      analyzed_at: new Date().toISOString(),
    };

    const { error: upErr } = await supabaseAdmin.from("profile_personality_ai").upsert(row, {
      onConflict: "user_id",
    });
    if (upErr) throw upErr;

    const conf = typeof parsed.safety_confidence === "number" ? parsed.safety_confidence : 0;
    if (risk === "high" && conf >= 0.72 && !profile.super_role) {
      const { data: prof2 } = await supabaseAdmin
        .from("profiles")
        .select("suitability_status, risk_flags")
        .eq("user_id", userId)
        .maybeSingle();
      if (prof2?.suitability_status === "active") {
        const flags = mergeRiskFlags(prof2.risk_flags, [...(tags.safety_flags || []), "ai_community_risk_high"]);
        await supabaseAdmin.from("profiles").update({
          suitability_status: "pending",
          risk_flags: flags,
        }).eq("user_id", userId).eq("suitability_status", "active");
      }
    } else if (risk === "medium" && conf >= 0.8 && !profile.super_role) {
      const { data: prof2 } = await supabaseAdmin
        .from("profiles")
        .select("risk_flags")
        .eq("user_id", userId)
        .maybeSingle();
      const flags = mergeRiskFlags(prof2?.risk_flags, [...(tags.safety_flags || []), "ai_community_risk_medium"]);
      await supabaseAdmin.from("profiles").update({ risk_flags: flags }).eq("user_id", userId);
    }

    return new Response(JSON.stringify({ ok: true, community_risk: risk }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
