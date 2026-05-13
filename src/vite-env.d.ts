/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Alias for the anon/public key if you prefer this name over VITE_SUPABASE_PUBLISHABLE_KEY. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Override n8n OTP webhook URL (defaults to test webhook). Browser requests need CORS allowed by that host or use a same-origin proxy. */
  readonly VITE_N8N_OTP_WEBHOOK_URL?: string;
  /** Only when exactly `"true"`: show OTP in a toast (never in DEV by default). */
  readonly VITE_SHOW_OTP_PLAINTEXT?: string;
  /** test | production — shown in admin Automation Center; Edge Function uses server secrets for URLs */
  readonly VITE_AUTOMATION_WEBHOOK_MODE?: string;
  readonly VITE_AUTOMATION_WEBHOOK_TEST_URL?: string;
  readonly VITE_AUTOMATION_WEBHOOK_PRODUCTION_URL?: string;
  /** Public HTTPS URL for logo image in email previews (matches EMAIL_LOGO_URL when possible) */
  readonly VITE_EMAIL_LOGO_URL?: string;
  /** Comma-separated emails (lowercase) that always see automation technical / developer UI */
  readonly VITE_AUTOMATION_DEVELOPER_EMAILS?: string;
  readonly VITE_COMMUNITY_NAME?: string;
  readonly VITE_COMMUNITY_URL?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
}
