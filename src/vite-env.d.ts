/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL (Settings → API). */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon/public key (Settings → API). Safe for browser use with RLS. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Google Gemini API key — used by Photo Scan OCR in the browser. */
  readonly VITE_GEMINI_API_KEY?: string;
  /** Optional: override OCR model (default gemini-2.5-flash) */
  readonly VITE_GEMINI_OCR_MODEL?: string;
  /** Optional: max long-edge pixels before OCR (default 1600 — lowers vision token cost). */
  readonly VITE_GEMINI_OCR_MAX_EDGE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
