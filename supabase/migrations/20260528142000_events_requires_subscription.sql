ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS requires_subscription BOOLEAN NOT NULL DEFAULT false;
