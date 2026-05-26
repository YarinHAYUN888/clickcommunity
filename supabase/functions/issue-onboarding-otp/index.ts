import { optionsOk, jsonResponse } from "../_shared/edgeAuth.ts";
import { handleIssueOtp } from "../_shared/onboardingOtpCore.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsOk();
  try {
    return await handleIssueOtp(req);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[issue-onboarding-otp] failed", {
      stage: "unexpected",
      errorMessage,
    });
    return jsonResponse(
      { ok: false, error_code: "unexpected_error", error: "unexpected_error", stage: "unexpected" },
      500,
    );
  }
});
