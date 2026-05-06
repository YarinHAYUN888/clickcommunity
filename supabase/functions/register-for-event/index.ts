import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

function generateUniqueCode() {
  return "EVT-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

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

    // Get user from JWT
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { event_id } = await req.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get event
    const { data: event, error: eventError } = await supabase
      .from("events").select("*").eq("id", event_id).single();
    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.status === "past" || event.status === "cancelled") {
      return new Response(JSON.stringify({ error: "Event is not open for registration" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, super_role")
      .eq("user_id", user.id)
      .maybeSingle();
    const role = profile?.super_role ? "admin" : profile?.role;
    if (!["member", "admin"].includes(role || "")) {
      return new Response(JSON.stringify({ error: "Registration is available for members only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check existing registration
    const { data: existing } = await supabase
      .from("event_registrations")
      .select("*").eq("event_id", event_id).eq("user_id", user.id).single();
    if (existing) {
      return new Response(JSON.stringify({ error: "Already registered", status: existing.status, waitlist_position: existing.waitlist_position }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current count
    const { count } = await supabase
      .from("event_registrations")
      .select("*", { count: "exact", head: true })
      .eq("event_id", event_id)
      .in("status", ["registered", "approved"]);

    const currentCount = count || 0;

    let regStatus: string;
    let waitlistPosition: number | null = null;

    if (currentCount >= event.max_capacity) {
      // Add to waitlist
      const { count: waitlistCount } = await supabase
        .from("event_registrations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event_id)
        .eq("status", "waitlist");
      waitlistPosition = (waitlistCount || 0) + 1;
      regStatus = "waitlist";
    } else {
      // Register directly (for now all users register directly; guest/member distinction can be added later)
      regStatus = "registered";
    }

    let insertError: { message: string } | null = null;
    let entryCode: string | null = null;
    for (let i = 0; i < 5; i++) {
      entryCode = generateUniqueCode();
      const { error } = await supabase
        .from("event_registrations")
        .insert({
          event_id,
          user_id: user.id,
          status: regStatus,
          waitlist_position: waitlistPosition,
          entry_code: entryCode,
        });
      if (!error) {
        insertError = null;
        break;
      }
      insertError = { message: error.message };
    }

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      registration_status: regStatus,
      waitlist_position: waitlistPosition,
      entry_code: entryCode,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
