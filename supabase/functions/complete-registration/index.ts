import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { normalizeIdentifier } from "../_shared/otpCrypto.ts";
import { getRequestMeta } from "../_shared/requestMeta.ts";
import { checkRateLimit } from "../_shared/securityRateLimit.ts";
import { writeSecurityAudit } from "../_shared/securityAudit.ts";
import { getDefaultNewUserRole, type NewUserRole } from "../_shared/defaultNewUserRole.ts";

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
  defaultRole: "guest" | "member",
  firstName: string,
  lastName: string,
  profile: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
    profile_completed: false,
    image_upload_status: "pending",
    role: defaultRole,
    moderation_status: "pending",
    suitability_status: "pending",
    is_shadow: false,
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

  const niche = normalizeString(p.lifeNiche);
  const allowedNiche = new Set([
    "post_big_trip",
    "student",
    "first_job",
    "soldier_active_service",
    "discharged",
    "business_world",
  ]);
  if (niche && allowedNiche.has(niche)) row.life_niche = niche;

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

async function findUserIdByEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
): Promise<string | null> {
  const target = email.toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 5; page++) {
    const { data: listed, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      console.error("complete-registration listUsers:", error);
      return null;
    }
    const users = listed?.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit?.id) return hit.id;
    if (users.length < perPage) break;
  }
  return null;
}

async function applyDefaultRoleToProfile(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  defaultRole: NewUserRole,
): Promise<void> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, subscription_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile) return;
  if (profile.subscription_status === "active") return;
  if (profile.role === defaultRole) return;
  if (profile.role === "member" && defaultRole === "guest") return;

  if (!profile.role || profile.role === "guest") {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ role: defaultRole, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) {
      console.error("[complete-registration] role patch failed", error.message);
      return;
    }
    console.log("ROLE ASSIGNED", { userId, role: defaultRole });
    console.log("USER CREATED WITH ROLE", { userId, role: defaultRole });
  }
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

    const verificationToken = normalizeString(body?.verification_token);
    const rawPhone = normalizeString(body?.profile?.phone).replace(/[-\s]/g, "").replace(/^0/, "");
    const phoneE164 = /^5\d{8}$/.test(rawPhone) ? `+972${rawPhone}` : undefined;
    const identifier =
      normalizeIdentifier(email, phoneE164, "email") ?? `email:${email}`;

    if (!verificationToken) {
      return json({ error: "verification_token required", diagnostics: { stage: "otp" } }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const defaultNewUserRole = await getDefaultNewUserRole(supabaseAdmin);

    const meta = await getRequestMeta(req);
    const rateKey = `${email}:${meta.ipHash ?? "no-ip"}`;
    const rate = await checkRateLimit(supabaseAdmin, {
      action: "complete_registration",
      key: rateKey,
      maxCount: 10,
      windowMs: 60 * 60 * 1000,
      blockMs: 30 * 60 * 1000,
    });
    if (!rate.allowed) {
      await writeSecurityAudit(supabaseAdmin, {
        action: "complete_registration_rate_limited",
        severity: "warn",
        meta,
        metadata: { email_domain: email.split("@")[1] ?? "" },
      });
      return json({ error: "rate_limited", diagnostics: { stage: "rate_limit" } }, 429);
    }

    const { data: otpRow, error: otpErr } = await supabaseAdmin
      .from("onboarding_otp_challenges")
      .select("id, identifier, verification_token, verified_at, expires_at")
      .eq("verification_token", verificationToken)
      .eq("identifier", identifier)
      .not("verified_at", "is", null)
      .maybeSingle();

    if (otpErr || !otpRow) {
      return json({ error: "otp_not_verified", diagnostics: { stage: "otp" } }, 401);
    }

    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      return json({ error: "otp_expired", diagnostics: { stage: "otp" } }, 401);
    }

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
      userId = await findUserIdByEmail(supabaseAdmin, email);
    } else {
      userId = createdUser.user?.id ?? null;
    }

    // New user only: sync full onboarding row with service role (bypasses RLS). Skip on already_exists to
    // avoid profile takeover when email is not actually being registered in this session.
    if (code === "created" && userId) {
      const row = buildProfilesUpsertRow(
        userId,
        defaultNewUserRole,
        firstName,
        lastName,
        profilePayload,
      );
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
      console.log("USER CREATED WITH ROLE", { userId, role: defaultNewUserRole });
    } else if (code === "already_exists" && userId) {
      await applyDefaultRoleToProfile(supabaseAdmin, userId, defaultNewUserRole);
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

    await writeSecurityAudit(supabaseAdmin, {
      action: code === "created" ? "registration_created" : "registration_existing_login",
      severity: "info",
      userId: userId ?? undefined,
      meta,
      metadata: { code },
    });

    return json({
      success: true,
      code,
      userId,
      tokenHash,
      defaultRole: defaultNewUserRole,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message, diagnostics: { stage: "unexpected" } }, 500);
  }
});
