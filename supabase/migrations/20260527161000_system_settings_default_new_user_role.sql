-- Stage 3: default role for new users (super_admin managed)

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_super_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_super_role_check
  CHECK (super_role IN ('developer', 'admin', 'super_admin'));

CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = p_user_id
      AND super_role = 'super_admin'
  );
$$;

CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.system_settings
  DROP CONSTRAINT IF EXISTS system_settings_default_new_user_role_check;
ALTER TABLE public.system_settings
  ADD CONSTRAINT system_settings_default_new_user_role_check
  CHECK (
    key <> 'default_new_user_role'
    OR value IN ('guest', 'member')
  );

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin read system settings" ON public.system_settings;
CREATE POLICY "Super admin read system settings"
  ON public.system_settings
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admin insert system settings" ON public.system_settings;
CREATE POLICY "Super admin insert system settings"
  ON public.system_settings
  FOR INSERT
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admin update system settings" ON public.system_settings;
CREATE POLICY "Super admin update system settings"
  ON public.system_settings
  FOR UPDATE
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.system_settings (key, value, updated_at)
VALUES ('default_new_user_role', 'member', now())
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  updated_at = EXCLUDED.updated_at;
