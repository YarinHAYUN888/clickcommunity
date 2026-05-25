# Security deploy checklist (Phase 1 + enterprise hardening)

## Database

```bash
supabase db push
```

Migrations (in order):

- `20260525120000_security_phase1_rls.sql`
- `20260525120100_onboarding_otp_challenges.sql`
- `20260525200000_security_rate_audit_tables.sql`
- `20260525200100_registration_otps_enterprise.sql`
- `20260525210000_rls_enterprise_visibility.sql`

Verify with [`docs/security-verify-rls.sql`](security-verify-rls.sql).

## Edge Function secrets

| Secret | Used by |
|--------|---------|
| `WEBHOOK_INTERNAL_SECRET` | Legacy webhooks, HMAC fallback |
| `N8N_WEBHOOK_SECRET` | HMAC `X-Webhook-Signature` on n8n payloads |
| `OTP_EMAIL_WEBHOOK_URL` | Email OTP delivery (preferred for email channel) |
| `OTP_SMS_WEBHOOK_URL` | SMS OTP delivery (optional dedicated URL) |
| `OTP_WEBHOOK_URL` | Shared OTP webhook fallback |
| `N8N_OTP_WEBHOOK_URL` | Legacy OTP webhook fallback |
| `OPENAI_API_KEY` | `analyze-registration-suitability`, personality |
| `SECURITY_HASH_SALT` | Optional IP/UA hashing |

```bash
supabase secrets set WEBHOOK_INTERNAL_SECRET=... N8N_WEBHOOK_SECRET=... OTP_WEBHOOK_URL=... OPENAI_API_KEY=...
```

## Deploy Edge Functions

```bash
supabase functions deploy issue-onboarding-otp verify-onboarding-otp send-registration-otp verify-registration-otp complete-registration update-profile get-profile-stats check-subscription-eligibility cancel-subscription create-referral referral-preview analyze-registration-suitability automation-dispatch compute-compatibility
```

## Frontend

- Remove `VITE_OPENAI_API_KEY` and `VITE_N8N_*` from production env.
- Do **not** set `VITE_SHOW_OTP_PLAINTEXT` or `VITE_ONBOARDING_DEBUG` in production.
- Deploy SPA; Netlify uses `netlify.toml` + `public/_headers` (HSTS, COOP, CSP).

## QA

See [`docs/security-hardening-qa.md`](security-hardening-qa.md).

## Breaking changes

- Onboarding OTP is server-issued; `verification_token` required for `complete-registration`.
- New users start with `suitability_status=pending` until admin/AI approval.
- IDOR Edge functions require JWT; `user_id` must match caller.
