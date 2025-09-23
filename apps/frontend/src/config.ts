export const uiFlags = {
  responses: (import.meta.env.VITE_ENABLE_RESPONSES_UI ?? 'false').toLowerCase() === 'true',
  storybookBrand: import.meta.env.VITE_STORYBOOK_BRAND ?? 'NOFX',
};

export const apiBase = import.meta.env.VITE_API_BASE ?? '';
