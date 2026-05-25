# Security Phase 1 — deploy checklist

## Database

```bash
supabase db push
```

Migrations:

- `20260525120000_security_phase1_rls.sql` — events RLS enable, moderation visibility, profile column guard
- `20260525120100_onboarding_otp_challenges.sql` — server OTP table

Verify with [`docs/security-verify-rls.sql`](security-verify-rls.sql).

## Edge Function secrets (Supabase Dashboard / CLI)

| Secret | Used by |
|--------|---------|
| `WEBHOOK_INTERNAL_SECRET` | Legacy `registration-webhook`, `send-otp-webhook` (if still called server-to-server) |
| `N8N_OTP_WEBHOOK_URL` | `issue-onboarding-otp` (OTP delivery to n8n — code never sent to browser) |
| `OTP_HASH_SALT` | Optional extra salt for OTP hashing |

```bash
supabase secrets set WEBHOOK_INTERNAL_SECRET=your-long-random-secret
supabase secrets set N8N_OTP_WEBHOOK_URL=https://your-n8n-host/webhook/send-otp
```

## Deploy Edge Functions

```bash
supabase functions deploy update-profile get-profile-stats check-subscription-eligibility cancel-subscription create-referral complete-registration issue-onboarding-otp verify-onboarding-otp registration-webhook send-otp-webhook compute-compatibility
```

## Frontend

- Remove `VITE_OPENAI_API_KEY` from production env (no longer used).
- Do **not** set `VITE_SHOW_OTP_PLAINTEXT` or `VITE_ONBOARDING_DEBUG` in production.
- Deploy SPA; Netlify uses `netlify.toml` + `public/_headers` for security headers.

## Breaking changes

- Onboarding OTP is **server-issued**; client no longer stores or compares codes locally.
- `complete-registration` requires `verification_token` from `verify-onboarding-otp`.
- IDOR Edge functions require valid user JWT; `user_id` in body must match the caller.
