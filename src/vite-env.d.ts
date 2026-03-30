/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_POSTHOG_UI_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
