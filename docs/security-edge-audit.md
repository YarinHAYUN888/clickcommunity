# Edge Function security audit

| Function | verify_jwt | Auth pattern | user_id from body | Notes |
|----------|------------|--------------|-------------------|-------|
| issue-onboarding-otp | false | anon + service role | N/A | Rate limit + audit |
| verify-onboarding-otp | false | anon + service role | N/A | Max attempts + block |
| send-registration-otp | false | alias of issue | N/A | |
| verify-registration-otp | false | alias of verify | N/A | |
| complete-registration | false | OTP token required | N/A | Rate limit email+IP |
| referral-preview | false | rate limit IP | N/A | Minimal fields |
| registration-webhook | false | WEBHOOK_INTERNAL_SECRET | N/A | Legacy |
| send-otp-webhook | false | WEBHOOK_INTERNAL_SECRET | N/A | Legacy |
| update-profile | true | requireAuthUser + self | yes (must match) | Rate limit |
| get-profile-stats | true | requireAuthUser + self | yes | |
| check-subscription-eligibility | true | requireAuthUser + self | yes | |
| cancel-subscription | true | requireAuthUser + self | yes | |
| create-referral | true | requireAuthUser + self | yes | |
| analyze-profile-personality | true | JWT + self only | optional | |
| analyze-registration-suitability | true | JWT + self only | optional | OpenAI server-side |
| compute-compatibility | true | JWT + approved profiles | yes | |
| automation-dispatch | true | super / automation | varies | HMAC webhooks |
| admin-action | true | super_role | varies | |
| admin-get-stats | true | super_role | N/A | |
| admin-get-users | true | super_role | N/A | |
| register-for-event | true | JWT | event_id | |
| claim-signup-rewards | true | JWT | duplicated auth | migrate to edgeAuth |
| create-or-get-dm | true | JWT | partner | |
| send-message | true | JWT | chat | |

**Pre-auth by design:** OTP issue/verify, complete-registration (with verification_token), referral-preview (rate limited).

**Hardening applied:** `_shared/edgeAuth.ts`, `securityRateLimit.ts`, `securityAudit.ts`, `webhookDispatch.ts` (HMAC).
