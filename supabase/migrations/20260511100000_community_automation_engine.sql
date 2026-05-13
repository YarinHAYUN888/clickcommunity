-- Community Automation Engine (additive): templates, flows, webhook dispatch logs

CREATE TABLE IF NOT EXISTS public.automation_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'custom',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_templates_category ON public.automation_templates (category);
CREATE INDEX IF NOT EXISTS idx_automation_templates_status ON public.automation_templates (status);

CREATE TABLE IF NOT EXISTS public.automation_flows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  trigger_type text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  template_id uuid REFERENCES public.automation_templates(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_flows_trigger ON public.automation_flows (trigger_type);
CREATE INDEX IF NOT EXISTS idx_automation_flows_active ON public.automation_flows (is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.automation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id uuid REFERENCES public.automation_flows(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.automation_templates(id) ON DELETE SET NULL,
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_type text,
  webhook_mode text,
  webhook_url_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  error_message text,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_created ON public.automation_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_recipient ON public.automation_logs (recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON public.automation_logs (status);

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.set_automation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS tr_automation_templates_updated ON public.automation_templates;
CREATE TRIGGER tr_automation_templates_updated
  BEFORE UPDATE ON public.automation_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_automation_updated_at();

DROP TRIGGER IF EXISTS tr_automation_flows_updated ON public.automation_flows;
CREATE TRIGGER tr_automation_flows_updated
  BEFORE UPDATE ON public.automation_flows
  FOR EACH ROW EXECUTE FUNCTION public.set_automation_updated_at();

ALTER TABLE public.automation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- Super users only (matches existing admin pattern)
DROP POLICY IF EXISTS "automation_templates_super_all" ON public.automation_templates;
CREATE POLICY "automation_templates_super_all" ON public.automation_templates
  FOR ALL TO authenticated
  USING (public.is_super_user(auth.uid()))
  WITH CHECK (public.is_super_user(auth.uid()));

DROP POLICY IF EXISTS "automation_flows_super_all" ON public.automation_flows;
CREATE POLICY "automation_flows_super_all" ON public.automation_flows
  FOR ALL TO authenticated
  USING (public.is_super_user(auth.uid()))
  WITH CHECK (public.is_super_user(auth.uid()));

DROP POLICY IF EXISTS "automation_logs_super_all" ON public.automation_logs;
CREATE POLICY "automation_logs_super_all" ON public.automation_logs
  FOR ALL TO authenticated
  USING (public.is_super_user(auth.uid()))
  WITH CHECK (public.is_super_user(auth.uid()));

-- Seed built-in templates (Hebrew / mixed placeholders — editable by admin; idempotent)
INSERT INTO public.automation_templates (name, subject, body, category, status, is_system)
SELECT v.name, v.subject, v.body, v.category, v.status, v.is_system
FROM (
  VALUES
    ('ברכת יום הולדת', 'יום הולדת שמח, {{first_name}}! 🎂', 'היי {{first_name}},\n\nכל הקהילה מאחלת לך יום הולדת שמח!\n\nנשמח לראות אותך באירועים הקרובים.\n\n— צוות Clicks', 'birthday', 'active', true),
    ('תזכורת לאירוע', 'תזכורת: {{event_name}}', 'שלום {{first_name}},\n\nתזכורת קצרה: האירוע {{event_name}} מתקיים ב-{{event_date}} בשעה {{event_time}}.\n\nמיקום: {{location_name}}\n{{location_address}}\n\nנתראה שם!', 'event_reminder', 'active', true),
    ('הישג נקודות', 'כל הכבוד! הגעת ל-{{points}} נקודות ✨', 'היי {{first_name}},\n\nאיזה יופי — צברת {{points}} נקודות בקהילה!\n\nתודה על ההשתתפות והאנרגיה.\n\n— צוות Clicks', 'points', 'active', true),
    ('אישור לקהילה', 'ברוך הבא/ה לקהילה, {{first_name}}!', 'היי {{first_name}},\n\nהחשבון שלך אושר והצטרפת רשמית לקהילת Clicks.\n\nמחכים לראות אותך באירועים ובצ׳אטים.\n\n— צוות Clicks', 'approval', 'active', true),
    ('הודעה ידנית', 'הודעה מצוות Clicks', 'שלום {{first_name}},\n\n[ערכ/י כאן את תוכן ההודעה]\n\n— צוות Clicks', 'custom', 'draft', true)
) AS v(name, subject, body, category, status, is_system)
WHERE NOT EXISTS (
  SELECT 1 FROM public.automation_templates t WHERE t.name = v.name AND t.is_system = true
);
