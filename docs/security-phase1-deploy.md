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

### Event registration (`register-for-event`)

After changing structured registration responses (HTTP 200 + `ok` / `error_code`), deploy only this function:

```bash
npx supabase functions deploy register-for-event --project-ref lwprevqahebqenpzdvle
```

Post-deploy: register on an open event in prod, confirm Supabase Logs show `EVENT REGISTRATION REQUEST RECEIVED` and the UI never shows `Edge Function returned a non-2xx status code`.

### Clicks / Events / Matching flow

After shadow feed, post-event votes, admin event hardening, or profile reception stats changes:

```bash
npx supabase functions deploy get-profile-reception-stats submit-votes register-for-event admin-action compute-compatibility --project-ref lwprevqahebqenpzdvle
```

Post-deploy QA: admin user review shows like count; past event with voting open allows binary vote; new events have `status=open`; event list ranks by mutual matches without hiding events.

After remaining gaps (member events, auto-past, veteran ranking, event clicks tab):

```bash
npx supabase functions deploy create-member-event sync-past-events get-profile-reception-stats submit-votes register-for-event admin-action compute-compatibility --project-ref lwprevqahebqenpzdvle
```

Post-deploy QA checklist:

| # | Check |
|---|--------|
| 1 | Member with 199 points — no create button |
| 2 | Member with 200+ — creates event → appears in list → opens → registration works |
| 3 | Super-admin create unchanged |
| 4 | Past-date event auto-marked `past`; admin opens voting → vote works |
| 5 | Event list sorted mutual → click → veterans; all events still shown |
| 6 | Clicks tab "לאירוע הקרוב" shows matches |
| 7 | Admin shadow — confirmation modal + click count; shadow user feed works, no member-facing "מבודד" |
| 8 | `npm run test` passes |

Frontend: push `src/` changes to production after edge deploy.

### OTP payload contract (email)

After changing `onboardingOtpCore` / `n8nOtpEnvelope`, redeploy at minimum:

```bash
supabase functions deploy issue-onboarding-otp verify-onboarding-otp send-registration-otp verify-registration-otp
```

- **Contract A (browser → Edge):** `{ channel: "email"|"sms", email|phone, registration_session_id }`
- **Contract B (Edge → n8n):** POST root `{ body: { email, code, channel, purpose: "registration", ... } }` so Gmail can read `$('Webhook').item.json.body.email`
- Do not change `OTP_EMAIL_WEBHOOK_URL` / TEST↔PROD mapping or n8n Gmail nodes
- Post-deploy: trigger email OTP and confirm n8n execution shows `json.body.email` populated

### OTP 500 / delivery diagnostics

Edge logs use prefix `[issue-onboarding-otp]` with `stage` values: `missing_webhook_url`, `missing_secret`, `db_insert_failed`, `email_dispatch_failed`, `unexpected`.

| Secret / env | Purpose |
|--------------|---------|
| `OTP_EMAIL_WEBHOOK_URL` | Required for email OTP (or fallbacks `OTP_WEBHOOK_URL`, `N8N_OTP_WEBHOOK_URL`) |
| `N8N_WEBHOOK_SECRET` | HMAC signature (optional unless `OTP_REQUIRE_WEBHOOK_SECRET=true`) |
| `OTP_REQUIRE_WEBHOOK_SECRET` | Set `true` in production to fail fast when no signing secret |

**Manual QA after deploy:**

1. Send email OTP — no HTTP 500 in browser console
2. Email arrives; n8n shows `json.body.email` populated
3. No CSP errors on `data:image` (onboarding photo compression) or hero Supabase Storage video
4. SMS row remains locked ("ייפתח בקרוב")
5. Webhook timeout returns HTTP 200 + `delivery_status: "pending"` (user can still enter code)

**Netlify:** CSP changes in `netlify.toml` / `public/_headers` require a Netlify deploy (not only `npm run build` locally).

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
