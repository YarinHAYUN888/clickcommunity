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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = userData.user.id;

    const { other_user_id, icebreaker_text } = await req.json();
    if (!other_user_id) {
      return new Response(JSON.stringify({ error: "other_user_id required" }), { status: 400, headers: corsHeaders });
    }

    // Check if DM already exists between these two users
    const { data: existingChats } = await supabaseAdmin
      .from("chat_participants")
      .select("chat_id")
      .eq("user_id", userId);

    let existingChatId: string | null = null;

    if (existingChats && existingChats.length > 0) {
      const chatIds = existingChats.map((c) => c.chat_id);
      const { data: otherParticipations } = await supabaseAdmin
        .from("chat_participants")
        .select("chat_id")
        .eq("user_id", other_user_id)
        .in("chat_id", chatIds);

      if (otherParticipations && otherParticipations.length > 0) {
        // Verify it's a direct chat
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
      return new Response(JSON.stringify({ chat_id: existingChatId, is_new: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ab = await profileShadowBucket(supabaseAdmin, userId);
    const bb = await profileShadowBucket(supabaseAdmin, other_user_id);
    if (bucketsIsolate(ab, bb)) {
      return new Response(JSON.stringify({ error: "Shadow isolation: cannot start DM across universes" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Create new DM
    const { data: newChat, error: chatErr } = await supabaseAdmin
      .from("chats")
      .insert({ type: "direct" })
      .select("id")
      .single();

    if (chatErr) throw chatErr;

    // Add both participants
    await supabaseAdmin
      .from("chat_participants")
      .insert([
        { chat_id: newChat.id, user_id: userId },
        { chat_id: newChat.id, user_id: other_user_id },
      ]);

    let firstMessageId: string | null = null;

    // Send icebreaker if provided
    if (icebreaker_text?.trim()) {
      const { data: msg } = await supabaseAdmin
        .from("messages")
        .insert({
          chat_id: newChat.id,
          sender_id: userId,
          content: icebreaker_text.trim(),
          read_by: [userId],
        })
        .select("id")
        .single();
      firstMessageId = msg?.id || null;
    }

    return new Response(
      JSON.stringify({ chat_id: newChat.id, is_new: true, first_message_id: firstMessageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
