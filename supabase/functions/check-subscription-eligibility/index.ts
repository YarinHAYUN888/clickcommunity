import {
  assertSelfUserId,
  jsonResponse,
  optionsOk,
  requireAuthUser,
} from "../_shared/edgeAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsOk();

  const auth = await requireAuthUser(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const forbidden = assertSelfUserId(auth.user.id, body.user_id);
    if (forbidden) return forbidden;

    const userId = auth.user.id;
    const supabase = auth.admin;

    const { count } = await supabase
      .from("event_registrations")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["registered", "approved"]);

    const attendedEvent = (count ?? 0) > 0;

    const { data: voteScoreData } = await supabase.rpc("get_user_vote_score", {
      p_user_id: userId,
    });
    const score = voteScoreData ?? 0;

    if (!attendedEvent) {
      return jsonResponse({
        eligible: false,
        attended_event: false,
        vote_score: score,
        reason: "must_attend_event",
      });
    }

    if (score < 3) {
      return jsonResponse({
        eligible: false,
        attended_event: true,
        vote_score: score,
        reason: "insufficient_votes",
      });
    }

    return jsonResponse({
      eligible: true,
      attended_event: true,
      vote_score: score,
      reason: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
