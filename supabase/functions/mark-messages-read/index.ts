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

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = userData.user.id;

    const { chat_id } = await req.json();
    if (!chat_id) {
      return new Response(JSON.stringify({ error: "chat_id required" }), { status: 400, headers: corsHeaders });
    }

    // Verify participant
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

    // Get unread messages
    const { data: unreadMessages } = await supabaseAdmin
      .from("messages")
      .select("id, read_by")
      .eq("chat_id", chat_id)
      .eq("is_deleted", false)
      .neq("sender_id", userId);

    let count = 0;
    if (unreadMessages) {
      for (const msg of unreadMessages) {
        const readBy = msg.read_by || [];
        if (!readBy.includes(userId)) {
          await supabaseAdmin
            .from("messages")
            .update({ read_by: [...readBy, userId] })
            .eq("id", msg.id);
          count++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, messages_marked: count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
