-- Repair legacy rows: admin moved user to isolated (shadow) but moderation stayed "pending", which trapped them in /pending-review.
-- Only updates rows that are clearly in the isolated bucket.
UPDATE public.profiles
SET
  moderation_status = 'approved',
  moderation_reviewed_at = COALESCE(moderation_reviewed_at, now())
WHERE suitability_status = 'shadow'
  AND COALESCE(is_shadow, false) = true
  AND moderation_status = 'pending';
