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

function isLikeAction(a: string): boolean {
  return a === "like" || a === "super_like";
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

    const body = await req.json().catch(() => null) as { to_user_id?: string; action?: string } | null;
    const toUserId = typeof body?.to_user_id === "string" ? body.to_user_id.trim() : "";
    const action = typeof body?.action === "string" ? body.action.trim() : "";
    if (!toUserId || !/^[0-9a-f-]{36}$/i.test(toUserId)) {
      return new Response(JSON.stringify({ error: "to_user_id required" }), { status: 400, headers: corsHeaders });
    }
    if (toUserId === userId) {
      return new Response(JSON.stringify({ error: "cannot_swipe_self" }), { status: 400, headers: corsHeaders });
    }
    if (!["like", "pass", "super_like"].includes(action)) {
      return new Response(JSON.stringify({ error: "invalid_action" }), { status: 400, headers: corsHeaders });
    }

    const { data: meProf, error: meErr } = await supabaseAdmin
      .from("profiles")
      .select("moderation_status, suitability_status, is_shadow, suspended, super_role")
      .eq("user_id", userId)
      .maybeSingle();
    if (meErr || !meProf) {
      return new Response(JSON.stringify({ error: "profile_not_found" }), { status: 400, headers: corsHeaders });
    }
    if (meProf.suspended === true) {
      return new Response(JSON.stringify({ error: "suspended" }), { status: 403, headers: corsHeaders });
    }
    if (meProf.moderation_status !== "approved" && !meProf.super_role) {
      return new Response(JSON.stringify({ error: "not_approved" }), { status: 403, headers: corsHeaders });
    }

    const { data: themProf, error: themErr } = await supabaseAdmin
      .from("profiles")
      .select("moderation_status, suitability_status, is_shadow, suspended, role")
      .eq("user_id", toUserId)
      .maybeSingle();
    if (themErr || !themProf) {
      return new Response(JSON.stringify({ error: "target_not_found" }), { status: 404, headers: corsHeaders });
    }
    if (themProf.suspended === true || themProf.moderation_status !== "approved") {
      return new Response(JSON.stringify({ error: "target_unavailable" }), { status: 403, headers: corsHeaders });
    }

    const ab = await profileShadowBucket(supabaseAdmin, userId);
    const bb = await profileShadowBucket(supabaseAdmin, toUserId);
    if (bucketsIsolate(ab, bb)) {
      return new Response(JSON.stringify({ error: "Shadow isolation: cannot interact across universes" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const now = new Date().toISOString();
    const { error: upsertErr } = await supabaseAdmin.from("profile_swipes").upsert(
      {
        from_user_id: userId,
        to_user_id: toUserId,
        action,
        updated_at: now,
      },
      { onConflict: "from_user_id,to_user_id" },
    );
    if (upsertErr) {
      console.error("profile_swipes upsert:", upsertErr);
      return new Response(JSON.stringify({ error: upsertErr.message }), { status: 500, headers: corsHeaders });
    }

    let mutual = false;
    let chat_id: string | null = null;

    if (isLikeAction(action)) {
      const { data: rev } = await supabaseAdmin
        .from("profile_swipes")
        .select("action")
        .eq("from_user_id", toUserId)
        .eq("to_user_id", userId)
        .maybeSingle();
      if (rev && isLikeAction(rev.action)) {
        mutual = true;
        // Reuse same DM resolution as create-or-get-dm (duplicated intentionally to avoid changing that function).
        const { data: existingChats } = await supabaseAdmin
          .from("chat_participants")
          .select("chat_id")
          .eq("user_id", userId);
        let existingChatId: string | null = null;
        if (existingChats && existingChats.length > 0) {
          const chatIds = existingChats.map((c: { chat_id: string }) => c.chat_id);
          const { data: otherParticipations } = await supabaseAdmin
            .from("chat_participants")
            .select("chat_id")
            .eq("user_id", toUserId)
            .in("chat_id", chatIds);
          if (otherParticipations && otherParticipations.length > 0) {
            for (const p of otherParticipations) {
              const { data: chatData } = await supabaseAdmin
                .from("chats")
                .select("id, type")
                .eq("id", p.chat_id)
                .eq("type", "direct")
                .single();
              if (chatData) {
                existingChatId = chatData.id;
                break;
              }
            }
          }
        }
        if (existingChatId) {
          chat_id = existingChatId;
        } else {
          const { data: newChat, error: chatErr } = await supabaseAdmin
            .from("chats")
            .insert({ type: "direct" })
            .select("id")
            .single();
          if (chatErr) throw chatErr;
          await supabaseAdmin.from("chat_participants").insert([
            { chat_id: newChat.id, user_id: userId },
            { chat_id: newChat.id, user_id: toUserId },
          ]);
          chat_id = newChat.id;
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, mutual, chat_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("record-profile-swipe:", err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
