# Enterprise security hardening — summary

## Fixed / added

| Area | Change |
|------|--------|
| OTP enterprise | Extended `onboarding_otp_challenges`; IP/UA/session; `blocked_until`; aliases `send/verify-registration-otp` |
| Rate + audit | Tables `security_rate_limits`, `security_audit_logs`; shared helpers wired to OTP, registration, profile update, referral, AI |
| Registration defaults | `suitability_status: pending` on signup; `role: member` retained |
| RLS | Explicit pending/rejected/blocked; chat policy requires both approved; `get_dm_partner_preview` uses visibility |
| Webhooks | `_shared/webhookDispatch.ts` HMAC `X-Webhook-Signature`; OTP + automation-dispatch |
| AI suitability | `analyze-registration-suitability` Edge; `userSuitability.ts` invokes Edge (DEV mock fallback) |
| Frontend | No `clicks_pwd`; `AdminRoute`; DEV-only logs; HSTS + COOP |
| Storage G1 | MIME + 8MB cap on profile uploads |

## Migrations

- `20260525200000_security_rate_audit_tables.sql`
- `20260525200100_registration_otps_enterprise.sql`
- `20260525210000_rls_enterprise_visibility.sql`

## Deploy

```bash
supabase db push
supabase secrets set N8N_WEBHOOK_SECRET=... OTP_WEBHOOK_URL=... WEBHOOK_INTERNAL_SECRET=... OPENAI_API_KEY=...
supabase functions deploy issue-onboarding-otp verify-onboarding-otp send-registration-otp verify-registration-otp complete-registration update-profile referral-preview analyze-registration-suitability automation-dispatch
npm run build
```

## Remaining risks

- Public photo bucket (G2 deferred): privacy-by-URL until private bucket + signed URLs.
- Edge CORS `*` until `ALLOWED_ORIGINS` configured.
- CSP `unsafe-inline` / `unsafe-eval` (Vite).
