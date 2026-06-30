-- Realtime for incoming like notifications on Clicks feed (additive).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profile_swipes'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profile_swipes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_swipes;
  END IF;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
