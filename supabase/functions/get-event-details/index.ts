import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const event_id = url.searchParams.get("event_id");
    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user if authenticated
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!);
      const { data: { user } } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id || null;
    }

    // Get event
    const { data: event, error: eventError } = await supabase
      .from("events").select("*").eq("id", event_id).single();
    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get registration stats
    const { data: registrations } = await supabase
      .from("event_registrations")
      .select("user_id, status")
      .eq("event_id", event_id)
      .in("status", ["registered"]);
    const total = registrations?.length || 0;

    // Get gender breakdown from profiles
    let femalePercent = 50, malePercent = 50;
    if (registrations && registrations.length > 0) {
      const userIds = registrations.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles").select("user_id, gender").in("user_id", userIds);
      if (profiles) {
        const females = profiles.filter(p => p.gender === "female").length;
        const males = profiles.filter(p => p.gender === "male").length;
        femalePercent = total > 0 ? Math.round((females / total) * 100) : 50;
        malePercent = total > 0 ? Math.round((males / total) * 100) : 50;
      }
    }

    // User's registration
    let userRegistration = null;
    if (userId) {
      const { data: reg } = await supabase
        .from("event_registrations")
        .select("*").eq("event_id", event_id).eq("user_id", userId).single();
      userRegistration = reg;
    }

    // Attendee profiles (service role bypasses RLS)
    let attendees: any[] = [];
    if (registrations && registrations.length > 0) {
      const userIds = registrations.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, photos, gender, avatar_url")
        .in("user_id", userIds);
      attendees = profiles || [];
    }

    // Get host profile
    let host = null;
    if (event.host_id) {
      const { data: hostProfile } = await supabase
        .from("profiles").select("user_id, first_name, photos, avatar_url")
        .eq("user_id", event.host_id).single();
      host = hostProfile;
    }

    // Get photos
    const { data: photos } = await supabase
      .from("event_photos").select("*").eq("event_id", event_id)
      .order("created_at", { ascending: false });

    return new Response(JSON.stringify({
      event,
      stats: { total, femalePercent, malePercent },
      userRegistration,
      attendees,
      host,
      photos: photos || [],
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
