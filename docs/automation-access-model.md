# Automation access model (additive)

## Current behavior

- **RLS** on `automation_templates`, `automation_flows`, and `automation_logs` allows only users who pass `public.is_super_user(auth.uid())` (see `20260511100000_community_automation_engine.sql`).
- **Edge Functions** `automation-dispatch`, `automation-recipients`, and `automation-retry-log` require an authenticated JWT and `profiles.super_role` set (same super-user bar as the rest of admin automation).

## UI layers (client only)

1. **Community manager shell** (default at `/admin/automation?view=manager`): wizard for campaigns, no webhook or integration vocabulary in the main copy.
2. **Technical / developer shell** (`?view=dev`): tabs for templates, flows, campaigns, logs, integration tests, etc.

Who sees technical tools:

- `profiles.super_role === 'developer'`, or
- Email listed in `VITE_AUTOMATION_DEVELOPER_EMAILS` (comma-separated), or
- Any super user who turns on **מצב מתקדם** (persisted in `localStorage` under `clicks_automation_technical_view`), or long-press on the manager title (~0.9s), or opens `?technical=1` once and confirms.

## Non–super-user “community managers” (future)

The product may later grant automation to **non-super** roles. That requires:

1. A new additive column or role flag on `profiles` (e.g. `automation_manager`).
2. **New RLS policies** that `OR` the new predicate — never replace the super-user policies without a security review.
3. Matching checks inside every Edge Function that invokes automation (same predicate as RLS).

Until that migration ships, only super users can open `/admin/automation` at all.
