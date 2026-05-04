import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ShadowBucket = "normal" | "shadow" | "other";

async function profileShadowBucket(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<ShadowBucket> {
  const { data } = await admin.from("profiles").select("suitability_status, is_shadow").eq("user_id", userId).maybeSingle();
  if (!data) return "other";
  const sh = data.suitability_status === "shadow" && data.is_shadow === true;
  const norm = data.suitability_status === "active" && data.is_shadow !== true;
  if (sh) return "shadow";
  if (norm) return "normal";
  return "other";
}

function bucketsIsolate(a: ShadowBucket, b: ShadowBucket): boolean {
  return (a === "normal" && b === "shadow") || (a === "shadow" && b === "normal");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const adminId = userData.user.id;

    const { data: adminProfile } = await supabaseAdmin.from("profiles").select("super_role").eq("user_id", adminId).single();
    if (!adminProfile?.super_role) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const display_name = typeof body.display_name === "string" ? body.display_name.trim() : "";
    const participant_user_ids = Array.isArray(body.participant_user_ids) ? body.participant_user_ids as string[] : [];

    if (!display_name) {
      return new Response(JSON.stringify({ error: "display_name required" }), { status: 400, headers: corsHeaders });
    }

    const uniqueIds = [...new Set(participant_user_ids.filter((id) => typeof id === "string" && id.length > 0))];
    if (uniqueIds.length < 2) {
      return new Response(JSON.stringify({ error: "Select at least two users" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const buckets: ShadowBucket[] = [];
    for (const uid of uniqueIds) {
      buckets.push(await profileShadowBucket(supabaseAdmin, uid));
    }
    for (let i = 0; i < buckets.length; i++) {
      for (let j = i + 1; j < buckets.length; j++) {
        if (bucketsIsolate(buckets[i], buckets[j])) {
          return new Response(JSON.stringify({ error: "Participants span shadow/normal universes" }), {
            status: 400,
            headers: corsHeaders,
          });
        }
      }
    }

    const { data: newChat, error: chatErr } = await supabaseAdmin
      .from("chats")
      .insert({
        type: "group",
        display_name,
        created_by: adminId,
      })
      .select("id")
      .single();

    if (chatErr || !newChat) {
      console.error("create-group-chat insert chat:", chatErr);
      return new Response(JSON.stringify({ error: chatErr?.message || "Insert failed" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const rows = uniqueIds.map((user_id) => ({
      chat_id: newChat.id,
      user_id,
    }));

    const { error: partErr } = await supabaseAdmin.from("chat_participants").insert(rows);
    if (partErr) {
      console.error("create-group-chat participants:", partErr);
      await supabaseAdmin.from("chats").delete().eq("id", newChat.id);
      return new Response(JSON.stringify({ error: partErr.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, chat_id: newChat.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("create-group-chat:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
