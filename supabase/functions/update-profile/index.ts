import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user_id, first_name, occupation, bio, photos, interests } = await req.json();
    if (!user_id) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const updates: Record<string, unknown> = {};

    if (first_name !== undefined) {
      if (typeof first_name !== "string" || first_name.length < 2)
        return new Response(JSON.stringify({ error: "first_name must be >= 2 chars" }), { status: 400, headers: corsHeaders });
      updates.first_name = first_name;
    }
    if (occupation !== undefined) updates.occupation = occupation;
    if (bio !== undefined) {
      if (typeof bio === "string" && bio.length > 300)
        return new Response(JSON.stringify({ error: "bio max 300 chars" }), { status: 400, headers: corsHeaders });
      updates.bio = bio;
    }
    if (photos !== undefined) updates.photos = photos;
    if (interests !== undefined) {
      if (Array.isArray(interests) && interests.length > 0 && interests.length < 5)
        return new Response(JSON.stringify({ error: "interests must be >= 5 if provided" }), { status: 400, headers: corsHeaders });
      updates.interests = interests;
    }

    if (Object.keys(updates).length === 0)
      return new Response(JSON.stringify({ error: "no fields to update" }), { status: 400, headers: corsHeaders });

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", user_id)
      .select("*")
      .single();

    if (error) throw error;

    const row = data as Record<string, unknown>;
    const photosList = Array.isArray(row.photos) ? (row.photos as unknown[]) : [];
    const hasPhoto =
      photosList.some((u) => typeof u === "string" && u.trim().length > 0) ||
      (typeof row.avatar_url === "string" && row.avatar_url.trim().length > 0);
    const fn = typeof row.first_name === "string" ? row.first_name.trim() : "";
    const fnOk = fn.length >= 2;
    const interestsList = Array.isArray(row.interests) ? (row.interests as unknown[]) : [];
    const interestsOk = interestsList.length === 0 || interestsList.length >= 5;

    let finalData = data;
    if (hasPhoto && fnOk && interestsOk) {
      const { data: data2, error: flagsErr } = await supabase
        .from("profiles")
        .update({
          profile_completed: true,
          image_upload_status: "success",
        })
        .eq("user_id", user_id)
        .select("*")
        .single();
      if (!flagsErr && data2) finalData = data2;
    }

    return new Response(
      JSON.stringify({ success: true, user: finalData, profile_completion: finalData.profile_completion }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
