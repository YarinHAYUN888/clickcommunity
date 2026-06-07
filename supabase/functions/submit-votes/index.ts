import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const ALLOWED_VOTES = new Set(["clicked", "no_click"]);

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

    const { data: registration } = await supabase
      .from("event_registrations")
      .select("status")
      .eq("event_id", event_id)
      .eq("user_id", user.id)
      .in("status", ["registered", "approved"])
      .maybeSingle();

    if (!registration) {
      return new Response(JSON.stringify({ error: "You did not attend this event" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: event } = await supabase
      .from("events")
      .select("status, is_past_voting_open")
      .eq("id", event_id)
      .maybeSingle();

    if (!event || event.status !== "past") {
      return new Response(JSON.stringify({ error: "Voting not available for this event" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!event.is_past_voting_open) {
      return new Response(JSON.stringify({ error: "Voting window is closed for this event" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: attendeeRegs } = await supabase
      .from("event_registrations")
      .select("user_id")
      .eq("event_id", event_id)
      .in("status", ["registered", "approved"]);

    const attendeeIds = new Set((attendeeRegs || []).map((r: { user_id: string }) => r.user_id));

    const voteRows: { event_id: string; voter_id: string; votee_id: string; vote: string }[] = [];
    for (const v of votes as { votee_id?: string; vote?: string }[]) {
      const voteeId = typeof v.votee_id === "string" ? v.votee_id.trim() : "";
      const vote = typeof v.vote === "string" ? v.vote.trim() : "";
      if (!voteeId || voteeId === user.id) {
        return new Response(JSON.stringify({ error: "Invalid votee_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!ALLOWED_VOTES.has(vote)) {
        return new Response(JSON.stringify({ error: "Invalid vote value" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!attendeeIds.has(voteeId)) {
        return new Response(JSON.stringify({ error: "Votee was not an attendee" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      voteRows.push({
        event_id,
        voter_id: user.id,
        votee_id: voteeId,
        vote,
      });
    }

    if (voteRows.length === 0) {
      return new Response(JSON.stringify({ error: "No votes to submit" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      votes_submitted: voteRows.length,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
