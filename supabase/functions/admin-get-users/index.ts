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

    const { data: { user } } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: profile } = await supabaseAdmin.from("profiles").select("super_role").eq("user_id", user.id).single();
    if (!profile?.super_role) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { filter, search, page = 1, limit = 20 } = await req.json();
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("profiles")
      .select(
        "user_id, first_name, phone, role, status, subscription_status, profile_completion, created_at, suspended, avatar_url, photos, gender, points, referral_code, referral_disabled, referral_cap_override",
        { count: "exact" },
      );

    if (filter === "guests") query = query.eq("role", "guest");
    else if (filter === "members") query = query.eq("role", "member");
    else if (filter === "veterans") query = query.eq("status", "veteran");
    else if (filter === "ambassadors") query = query.eq("status", "ambassador");
    else if (filter === "suspended") query = query.eq("suspended", true);

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data: users, count, error } = await query;
    if (error) throw error;

    // Get events_attended for each user
    const userIds = users?.map((u: any) => u.user_id) || [];
    let eventCounts: Record<string, number> = {};
    if (userIds.length > 0) {
      const { data: regs } = await supabaseAdmin
        .from("event_registrations")
        .select("user_id")
        .in("user_id", userIds)
        .in("status", ["registered", "approved"]);
      if (regs) {
        for (const r of regs) {
          eventCounts[r.user_id] = (eventCounts[r.user_id] || 0) + 1;
        }
      }
    }

    const enrichedUsers = (users || []).map((u: any) => ({
      ...u,
      id: u.user_id,
      events_attended: eventCounts[u.user_id] || 0,
    }));

    return new Response(JSON.stringify({
      users: enrichedUsers,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
