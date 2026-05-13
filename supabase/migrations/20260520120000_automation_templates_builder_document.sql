-- Additive: optional visual email builder document (blocks JSON). Compiled HTML/text still stored in body.

ALTER TABLE public.automation_templates
  ADD COLUMN IF NOT EXISTS builder_document jsonb;

COMMENT ON COLUMN public.automation_templates.builder_document IS
  'Optional block-based email builder state; body remains compiled output for webhook compatibility';
