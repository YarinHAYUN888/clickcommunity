-- Enterprise security: rate limits + audit logs (service role only)

CREATE TABLE IF NOT EXISTS public.security_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  action text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, action)
);

CREATE INDEX IF NOT EXISTS idx_security_rate_limits_blocked
  ON public.security_rate_limits (blocked_until)
  WHERE blocked_until IS NOT NULL;

ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warn', 'high', 'critical')),
  ip_hash text,
  user_agent_hash text,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created
  ON public.security_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_action
  ON public.security_audit_logs (action, created_at DESC);

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admins read audit logs via Edge only; no client policies

COMMENT ON TABLE public.security_rate_limits IS 'Edge-managed anti-abuse counters; no direct client access.';
COMMENT ON TABLE public.security_audit_logs IS 'Security events; insert via service role, read via admin Edge.';
