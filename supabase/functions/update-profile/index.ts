import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  assertSelfUserId,
  jsonResponse,
  optionsOk,
  requireAuthUser,
} from "../_shared/edgeAuth.ts";
import { checkRateLimit } from "../_shared/securityRateLimit.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsOk();

  const auth = await requireAuthUser(req);
  if (!auth.ok) return auth.response;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const rate = await checkRateLimit(admin, {
    action: "update_profile",
    key: auth.user.id,
    maxCount: 30,
    windowMs: 60 * 1000,
  });
  if (!rate.allowed) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  try {
    const body = await req.json();
    const forbidden = assertSelfUserId(auth.user.id, body.user_id);
    if (forbidden) return forbidden;

    const userId = auth.user.id;
    const { first_name, occupation, bio, photos, interests, life_niche } = body;

    const updates: Record<string, unknown> = {};

    if (first_name !== undefined) {
      if (typeof first_name !== "string" || first_name.length < 2) {
        return jsonResponse({ error: "first_name must be >= 2 chars" }, 400);
      }
      updates.first_name = first_name;
    }
    if (occupation !== undefined) updates.occupation = occupation;
    if (life_niche !== undefined) {
      const allowed = new Set([
        "post_big_trip",
        "student",
        "first_job",
        "soldier_active_service",
        "discharged",
        "business_world",
      ]);
      const n = typeof life_niche === "string" ? life_niche.trim() : "";
      if (n.length > 0 && !allowed.has(n)) {
        return jsonResponse({ error: "invalid life_niche" }, 400);
      }
      updates.life_niche = n.length > 0 ? n : null;
    }
    if (bio !== undefined) {
      if (typeof bio === "string" && bio.length > 300) {
        return jsonResponse({ error: "bio max 300 chars" }, 400);
      }
      updates.bio = bio;
    }
    if (photos !== undefined) {
      if (!Array.isArray(photos)) {
        return jsonResponse({ error: "photos must be an array" }, 400);
      }
      const urls = photos.filter((u: unknown) => typeof u === "string" && u.length > 0);
      if (urls.length > 12) {
        return jsonResponse({ error: "too many photos" }, 400);
      }
      updates.photos = urls;
    }
    if (interests !== undefined) {
      if (Array.isArray(interests) && interests.length > 0 && interests.length < 5) {
        return jsonResponse({ error: "interests must be >= 5 if provided" }, 400);
      }
      updates.interests = interests;
    }

    if (Object.keys(updates).length === 0) {
      return jsonResponse({ error: "no fields to update" }, 400);
    }

    const { data, error } = await auth.admin
      .from("profiles")
      .update(updates)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    const row = data as Record<string, unknown>;
    const fn = typeof row.first_name === "string" ? row.first_name.trim() : "";
    const fnOk = fn.length >= 2;
    const interestsList = Array.isArray(row.interests) ? (row.interests as unknown[]) : [];
    const interestsOk = interestsList.length === 0 || interestsList.length >= 5;
    const dob = row.date_of_birth;
    const gender = typeof row.gender === "string" ? row.gender.trim() : "";
    const niche = typeof row.life_niche === "string" ? row.life_niche.trim() : "";
    const allowedNiche = new Set([
      "post_big_trip",
      "student",
      "first_job",
      "soldier_active_service",
      "discharged",
      "business_world",
    ]);
    const nicheOk = niche.length === 0 || allowedNiche.has(niche);
    const profileCompleted =
      fnOk &&
      interestsOk &&
      dob != null &&
      gender.length > 0 &&
      nicheOk;

    if (profileCompleted !== row.profile_completed) {
      await auth.admin
        .from("profiles")
        .update({ profile_completed: profileCompleted })
        .eq("user_id", userId);
      row.profile_completed = profileCompleted;
    }

    return jsonResponse({ success: true, profile: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
