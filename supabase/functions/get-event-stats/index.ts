import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    ).auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("super_role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.super_role) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const event_id = body.event_id || url.searchParams.get("event_id");
    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: registrations } = await supabaseAdmin
      .from("event_registrations")
      .select("user_id, status")
      .eq("event_id", event_id)
      .in("status", ["registered", "approved"]);

    const total = registrations?.length || 0;
    if (total === 0) {
      return new Response(
        JSON.stringify({ total: 0, femalePercent: 50, malePercent: 50 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userIds = registrations!.map((r) => r.user_id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, gender")
      .in("user_id", userIds);

    const females = profiles?.filter((p) => p.gender === "female").length || 0;
    const males = profiles?.filter((p) => p.gender === "male").length || 0;

    return new Response(
      JSON.stringify({
        total,
        femalePercent: Math.round((females / total) * 100),
        malePercent: Math.round((males / total) * 100),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
