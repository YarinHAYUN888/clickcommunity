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
    const userId = userData.user.id;

    const { chat_id, content } = await req.json();
    if (!chat_id || !content?.trim()) {
      return new Response(JSON.stringify({ error: "chat_id and content required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: participant } = await supabaseAdmin
      .from("chat_participants")
      .select("id")
      .eq("chat_id", chat_id)
      .eq("user_id", userId)
      .eq("removed", false)
      .maybeSingle();

    if (!participant) {
      return new Response(JSON.stringify({ error: "Not a participant" }), { status: 403, headers: corsHeaders });
    }

    const { data: chat } = await supabaseAdmin
      .from("chats")
      .select("is_closed, expires_at")
      .eq("id", chat_id)
      .single();

    if (!chat || chat.is_closed || (chat.expires_at && new Date(chat.expires_at) < new Date())) {
      return new Response(JSON.stringify({ error: "Chat is closed or expired" }), { status: 403, headers: corsHeaders });
    }

    const { data: chatInfo } = await supabaseAdmin.from("chats").select("type").eq("id", chat_id).single();

    if (chatInfo?.type === "direct") {
      const { data: otherParticipant } = await supabaseAdmin
        .from("chat_participants")
        .select("user_id")
        .eq("chat_id", chat_id)
        .neq("user_id", userId)
        .maybeSingle();

      if (otherParticipant) {
        const { data: blocked } = await supabaseAdmin
          .from("blocked_users")
          .select("id")
          .or(
            `and(blocker_id.eq.${userId},blocked_id.eq.${otherParticipant.user_id}),and(blocker_id.eq.${otherParticipant.user_id},blocked_id.eq.${userId})`,
          )
          .limit(1);

        if (blocked && blocked.length > 0) {
          return new Response(JSON.stringify({ error: "Blocked" }), { status: 403, headers: corsHeaders });
        }
      }
    }

    const senderBucket = await profileShadowBucket(supabaseAdmin, userId);
    const { data: peers } = await supabaseAdmin
      .from("chat_participants")
      .select("user_id")
      .eq("chat_id", chat_id)
      .eq("removed", false)
      .neq("user_id", userId);

    for (const p of peers || []) {
      const b = await profileShadowBucket(supabaseAdmin, p.user_id as string);
      if (bucketsIsolate(senderBucket, b)) {
        return new Response(JSON.stringify({ error: "Shadow isolation: cannot message this universe" }), {
          status: 403,
          headers: corsHeaders,
        });
      }
    }

    const { data: message, error: insertErr } = await supabaseAdmin
      .from("messages")
      .insert({
        chat_id,
        sender_id: userId,
        content: content.trim(),
        read_by: [userId],
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("send-message insert:", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, message_id: message?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-message:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
