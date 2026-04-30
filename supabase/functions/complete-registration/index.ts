import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const normalizeString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    const email = normalizeString(body?.email).toLowerCase();
    const password = typeof body?.password === "string" ? body.password : "";
    const firstName = normalizeString(body?.firstName);
    const lastName = normalizeString(body?.lastName);
    const referralCode = normalizeString(body?.referralCode);

    if (!email || !password) {
      return json({ error: "email and password required", diagnostics: { stage: "validation" } }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let code: "created" | "already_exists" = "created";
    let userId: string | null = null;

    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName || null,
        last_name: lastName || null,
        ...(referralCode ? { pending_referral_code: referralCode } : {}),
      },
    });

    if (createError) {
      const message = createError.message?.toLowerCase() ?? "";
      if (!message.includes("already") && !message.includes("exists") && !message.includes("registered")) {
        return json({ error: createError.message, diagnostics: { stage: "create_user" } }, 400);
      }
      code = "already_exists";
    } else {
      userId = createdUser.user?.id ?? null;
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkError) {
      return json({ error: linkError.message, diagnostics: { stage: "generate_link" } }, 400);
    }

    const tokenHash = linkData.properties?.hashed_token ?? null;

    if (!tokenHash) {
      return json({ error: "Failed to generate auth token", diagnostics: { stage: "missing_token_hash" } }, 500);
    }

    return json({
      success: true,
      code,
      userId,
      tokenHash,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message, diagnostics: { stage: "unexpected" } }, 500);
  }
});
