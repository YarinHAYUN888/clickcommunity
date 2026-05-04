import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

/** Maps onboarding profile (plus names) → columns for public.profiles. Photos stay client-side (Storage). */
function buildProfilesUpsertRow(
  userId: string,
  firstName: string,
  lastName: string,
  profile: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  if (firstName) row.first_name = firstName;
  const ln = normalizeString(lastName);
  row.last_name = ln.length > 0 ? ln : null;

  if (!profile || typeof profile !== "object") return row;

  const p = profile;
  const phone = normalizeString(p.phone);
  if (phone) row.phone = phone;

  const dob = p.dateOfBirth;
  if (dob && typeof dob === "object" && dob !== null && !Array.isArray(dob)) {
    const d = dob as Record<string, unknown>;
    const day = Number(d.day);
    const month = Number(d.month);
    const year = Number(d.year);
    if (Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year)) {
      row.date_of_birth =
        `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const gender = normalizeString(p.gender);
  if (gender) row.gender = gender;

  const region = normalizeString(p.region);
  if (region) row.region = region;

  if (typeof p.regionOther === "string") {
    row.region_other = p.regionOther.trim() || null;
  }

  const occ = normalizeString(p.occupation);
  if (occ) row.occupation = occ;

  if (typeof p.bio === "string") {
    row.bio = p.bio.trim() || null;
  }

  if (typeof p.instagram === "string") {
    row.instagram = p.instagram.trim() || null;
  }
  if (typeof p.tiktok === "string") {
    row.tiktok = p.tiktok.trim() || null;
  }

  if (Array.isArray(p.interests)) {
    const strings = p.interests.filter((x): x is string => typeof x === "string");
    if (strings.length > 0) row.interests = strings;
  }

  return row;
}

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
    const profilePayload = body?.profile;

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

    // New user only: sync full onboarding row with service role (bypasses RLS). Skip on already_exists to
    // avoid profile takeover when email is not actually being registered in this session.
    if (code === "created" && userId) {
      const row = buildProfilesUpsertRow(userId, firstName, lastName, profilePayload);
      const { error: upsertError } = await supabaseAdmin.from("profiles").upsert(row, {
        onConflict: "user_id",
      });
      if (upsertError) {
        console.error("complete-registration profile upsert:", upsertError);
        await supabaseAdmin.auth.admin.deleteUser(userId).catch((e) =>
          console.error("complete-registration rollback deleteUser:", e)
        );
        return json(
          {
            error: upsertError.message,
            diagnostics: { stage: "profile_upsert", code: upsertError.code },
          },
          500,
        );
      }
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
