import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { event_id, votes } = await req.json();
    if (!event_id || !votes || !Array.isArray(votes)) {
      return new Response(JSON.stringify({ error: "event_id and votes array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify voter attended the event
    const { data: registration } = await supabase
      .from("event_registrations")
      .select("status")
      .eq("event_id", event_id)
      .eq("user_id", user.id)
      .in("status", ["registered", "approved"])
      .single();

    if (!registration) {
      return new Response(JSON.stringify({ error: "You did not attend this event" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify event is past and within 24h voting window
    const { data: event } = await supabase
      .from("events").select("date, status").eq("id", event_id).single();
    if (!event || event.status !== "past") {
      return new Response(JSON.stringify({ error: "Voting not available for this event" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert votes (upsert to handle re-votes)
    const voteRows = votes.map((v: { votee_id: string; vote: string }) => ({
      event_id,
      voter_id: user.id,
      votee_id: v.votee_id,
      vote: v.vote,
    }));

    const { error: insertError } = await supabase
      .from("event_votes")
      .upsert(voteRows, { onConflict: "event_id,voter_id,votee_id" });

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      votes_submitted: votes.length,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
