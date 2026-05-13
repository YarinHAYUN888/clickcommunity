-- Additive: recipient resolution audit fields for automation_logs

ALTER TABLE public.automation_logs
  ADD COLUMN IF NOT EXISTS recipient_mode text,
  ADD COLUMN IF NOT EXISTS segment_key text,
  ADD COLUMN IF NOT EXISTS manual_test_email text,
  ADD COLUMN IF NOT EXISTS resolution_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.automation_logs.recipient_mode IS 'manual_test | single_user | segment_member | legacy';
COMMENT ON COLUMN public.automation_logs.segment_key IS 'Audience key when applicable (e.g. approved_members, event_participants)';
COMMENT ON COLUMN public.automation_logs.manual_test_email IS 'Redacted or raw test destination when recipient_mode = manual_test';
COMMENT ON COLUMN public.automation_logs.resolution_meta IS 'Server-side resolution: preview_user_id, recipient_count, errors, etc.';
