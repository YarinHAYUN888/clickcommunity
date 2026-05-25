import { optionsOk } from "../_shared/edgeAuth.ts";
import { handleVerifyOtp } from "../_shared/onboardingOtpCore.ts";

/** Alias for verify-onboarding-otp (enterprise spec name). */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsOk();
  try {
    return await handleVerifyOtp(req);
  } catch (err) {
    console.error("[verify-registration-otp]", err);
    return new Response(JSON.stringify({ error: "unexpected_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
