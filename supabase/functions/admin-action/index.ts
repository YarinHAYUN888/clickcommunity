import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyProfileRole, type DbProfileRole } from "../_shared/verifyProfileRole.ts";

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

    // Get caller identity
    const { data: { user }, error: userErr } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Verify super_role
    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("super_role")
      .eq("user_id", user.id)
      .single();

    if (!adminProfile?.super_role) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }
    const isSuperAdmin = adminProfile.super_role === "super_admin";

    const { action, target_type, target_id, details } = await req.json();
    if (!action) {
      return new Response(JSON.stringify({ error: "action required" }), { status: 400, headers: corsHeaders });
    }

    // Log the action
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: user.id,
      action,
      target_type: target_type || "system",
      target_id: target_id || null,
      details: details || {},
    });

    const respond = (data: any) =>
      new Response(JSON.stringify({ success: true, action, ...data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const respondErr = (msg: string, status = 400) =>
      new Response(JSON.stringify({ success: false, error: msg }), { status, headers: corsHeaders });
    const assertNoDbError = (error: { message?: string } | null, fallback: string) => {
      if (error) {
        throw new Error(error.message || fallback);
      }
    };
    const sanitizeEventDetails = (raw: Record<string, unknown>) => {
      const allowed = [
        "name",
        "description",
        "cover_image_url",
        "date",
        "time",
        "location_name",
        "location_address",
        "location_url",
        "max_capacity",
        "reserved_new_spots",
        "gender_balance_target",
        "requires_subscription",
        "status",
        "is_past_voting_open",
        "host_id",
      ] as const;
      const next: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in raw) next[key] = raw[key];
      }
      if ("requires_subscription" in next) {
        next.requires_subscription = next.requires_subscription === true;
      }
      if ("is_past_voting_open" in next) {
        next.is_past_voting_open = next.is_past_voting_open === true;
      }
      if ("status" in next && typeof next.status === "string") {
        const s = next.status.trim();
        if (!["open", "almost_full", "full", "past", "cancelled", "pending_review", "rejected"].includes(s)) {
          delete next.status;
        }
      }
      return next;
    };

    switch (action) {
      case "get_system_setting": {
        if (!isSuperAdmin) return respondErr("Forbidden", 403);
        const key = typeof details?.key === "string" ? details.key.trim() : "";
        if (!key) return respondErr("details.key required");
        const { data: setting, error } = await supabaseAdmin
          .from("system_settings")
          .select("key, value, updated_at, updated_by")
          .eq("key", key)
          .maybeSingle();
        if (error) return respondErr(error.message, 500);
        return respond({ setting: setting ?? null });
      }
      case "set_system_setting": {
        if (!isSuperAdmin) return respondErr("Forbidden", 403);
        const key = typeof details?.key === "string" ? details.key.trim() : "";
        const value = typeof details?.value === "string" ? details.value.trim() : "";
        if (!key || !value) return respondErr("details.key and details.value required");
        if (key !== "default_new_user_role") return respondErr("unsupported setting key");
        if (!["guest", "member"].includes(value)) return respondErr("invalid setting value");
        const { data: setting, error } = await supabaseAdmin
          .from("system_settings")
          .upsert(
            {
              key,
              value,
              updated_at: new Date().toISOString(),
              updated_by: user.id,
            },
            { onConflict: "key" },
          )
          .select("key, value, updated_at, updated_by")
          .single();
        if (error) return respondErr(error.message, 500);
        return respond({ setting });
      }
      // ---- User Management ----
      case "update_user_role": {
        if (!target_id) return respondErr("target_id required");
        const rawRole = typeof details?.new_role === "string" ? details.new_role.trim().toLowerCase() : "";
        let role = rawRole;
        if (role === "community_member") role = "member";
        if (!["guest", "member"].includes(role)) {
          return respondErr("invalid role; use guest or member", 400);
        }
        const expectedRole = role as DbProfileRole;
        const { error: roleErr } = await supabaseAdmin
          .from("profiles")
          .update({ role: expectedRole, updated_at: new Date().toISOString() })
          .eq("user_id", target_id);
        if (roleErr) {
          console.error("ADMIN ROLE UPDATE FAILED", { target_id, role: expectedRole, message: roleErr.message });
          return respondErr(roleErr.message, 500);
        }
        const verified = await verifyProfileRole(supabaseAdmin, target_id, expectedRole);
        if (!verified.ok) {
          return respondErr(verified.message, 500);
        }
        console.log("ADMIN ROLE UPDATE", { target_id, role: expectedRole });
        return respond({ updated: "role", role: verified.role });
      }
      case "update_user_status": {
        await supabaseAdmin.from("profiles").update({ status: details.new_status }).eq("user_id", target_id);
        return respond({ updated: "status" });
      }
      case "update_user_profile": {
        if (!target_id) return respondErr("target_id required");
        const updates: Record<string, unknown> = {};
        if (details && "last_name" in details) {
          const ln = typeof details.last_name === "string" ? details.last_name.trim() : "";
          updates.last_name = ln.length > 0 ? ln : null;
        }
        if (details && "first_name" in details) {
          const fn = typeof details.first_name === "string" ? details.first_name.trim() : "";
          if (fn.length > 0) updates.first_name = fn;
        }
        if (Object.keys(updates).length === 0) return respondErr("no profile fields to update");
        updates.updated_at = new Date().toISOString();
        const { error: profileErr } = await supabaseAdmin
          .from("profiles")
          .update(updates)
          .eq("user_id", target_id);
        if (profileErr) return respondErr(profileErr.message, 500);
        return respond({ updated: "profile" });
      }
      case "suspend_user": {
        await supabaseAdmin.from("profiles").update({
          suspended: true, suspended_at: new Date().toISOString(), suspended_by: user.id
        }).eq("user_id", target_id);
        return respond({});
      }
      case "unsuspend_user": {
        await supabaseAdmin.from("profiles").update({
          suspended: false, suspended_at: null, suspended_by: null
        }).eq("user_id", target_id);
        return respond({});
      }
      case "remove_user":
      case "delete_user": {
        if (!target_id) return respondErr("target_id required");
        if (target_id === user.id) return respondErr("cannot remove current admin user", 400);

        // Best-effort cleanup of user-linked rows before Auth deletion.
        const { error: regsErr } = await supabaseAdmin.from("event_registrations").delete().eq("user_id", target_id);
        assertNoDbError(regsErr, "Failed to delete event registrations");
        const { error: votesAsVoterErr } = await supabaseAdmin.from("event_votes").delete().eq("voter_id", target_id);
        assertNoDbError(votesAsVoterErr, "Failed to delete user votes");
        const { error: votesAsVoteeErr } = await supabaseAdmin.from("event_votes").delete().eq("votee_id", target_id);
        assertNoDbError(votesAsVoteeErr, "Failed to delete votes for user");
        const { error: pointsErr } = await supabaseAdmin.from("points_history").delete().eq("user_id", target_id);
        assertNoDbError(pointsErr, "Failed to delete points history");
        const { error: subsErr } = await supabaseAdmin.from("subscriptions").delete().eq("user_id", target_id);
        assertNoDbError(subsErr, "Failed to delete subscriptions");
        const { error: referralsByErr } = await supabaseAdmin.from("referrals").delete().eq("referrer_id", target_id);
        assertNoDbError(referralsByErr, "Failed to delete referrals by user");
        const { error: referralsToErr } = await supabaseAdmin.from("referrals").delete().eq("referred_user_id", target_id);
        assertNoDbError(referralsToErr, "Failed to delete referrals to user");
        const { error: participantsErr } = await supabaseAdmin.from("chat_participants").delete().eq("user_id", target_id);
        assertNoDbError(participantsErr, "Failed to delete chat participants");

        const { error: deleteAuthErr } = await supabaseAdmin.auth.admin.deleteUser(target_id);
        if (deleteAuthErr) return respondErr(deleteAuthErr.message || "Failed to remove auth user", 500);

        return respond({});
      }
      case "grant_free_subscription": {
        if (!target_id) return respondErr("target_id required");
        await supabaseAdmin.from("subscriptions").upsert({
          user_id: target_id, status: "active", plan: "monthly", amount: 0, currency: "ILS",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
        }, { onConflict: "user_id" });
        const { error: grantErr } = await supabaseAdmin
          .from("profiles")
          .update({ role: "member", subscription_status: "active", updated_at: new Date().toISOString() })
          .eq("user_id", target_id);
        if (grantErr) return respondErr(grantErr.message, 500);
        const grantVerified = await verifyProfileRole(supabaseAdmin, target_id, "member");
        if (!grantVerified.ok) return respondErr(grantVerified.message, 500);
        return respond({ role: grantVerified.role });
      }
      case "revoke_free_subscription": {
        if (!target_id) return respondErr("target_id required");
        await supabaseAdmin.from("subscriptions").delete().eq("user_id", target_id).eq("amount", 0);
        const { data: remaining } = await supabaseAdmin.from("subscriptions").select("id").eq("user_id", target_id).eq("status", "active");
        if (!remaining?.length) {
          const { error: revokeErr } = await supabaseAdmin
            .from("profiles")
            .update({ role: "guest", subscription_status: "none", updated_at: new Date().toISOString() })
            .eq("user_id", target_id);
          if (revokeErr) return respondErr(revokeErr.message, 500);
          const revokeVerified = await verifyProfileRole(supabaseAdmin, target_id, "guest");
          if (!revokeVerified.ok) return respondErr(revokeVerified.message, 500);
          return respond({ role: revokeVerified.role });
        }
        return respond({});
      }
      case "force_approve_member": {
        if (!target_id) return respondErr("target_id required");
        const { error: approveErr } = await supabaseAdmin
          .from("profiles")
          .update({ role: "member", subscription_status: "active", updated_at: new Date().toISOString() })
          .eq("user_id", target_id);
        if (approveErr) return respondErr(approveErr.message, 500);
        const approveVerified = await verifyProfileRole(supabaseAdmin, target_id, "member");
        if (!approveVerified.ok) return respondErr(approveVerified.message, 500);
        return respond({ role: approveVerified.role });
      }

      // ---- Event Management ----
      case "create_event": {
        const safeDetails = sanitizeEventDetails((details || {}) as Record<string, unknown>);
        const { data: ev, error } = await supabaseAdmin.from("events").insert({
          ...safeDetails,
          status: safeDetails.status ?? "open",
          created_by: user.id,
        }).select().single();
        if (error) return respondErr(error.message);
        return respond({ event: ev });
      }
      case "update_event": {
        const safeDetails = sanitizeEventDetails((details || {}) as Record<string, unknown>);
        await supabaseAdmin.from("events").update(safeDetails).eq("id", target_id);
        return respond({});
      }
      case "cancel_event": {
        await supabaseAdmin.from("events").update({ status: "cancelled" }).eq("id", target_id);
        return respond({});
      }
      case "approve_event": {
        if (!target_id) return respondErr("target_id required");
        const { data: ev, error: approveEventErr } = await supabaseAdmin
          .from("events")
          .update({ status: "open", updated_at: new Date().toISOString() })
          .eq("id", target_id)
          .eq("status", "pending_review")
          .select("id, status")
          .maybeSingle();
        if (approveEventErr) return respondErr(approveEventErr.message, 500);
        if (!ev) return respondErr("event not pending or not found", 404);
        return respond({ updated: "event", status: "open" });
      }
      case "reject_event": {
        if (!target_id) return respondErr("target_id required");
        const { data: ev, error: rejectEventErr } = await supabaseAdmin
          .from("events")
          .update({ status: "rejected", updated_at: new Date().toISOString() })
          .eq("id", target_id)
          .eq("status", "pending_review")
          .select("id, status")
          .maybeSingle();
        if (rejectEventErr) return respondErr(rejectEventErr.message, 500);
        if (!ev) return respondErr("event not pending or not found", 404);
        return respond({ updated: "event", status: "rejected" });
      }
      case "delete_event": {
        const { data: eventChats, error: eventChatsErr } = await supabaseAdmin
          .from("chats")
          .select("id")
          .eq("event_id", target_id);
        assertNoDbError(eventChatsErr, "Failed to load event chats");

        const chatIds = (eventChats || []).map((c: { id: string }) => c.id);
        if (chatIds.length > 0) {
          const { error: deleteMessagesErr } = await supabaseAdmin.from("messages").delete().in("chat_id", chatIds);
          assertNoDbError(deleteMessagesErr, "Failed to delete chat messages");
          const { error: deleteParticipantsErr } = await supabaseAdmin.from("chat_participants").delete().in("chat_id", chatIds);
          assertNoDbError(deleteParticipantsErr, "Failed to delete chat participants");
          const { error: deleteChatsErr } = await supabaseAdmin.from("chats").delete().in("id", chatIds);
          assertNoDbError(deleteChatsErr, "Failed to delete chats");
        }

        const { error: deleteVotesErr } = await supabaseAdmin.from("event_votes").delete().eq("event_id", target_id);
        assertNoDbError(deleteVotesErr, "Failed to delete event votes");
        const { error: deletePhotosErr } = await supabaseAdmin.from("event_photos").delete().eq("event_id", target_id);
        assertNoDbError(deletePhotosErr, "Failed to delete event photos");        const { error: deleteRegsErr } = await supabaseAdmin.from("event_registrations").delete().eq("event_id", target_id);
        assertNoDbError(deleteRegsErr, "Failed to delete event registrations");
        const { error: deleteEventErr } = await supabaseAdmin.from("events").delete().eq("id", target_id);
        console.log("deleteEventErr", deleteEventErr);
        assertNoDbError(deleteEventErr, "Failed to delete event");

        const { data: remainingEvent, error: verifyErr } = await supabaseAdmin
          .from("events")
          .select("id")
          .eq("id", target_id)
          .maybeSingle();
        assertNoDbError(verifyErr, "Failed to verify event deletion");
        if (remainingEvent) return respondErr("Event deletion was not completed", 500);

        return respond({});
      }
      case "upsert_event_click_feedback": {
        const eventId = target_id;
        const reporterId = typeof details?.reporter_user_id === "string" ? details.reporter_user_id : "";
        const targetUserId = typeof details?.target_user_id === "string" ? details.target_user_id : "";
        if (!eventId || !reporterId || !targetUserId) {
          return respondErr("event id, reporter_user_id and target_user_id are required");
        }
        if (reporterId === targetUserId) return respondErr("reporter and target must differ");
        if (typeof details?.had_click !== "boolean") return respondErr("had_click (boolean) required");
        const vote = details.had_click ? "clicked" : "no_click";
        const { error: feedbackErr } = await supabaseAdmin
          .from("event_votes")
          .upsert(
            {
              event_id: eventId,
              voter_id: reporterId,
              votee_id: targetUserId,
              vote,
            },
            { onConflict: "event_id,voter_id,votee_id" },
          );
        if (feedbackErr) return respondErr(feedbackErr.message, 500);
        return respond({ updated: "event_click_feedback", vote });
      }
      case "approve_registration": {
        await supabaseAdmin.from("event_registrations").update({ status: "approved" }).eq("id", target_id);
        return respond({});
      }
      case "reject_registration": {
        await supabaseAdmin.from("event_registrations").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", target_id);
        return respond({});
      }
      case "move_to_waitlist": {
        await supabaseAdmin.from("event_registrations").update({ status: "waitlist", waitlist_position: details?.position || null }).eq("id", target_id);
        return respond({});
      }
      case "remove_registration": {
        await supabaseAdmin.from("event_registrations").delete().eq("id", target_id);
        return respond({});
      }
      case "checkin_registration": {
        await supabaseAdmin
          .from("event_registrations")
          .update({ status: "checked_in", checked_in_at: new Date().toISOString() })
          .eq("id", target_id);
        return respond({});
      }
      case "checkin_by_entry_code": {
        const code = typeof details?.entry_code === "string" ? details.entry_code.trim() : "";
        const eventId = typeof details?.event_id === "string" ? details.event_id : null;
        if (!code || !eventId) return respondErr("entry_code and event_id are required");
        const { data: reg, error: regErr } = await supabaseAdmin
          .from("event_registrations")
          .select("id, status")
          .eq("event_id", eventId)
          .eq("entry_code", code)
          .maybeSingle();
        if (regErr || !reg) return respondErr("Registration not found", 404);
        await supabaseAdmin
          .from("event_registrations")
          .update({ status: "checked_in", checked_in_at: new Date().toISOString() })
          .eq("id", reg.id);
        return respond({ registration_id: reg.id });
      }

      // ---- Chat Management ----
      case "delete_message": {
        await supabaseAdmin.from("messages").update({ is_deleted: true, deleted_by: user.id, deleted_at: new Date().toISOString() }).eq("id", target_id);
        return respond({});
      }
      case "remove_chat_participant": {
        await supabaseAdmin.from("chat_participants").update({ removed: true, removed_by: user.id, removed_at: new Date().toISOString() }).eq("id", target_id);
        return respond({});
      }
      case "close_chat": {
        await supabaseAdmin.from("chats").update({ is_closed: true, closed_by: user.id, closed_at: new Date().toISOString(), close_reason: details?.reason || null }).eq("id", target_id);
        return respond({});
      }
      case "reopen_chat": {
        await supabaseAdmin.from("chats").update({ is_closed: false, closed_by: null, closed_at: null, close_reason: null }).eq("id", target_id);
        return respond({});
      }
      case "set_announcements_mode": {
        const on = details?.enabled ?? true;
        await supabaseAdmin.from("chats").update({
          announcements_only: on,
          announcements_set_by: on ? user.id : null,
          announcements_set_at: on ? new Date().toISOString() : null,
        }).eq("id", target_id);
        return respond({});
      }
      case "pin_message": {
        const { data: msg } = await supabaseAdmin.from("messages").select("is_pinned, chat_id").eq("id", target_id).single();
        if (!msg) return respondErr("Message not found", 404);
        if (!msg.is_pinned) {
          await supabaseAdmin.from("messages").update({ is_pinned: false, pinned_by: null }).eq("chat_id", msg.chat_id).eq("is_pinned", true);
        }
        await supabaseAdmin.from("messages").update({ is_pinned: !msg.is_pinned, pinned_by: !msg.is_pinned ? user.id : null }).eq("id", target_id);
        return respond({});
      }

      // ---- Subscription Management ----
      case "extend_subscription": {
        await supabaseAdmin.from("subscriptions").update({ current_period_end: details.new_end }).eq("user_id", target_id);
        return respond({});
      }
      case "cancel_subscription": {
        await supabaseAdmin.from("subscriptions").update({ cancel_at_period_end: true, status: "cancelled" }).eq("user_id", target_id);
        await supabaseAdmin.from("profiles").update({ subscription_status: "cancelled" }).eq("user_id", target_id);
        return respond({});
      }
      case "change_subscription_type": {
        await supabaseAdmin.from("subscriptions").update({ amount: details.amount }).eq("user_id", target_id);
        return respond({});
      }

      case "adjust_user_points": {
        const delta = Number(details?.amount);
        if (!Number.isFinite(delta) || delta === 0) return respondErr("invalid amount");
        const reason = typeof details?.reason === "string" && details.reason.trim()
          ? details.reason.trim().slice(0, 500)
          : "התאמה ידנית";
        await supabaseAdmin.from("points_history").insert({
          user_id: target_id,
          type: "admin_adjust",
          amount: delta,
          description: reason,
        });
        return respond({});
      }
      case "set_user_tier": {
        const tier = details?.tier;
        if (!["new", "veteran", "ambassador"].includes(tier)) return respondErr("invalid tier");
        await supabaseAdmin.from("profiles").update({ status: tier }).eq("user_id", target_id);
        return respond({ updated: "tier" });
      }
      case "toggle_referral_disabled": {
        const disabled = Boolean(details?.disabled);
        await supabaseAdmin.from("profiles").update({ referral_disabled: disabled }).eq("user_id", target_id);
        return respond({ referral_disabled: disabled });
      }
      case "set_referral_cap_override": {
        const raw = details?.cap_override;
        let capVal: number | null = null;
        if (raw === null || raw === "") capVal = null;
        else {
          const n = Number(raw);
          if (!Number.isFinite(n) || n < 0) return respondErr("invalid cap_override");
          capVal = Math.floor(n);
        }
        await supabaseAdmin.from("profiles").update({ referral_cap_override: capVal }).eq("user_id", target_id);
        return respond({ referral_cap_override: capVal });
      }

      default:
        return respondErr("Unknown action");
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
