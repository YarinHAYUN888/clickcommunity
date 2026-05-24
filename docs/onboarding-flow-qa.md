# Onboarding flow QA (production)

Enable step logs temporarily: `VITE_ONBOARDING_DEBUG=true` in the deployment env.

After merge:

- DB: `supabase db push` (migration `20260524120000_new_users_default_member.sql` — trigger + backfill guests→member)
- Edge: `supabase functions deploy complete-registration`

## Community member (`role: member`)

- [ ] New signup: `SELECT role FROM profiles WHERE user_id = '<id>'` → `member`
- [ ] Admin users list shows badge **חבר** (not אורח)
- [ ] Events: user can register (`canRegister` when `role === 'member'`)
- [ ] Subscription page shows MemberView (not guest paywall) when `role=member`
- [ ] Legacy guests backfilled after migration (no `guest` rows except admin demotions)

## Desktop

- [ ] Complete onboarding → send OTP (email) → enter code → lands on `/clicks` or `/pending-review`
- [ ] Console shows STEP 1–8 in order (with debug flag)
- [ ] Wrong OTP shows verify error (not send error)

## iPhone Safari

- [ ] Same flow as desktop
- [ ] Refresh on OTP screen → code still accepted (sessionStorage `clicks_otp_pending`)
- [ ] Session establishes without `session_restore_failed` toast

## Photos

- [ ] 0 photos: account created, redirect OK
- [ ] 6 photos (incl. HEIC): account created even if some uploads fail; toast about partial photos; not stuck on OTP
- [ ] Failed upload: `image_upload_status` pending/failed in DB; user not sent to OTP loop on retry login

## Retry / recovery

- [ ] After partial failure with session: user redirects to app (not OTP)
- [ ] `already_exists` email: sign-in fallback + profile finalize

## OTP send (webhook)

- [ ] Webhook timeout shows timeout Hebrew message (send screen only)
- [ ] After `codeSent`, send errors hidden; verify errors separate

## Pending review UX

- [ ] After signup with `moderation_status = pending`: direct `/pending-review` (no flash of `/clicks` / MainLayout)
- [ ] Login as pending user → `/pending-review` (not `/clicks` first)
- [ ] Open `/` while logged in + pending → `/pending-review`
- [ ] Refresh on `/pending-review` stays on page; no auto-toast on load
- [ ] "רענון סטטוס" still shows toast when still pending
- [ ] Approved user: `/pending-review` boot redirects to `/clicks`

## Life niche (שאלון)

- [ ] Dropdown has no "אחרי שירות / חיילות"
- [ ] Placeholder: "מה הכי מתאר אותך כרגע?" (onboarding + edit)
- [ ] Other options unchanged (טיול גדול, סטודנט, וכו')

Deploy after niche change: `supabase db push` + `supabase functions deploy complete-registration update-profile`

## Regression

- [ ] Login still works
- [ ] Admin moderation unchanged
- [ ] Existing members feed unchanged
