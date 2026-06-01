-- Allow Edge Functions (service_role) to update privileged profile columns (role, moderation, etc.).
-- Without this, profiles_guard_privileged_columns silently reverts role on service-role UPDATEs.

CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_super_user(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF coalesce(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.super_role := OLD.super_role;
  NEW.moderation_status := OLD.moderation_status;
  NEW.suitability_status := OLD.suitability_status;
  NEW.is_shadow := OLD.is_shadow;
  NEW.role := OLD.role;
  NEW.suspended := OLD.suspended;
  NEW.points := OLD.points;
  NEW.subscription_status := OLD.subscription_status;
  NEW.suspended_at := OLD.suspended_at;
  NEW.suspended_by := OLD.suspended_by;

  RETURN NEW;
END;
$$;

-- Backfill guests who were stuck due to blocked service-role role updates (non-subscribers, non-admins).
UPDATE public.profiles
SET
  role = 'member',
  updated_at = now()
WHERE role = 'guest'
  AND super_role IS NULL
  AND coalesce(subscription_status, 'none') IS DISTINCT FROM 'active';
