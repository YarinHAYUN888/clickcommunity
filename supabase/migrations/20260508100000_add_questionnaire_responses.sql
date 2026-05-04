-- Introduction / acquaintance questionnaire (JSON). Used in onboarding + AI suitability review.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS questionnaire_responses jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.questionnaire_responses IS 'Hebrew introduction questionnaire: { [questionId]: answer string } for AI/human review';
