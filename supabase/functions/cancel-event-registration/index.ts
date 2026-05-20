import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CANCEL_LOCK_HOURS = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const jwt = authHeader.replace("Bearer ", "").trim();
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { event_id } = await req.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, date, time, status")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.status === "past" || event.status === "cancelled") {
      return new Response(JSON.stringify({ error: "Event is not open for changes" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventStart = new Date(`${event.date}T${event.time}`);
    const lockAt = eventStart.getTime() - CANCEL_LOCK_HOURS * 60 * 60 * 1000;
    if (Date.now() >= lockAt) {
      return new Response(
        JSON.stringify({
          error: "cancellation_locked",
          message: "לא ניתן לבטל הרשמה פחות מ-5 שעות לפני תחילת האירוע",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: registration, error: regError } = await supabase
      .from("event_registrations")
      .select("id, status")
      .eq("event_id", event_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (regError || !registration) {
      return new Response(JSON.stringify({ error: "Registration not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["registered", "approved", "waitlist"].includes(registration.status)) {
      return new Response(JSON.stringify({ error: "Registration cannot be cancelled" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabase
      .from("event_registrations")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", registration.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
