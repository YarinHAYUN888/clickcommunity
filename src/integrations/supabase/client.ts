import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { normalizeEnvValue } from '@/lib/envUtils';

const SUPABASE_URL = normalizeEnvValue(import.meta.env.VITE_SUPABASE_URL);
/** Publishable key is the anon/public key; `VITE_SUPABASE_ANON_KEY` is supported as an alias. */
const SUPABASE_PUBLISHABLE_KEY =
  normalizeEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  normalizeEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY). Copy .env.example to .env.',
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
