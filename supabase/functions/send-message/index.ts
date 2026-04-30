import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { data: claims, error: claimsErr } = await supabaseUser.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;

    const { chat_id, content } = await req.json();
    if (!chat_id || !content?.trim()) {
      return new Response(JSON.stringify({ error: "chat_id and content required" }), { status: 400, headers: corsHeaders });
    }

    // Verify participant
    const { data: participant } = await supabaseAdmin
      .from("chat_participants")
      .select("id")
      .eq("chat_id", chat_id)
      .eq("user_id", userId)
      .eq("removed", false)
      .single();

    if (!participant) {
      return new Response(JSON.stringify({ error: "Not a participant" }), { status: 403, headers: corsHeaders });
    }

    // Verify chat is open
    const { data: chat } = await supabaseAdmin
      .from("chats")
      .select("is_closed, expires_at")
      .eq("id", chat_id)
      .single();

    if (!chat || chat.is_closed || (chat.expires_at && new Date(chat.expires_at) < new Date())) {
      return new Response(JSON.stringify({ error: "Chat is closed or expired" }), { status: 403, headers: corsHeaders });
    }

    // For DMs, check if blocked
    const { data: chatInfo } = await supabaseAdmin
      .from("chats")
      .select("type")
      .eq("id", chat_id)
      .single();

    if (chatInfo?.type === "direct") {
      const { data: otherParticipant } = await supabaseAdmin
        .from("chat_participants")
        .select("user_id")
        .eq("chat_id", chat_id)
        .neq("user_id", userId)
        .single();

      if (otherParticipant) {
        const { data: blocked } = await supabaseAdmin
          .from("blocked_users")
          .select("id")
          .or(`and(blocker_id.eq.${userId},blocked_id.eq.${otherParticipant.user_id}),and(blocker_id.eq.${otherParticipant.user_id},blocked_id.eq.${userId})`)
          .limit(1);

        if (blocked && blocked.length > 0) {
          return new Response(JSON.stringify({ error: "Blocked" }), { status: 403, headers: corsHeaders });
        }
      }
    }

    // Insert message
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

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ success: true, message_id: message.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
