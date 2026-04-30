import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user_id } = await req.json();
    if (!user_id) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check attendance
    const { count } = await supabase
      .from("event_registrations")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user_id)
      .in("status", ["registered", "approved"]);

    const attendedEvent = (count ?? 0) > 0;

    // Vote score
    const { data: voteScore } = await supabase.rpc("get_user_vote_score", { p_user_id: user_id });
    const score = voteScore ?? 0;

    if (!attendedEvent) {
      return new Response(JSON.stringify({
        eligible: false, attended_event: false, vote_score: score, reason: "must_attend_event"
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (score < 3) {
      return new Response(JSON.stringify({
        eligible: false, attended_event: true, vote_score: score, reason: "insufficient_votes"
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      eligible: true, attended_event: true, vote_score: score, reason: null
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
