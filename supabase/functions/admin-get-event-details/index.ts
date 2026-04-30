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

    const { event_id } = await req.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id required" }), { status: 400, headers: corsHeaders });
    }

    const [eventRes, regsRes, votesRes, photosRes] = await Promise.all([
      supabaseAdmin.from("events").select("*").eq("id", event_id).single(),
      supabaseAdmin.from("event_registrations").select("*").eq("event_id", event_id),
      supabaseAdmin.from("event_votes").select("*").eq("event_id", event_id),
      supabaseAdmin.from("event_photos").select("*").eq("event_id", event_id),
    ]);

    const event = eventRes.data;
    const regs = regsRes.data || [];
    const votes = votesRes.data || [];

    // Get profiles for registrations
    const regUserIds = regs.map((r: any) => r.user_id);
    const { data: regProfiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, first_name, photos, gender, role, phone")
      .in("user_id", regUserIds.length ? regUserIds : ["none"]);

    const profileMap: Record<string, any> = {};
    (regProfiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });

    const registrations = regs.map((r: any) => ({
      ...r,
      user: profileMap[r.user_id] || { user_id: r.user_id, first_name: "?" },
    }));

    // Compute stats
    const approved = regs.filter((r: any) => ["registered", "approved"].includes(r.status));
    const females = approved.filter((r: any) => profileMap[r.user_id]?.gender === "female").length;
    const males = approved.filter((r: any) => profileMap[r.user_id]?.gender === "male").length;
    const total = females + males || 1;

    // Compute vote scores
    const voteeIds = [...new Set(votes.map((v: any) => v.votee_id))];
    const { data: voteeProfiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, first_name, photos")
      .in("user_id", voteeIds.length ? voteeIds : ["none"]);
    const voteeMap: Record<string, any> = {};
    (voteeProfiles || []).forEach((p: any) => { voteeMap[p.user_id] = p; });

    const voteScores = voteeIds.map((vid: any) => {
      const pos = votes.filter((v: any) => v.votee_id === vid && v.vote === "clicked").length;
      const neg = votes.filter((v: any) => v.votee_id === vid && v.vote === "no_click").length;
      return {
        votee: voteeMap[vid] || { user_id: vid, first_name: "?" },
        positive: pos,
        negative: neg,
        score: pos - neg,
        passed: (pos - neg) >= 3,
      };
    });

    return new Response(JSON.stringify({
      event,
      registrations,
      stats: {
        total_registered: regs.length,
        total_approved: approved.length,
        total_waitlist: regs.filter((r: any) => r.status === "waitlist").length,
        female_percent: Math.round((females / total) * 100),
        male_percent: Math.round((males / total) * 100),
      },
      votes: voteScores,
      photos: photosRes.data || [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
