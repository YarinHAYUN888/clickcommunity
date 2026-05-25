# Enterprise security hardening — QA checklist

## OTP

- [ ] Email OTP: valid Gmail, iPhone Safari, invalid email message, resend, uncertain delivery still shows code screen.
- [ ] SMS OTP unchanged after email fix.
- [ ] Issue OTP via onboarding — receive code by email/SMS (n8n); no code in browser storage (only `challenge_id`).
- [ ] Wrong code shows Hebrew invalid message; after 5 failures, `too_many_attempts` / block.
- [ ] Resend respects rate limit (`rate_limited` Hebrew).
- [ ] Aliases `send-registration-otp` / `verify-registration-otp` behave like onboarding functions.

## Registration

- [ ] `complete-registration` rejects missing `verification_token`.
- [ ] New user: `moderation_status=pending`, `suitability_status=pending`, `role=member`.
- [ ] Existing email path still returns magic link (no profile takeover).

## RLS / visibility

- [ ] Pending user cannot browse other profiles in feed (self only).
- [ ] Approved active user sees approved active community.
- [ ] Admin (`super_role`) sees all.
- [ ] DM partner preview only when partner passes `profile_is_visible_to_authenticated`.
- [ ] Run `docs/security-verify-rls.sql` after `supabase db push`.

## Edge / secrets

- [ ] No `VITE_OPENAI` or `VITE_N8N_*` in production build (`npm run build` + grep `dist`).
- [ ] `analyze-registration-suitability` works with session JWT in production.
- [ ] DEV fallback mock when Edge unavailable.

## Frontend

- [ ] Password not in `sessionStorage` (`clicks_pwd` removed).
- [ ] Non-super user visiting `/admin` redirected to `/clicks`.
- [ ] Security headers: HSTS, COOP on Netlify.

## Storage (G1)

- [ ] Non-image upload rejected; >8MB rejected.

## Deferred (G2)

- [ ] Public `photos` bucket — document if still public; signed URLs not yet enforced.
