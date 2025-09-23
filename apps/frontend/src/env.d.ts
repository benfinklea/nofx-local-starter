/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_ENABLE_RESPONSES_UI?: string;
  readonly VITE_STORYBOOK_BRAND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
