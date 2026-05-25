-- Server-side onboarding OTP challenges (hashed codes, rate limits, verification tokens)

CREATE TABLE IF NOT EXISTS public.onboarding_otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'phone')),
  code_hash text NOT NULL,
  verification_token text,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_otp_identifier_created
  ON public.onboarding_otp_challenges (identifier, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_onboarding_otp_verification_token
  ON public.onboarding_otp_challenges (verification_token)
  WHERE verification_token IS NOT NULL;

ALTER TABLE public.onboarding_otp_challenges ENABLE ROW LEVEL SECURITY;

-- No client policies: Edge Functions use service_role only

COMMENT ON TABLE public.onboarding_otp_challenges IS
  'Hashed OTP for onboarding; managed by Edge (issue-onboarding-otp / verify-onboarding-otp).';
