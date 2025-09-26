export const uiFlags = {
  responses: (import.meta.env.VITE_ENABLE_RESPONSES_UI ?? 'false').toLowerCase() === 'true',
  storybookBrand: import.meta.env.VITE_STORYBOOK_BRAND ?? 'NOFX',
};

// In production (Vercel), use relative paths
// In development, can set VITE_API_BASE to point to local or remote API
export const apiBase = import.meta.env.VITE_API_BASE ?? '';