/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Alias for the anon/public key if you prefer this name over VITE_SUPABASE_PUBLISHABLE_KEY. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Override n8n OTP webhook URL (defaults to test webhook). Browser requests need CORS allowed by that host or use a same-origin proxy. */
  readonly VITE_N8N_OTP_WEBHOOK_URL?: string;
  /** When `"true"`, show OTP in a toast for QA only — unsafe for production. */
  readonly VITE_SHOW_OTP_PLAINTEXT?: string;
}
