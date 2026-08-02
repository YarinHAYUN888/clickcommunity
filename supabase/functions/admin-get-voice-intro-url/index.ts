import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SIGNED_TTL = 3600;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: { user } } = await createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    }).auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("super_role")
      .eq("user_id", user.id)
      .single();

    if (!adminProfile?.super_role) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const body = await req.json();
    const targetUserId = body?.user_id;

    if (typeof targetUserId !== "string" || !targetUserId.trim()) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: targetProfile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("voice_intro_url")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (profileErr) throw profileErr;

    const objectPath = targetProfile?.voice_intro_url?.trim();
    if (!objectPath) {
      return new Response(JSON.stringify({ error: "No voice intro" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const expectedPrefix = `${targetUserId}/`;
    if (!objectPath.startsWith(expectedPrefix)) {
      return new Response(JSON.stringify({ error: "Invalid voice intro path" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("voice-intros")
      .createSignedUrl(objectPath, SIGNED_TTL);

    if (signErr || !signed?.signedUrl) {
      throw signErr ?? new Error("sign_failed");
    }

    return new Response(
      JSON.stringify({ ok: true, signedUrl: signed.signedUrl, expiresIn: SIGNED_TTL }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
