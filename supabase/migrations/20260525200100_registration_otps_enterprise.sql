-- Extend onboarding OTP table for enterprise fields (backward compatible)

ALTER TABLE public.onboarding_otp_challenges
  ADD COLUMN IF NOT EXISTS registration_session_id text,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ip_hash text,
  ADD COLUMN IF NOT EXISTS user_agent_hash text,
  ADD COLUMN IF NOT EXISTS blocked_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_onboarding_otp_session
  ON public.onboarding_otp_challenges (registration_session_id)
  WHERE registration_session_id IS NOT NULL;

-- Reporting alias (spec name registration_otps)
CREATE OR REPLACE VIEW public.registration_otps AS
SELECT
  id,
  identifier AS destination,
  channel AS destination_type,
  code_hash AS otp_hash,
  registration_session_id,
  attempt_count AS attempts,
  max_attempts,
  expires_at,
  consumed_at,
  verified_at,
  verification_token,
  ip_hash,
  user_agent_hash,
  blocked_until,
  created_at
FROM public.onboarding_otp_challenges;

COMMENT ON VIEW public.registration_otps IS 'Alias view over onboarding_otp_challenges for security reporting.';
