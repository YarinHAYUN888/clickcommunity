-- Additive metadata for group chats (backward-compatible).
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS created_by UUID;

COMMENT ON COLUMN public.chats.display_name IS 'Optional label for manual/admin-created group chats';
COMMENT ON COLUMN public.chats.created_by IS 'Auth user id of creator (e.g. admin)';
