-- Run in Supabase SQL editor after db push (Security Phase 1 verification)
-- Expected: rowsecurity = true for all public app tables including events*

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'profiles', 'events', 'event_registrations', 'event_votes', 'event_photos',
    'chats', 'chat_participants', 'messages', 'subscriptions', 'referrals',
    'onboarding_otp_challenges'
  )
ORDER BY c.relname;

SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('events', 'event_registrations', 'profiles')
ORDER BY tablename, policyname;
