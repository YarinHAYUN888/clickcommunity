import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROFILE_SELECT =
  "user_id, first_name, last_name, phone, date_of_birth, points, role, status, suitability_status, moderation_status, last_seen, gender, profile_completed";

type ProfileRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  points: number | null;
  role: string | null;
  status: string | null;
  suitability_status: string;
  moderation_status: string;
  last_seen: string | null;
  gender?: string | null;
  profile_completed?: boolean | null;
};

type SegmentFilters = {
  min_points?: number;
  gender?: string;
  event_id?: string;
  registration_filter?: string;
};

async function enrichWithEmails(
  supabaseAdmin: ReturnType<typeof createClient>,
  profiles: ProfileRow[],
): Promise<Array<ProfileRow & { email: string }>> {
  const out: Array<ProfileRow & { email: string }> = [];
  const batchSize = 20;
  for (let i = 0; i < profiles.length; i += batchSize) {
    const batch = profiles.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (p) => {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(p.user_id);
        const email = !error && data?.user?.email ? data.user.email : "";
        return { ...p, email: email || "" };
      }),
    );
    out.push(...results);
  }
  return out;
}

function dobMonthDay(d: string): { m: number; day: number } {
  const x = new Date(d);
  return { m: x.getUTCMonth() + 1, day: x.getUTCDate() };
}

function escapeIlike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Profiles that are not explicitly suspended (treat null like active). */
function activeProfilesBase(supabaseAdmin: ReturnType<typeof createClient>) {
  return supabaseAdmin.from("profiles").select(PROFILE_SELECT).or("suspended.is.null,suspended.eq.false");
}

/** Build base query for list_segment (before limit execute). */
function baseProfilesQuery(
  supabaseAdmin: ReturnType<typeof createClient>,
  lim: number,
) {
  return activeProfilesBase(supabaseAdmin).limit(lim);
}

async function usersForEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  eventId: string,
  regFilter: string,
  lim: number,
): Promise<ProfileRow[]> {
  const statusMap: Record<string, string> = {
    registered: "registered",
    approved: "approved",
    waitlist: "waitlist",
    cancelled: "cancelled",
    checked_in: "checked_in",
  };
  const st = statusMap[regFilter] || "registered";
  const { data: regs, error } = await supabaseAdmin
    .from("event_registrations")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("status", st);
  if (error) throw error;
  const ids = [...new Set((regs || []).map((r: { user_id: string }) => r.user_id))];
  if (ids.length === 0) return [];
  const { data: profs, error: pe } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_SELECT)
    .in("user_id", ids)
    .limit(lim);
  if (pe) throw pe;
  return (profs || []) as ProfileRow[];
}

async function searchUsers(
  supabaseAdmin: ReturnType<typeof createClient>,
  rawQ: string,
  lim: number,
): Promise<ProfileRow[]> {
  const q = rawQ.trim().slice(0, 120);
  if (!q) return [];
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (uuidRe.test(q)) {
    const { data: one, error } = await activeProfilesBase(supabaseAdmin).eq(
      "user_id",
      q,
    ).maybeSingle();
    if (error) throw error;
    return one ? [one as ProfileRow] : [];
  }

  if (q.includes("@")) {
    const ql = q.toLowerCase();
    const matchedIds: string[] = [];
    const perPage = 1000;
    const maxPages = 15;
    for (let p = 1; p <= maxPages && matchedIds.length < lim; p++) {
      const { data: page, error: luErr } = await supabaseAdmin.auth.admin.listUsers({
        page: p,
        perPage,
      });
      if (luErr) throw luErr;
      const batch = page?.users || [];
      if (batch.length === 0) break;
      for (const u of batch) {
        if (u.email?.toLowerCase().includes(ql)) {
          matchedIds.push(u.id);
          if (matchedIds.length >= lim) break;
        }
      }
      if (batch.length < perPage) break;
    }
    if (matchedIds.length === 0) return [];
    const { data: profs, error: pe } = await activeProfilesBase(supabaseAdmin)
      .in("user_id", matchedIds);
    if (pe) throw pe;
    return (profs || []) as ProfileRow[];
  }

  const pat = `%${escapeIlike(q)}%`;
  const base = () => activeProfilesBase(supabaseAdmin);
  const [r1, r2, r3] = await Promise.all([
    base().ilike("first_name", pat).limit(lim),
    base().ilike("last_name", pat).limit(lim),
    base().ilike("phone", pat).limit(lim),
  ]);
  for (const r of [r1, r2, r3]) {
    if (r.error) throw r.error;
  }
  const map = new Map<string, ProfileRow>();
  for (const r of [r1, r2, r3]) {
    for (const row of (r.data || []) as ProfileRow[]) {
      map.set(row.user_id, row);
    }
  }
  return [...map.values()].slice(0, lim);
}

/** Apply segment_key + filters to a fresh query builder (returns PostgrestFilterBuilder chain). */
function applySegmentChain(
  supabaseAdmin: ReturnType<typeof createClient>,
  segment: string,
  filters: SegmentFilters | undefined,
  lim: number,
):
  | { kind: "query"; chain: ReturnType<typeof baseProfilesQuery> }
  | { kind: "birthday_today"; lim: number }
  | { kind: "event"; eventId: string; regFilter: string; lim: number } {
  const f = filters || {};
  const minPts = typeof f.min_points === "number" && Number.isFinite(f.min_points) ? f.min_points : undefined;

  switch (segment) {
    case "all_users": {
      return { kind: "query", chain: baseProfilesQuery(supabaseAdmin, lim) };
    }
    case "all_members": {
      return { kind: "query", chain: baseProfilesQuery(supabaseAdmin, lim).eq("role", "member") };
    }
    case "guests": {
      return { kind: "query", chain: baseProfilesQuery(supabaseAdmin, lim).eq("role", "guest") };
    }
    case "approved_members": {
      return {
        kind: "query",
        chain: baseProfilesQuery(supabaseAdmin, lim).eq("role", "member").eq("suitability_status", "active").eq(
          "moderation_status",
          "approved",
        ),
      };
    }
    case "pending_users":
    case "onboarding_pending": {
      return {
        kind: "query",
        chain: baseProfilesQuery(supabaseAdmin, lim).or(
          "moderation_status.eq.pending,suitability_status.eq.pending",
        ),
      };
    }
    case "profile_incomplete": {
      return {
        kind: "query",
        chain: baseProfilesQuery(supabaseAdmin, lim).eq("profile_completed", false),
      };
    }
    case "profile_completed_only": {
      return {
        kind: "query",
        chain: baseProfilesQuery(supabaseAdmin, lim).eq("profile_completed", true),
      };
    }
    case "gender_male": {
      return { kind: "query", chain: baseProfilesQuery(supabaseAdmin, lim).eq("gender", "male") };
    }
    case "gender_female": {
      return { kind: "query", chain: baseProfilesQuery(supabaseAdmin, lim).eq("gender", "female") };
    }
    case "points_200": {
      const t = minPts ?? 200;
      return { kind: "query", chain: baseProfilesQuery(supabaseAdmin, lim).gte("points", t) };
    }
    case "points_min": {
      const t = minPts ?? 200;
      return { kind: "query", chain: baseProfilesQuery(supabaseAdmin, lim).gte("points", t) };
    }
    case "inactive_users": {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const iso = cutoff.toISOString();
      return {
        kind: "query",
        chain: baseProfilesQuery(supabaseAdmin, lim).not("last_seen", "is", null).lt("last_seen", iso),
      };
    }
    case "birthday_today":
      return { kind: "birthday_today", lim };
    case "event_participants": {
      const eventId = f.event_id || "";
      if (!eventId) throw new Error("event_id required in segment_filters for event_participants");
      return {
        kind: "event",
        eventId,
        regFilter: f.registration_filter || "registered",
        lim,
      };
    }
    default: {
      return { kind: "query", chain: baseProfilesQuery(supabaseAdmin, lim).eq("role", "member") };
    }
  }
}

async function runListSegment(
  supabaseAdmin: ReturnType<typeof createClient>,
  segment: string,
  filters: SegmentFilters | undefined,
  lim: number,
): Promise<ProfileRow[]> {
  const now = new Date();
  const spec = applySegmentChain(supabaseAdmin, segment, filters, lim);

  if (spec.kind === "event") {
    return await usersForEvent(supabaseAdmin, spec.eventId, spec.regFilter, spec.lim);
  }

  if (spec.kind === "birthday_today") {
    const { data: allDob, error: be } = await activeProfilesBase(supabaseAdmin)
      .not("date_of_birth", "is", null)
      .limit(spec.lim);
    if (be) throw be;
    const filtered = (allDob || []).filter((p: ProfileRow) => {
      if (!p.date_of_birth) return false;
      const { m, day } = dobMonthDay(p.date_of_birth);
      return m === now.getMonth() + 1 && day === now.getDate();
    }) as ProfileRow[];
    return filtered;
  }

  const { data: profs, error: qe } = await spec.chain;
  if (qe) throw qe;
  return (profs || []) as ProfileRow[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userErr } = await createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    }).auth.getUser();

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: adminProfile } = await supabaseAdmin.from("profiles").select("super_role").eq("user_id", user.id).single();
    if (!adminProfile?.super_role) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json().catch(() => null) as {
      action?: string;
      segment?: string;
      segment_filters?: SegmentFilters;
      event_id?: string;
      registration_filter?: string;
      user_ids?: string[];
      limit?: number;
      q?: string;
    };

    const action = body?.action || "list_segment";

    if (action === "search_users") {
      const lim = Math.min(body.limit ?? 25, 30);
      const rawQ = typeof body.q === "string" ? body.q : "";
      const profs = await searchUsers(supabaseAdmin, rawQ, lim);
      const withEmail = await enrichWithEmails(supabaseAdmin, profs);
      return new Response(JSON.stringify({ users: withEmail }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "resolve_users" && body.user_ids?.length) {
      const { data: profs, error } = await supabaseAdmin
        .from("profiles")
        .select(PROFILE_SELECT)
        .in("user_id", body.user_ids.slice(0, 500));
      if (error) throw error;
      const withEmail = await enrichWithEmails(supabaseAdmin, (profs || []) as ProfileRow[]);
      return new Response(JSON.stringify({ users: withEmail }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "event_registrations") {
      const eventId = body.event_id;
      const regFilter = body.registration_filter || "registered";
      if (!eventId) {
        return new Response(JSON.stringify({ error: "event_id required" }), { status: 400, headers: corsHeaders });
      }
      const profs = await usersForEvent(supabaseAdmin, eventId, regFilter, 2000);
      const withEmail = await enrichWithEmails(supabaseAdmin, profs);
      return new Response(JSON.stringify({ users: withEmail }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "birthday_dashboard") {
      const { data: profs, error } = await activeProfilesBase(supabaseAdmin)
        .not("date_of_birth", "is", null);
      if (error) throw error;
      const list = (profs || []) as ProfileRow[];
      const withEmail = await enrichWithEmails(supabaseAdmin, list);

      const now = new Date();
      const todayM = now.getMonth() + 1;
      const todayD = now.getDate();

      const today: typeof withEmail = [];
      const thisWeek: typeof withEmail = [];
      const thisMonth: typeof withEmail = [];
      const byMonth: Record<number, typeof withEmail> = {};

      for (const u of withEmail) {
        if (!u.date_of_birth) continue;
        const { m, day } = dobMonthDay(u.date_of_birth);
        if (m === todayM && day === todayD) today.push(u);
        if (m === todayM) {
          thisMonth.push(u);
          byMonth[m] = byMonth[m] || [];
          byMonth[m].push(u);
        }
        const bdayThisYear = new Date(now.getFullYear(), m - 1, day);
        const diff = (bdayThisYear.getTime() - now.getTime()) / 86400000;
        if (diff >= 0 && diff <= 7) thisWeek.push(u);
      }

      return new Response(
        JSON.stringify({
          today,
          thisWeek,
          thisMonth,
          byMonth,
          all: withEmail,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // list_segment (supports segment_filters)
    const segment = body.segment || "all_members";
    const lim = Math.min(body.limit ?? 500, 2000);
    const filters = body.segment_filters;

    const profRows = await runListSegment(supabaseAdmin, segment, filters, lim);
    const withEmail = await enrichWithEmails(supabaseAdmin, profRows);
    return new Response(JSON.stringify({ users: withEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("automation-recipients:", err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
