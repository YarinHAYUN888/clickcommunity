import { optionsOk } from "../_shared/edgeAuth.ts";
import { handleIssueOtp } from "../_shared/onboardingOtpCore.ts";

/** Alias for issue-onboarding-otp (enterprise spec name). */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsOk();
  try {
    return await handleIssueOtp(req);
  } catch (err) {
    console.error("[send-registration-otp]", err);
    return new Response(JSON.stringify({ error: "unexpected_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
