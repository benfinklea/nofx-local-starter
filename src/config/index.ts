/**
 * Configuration exports
 */

import { APP_CONFIG } from './app';

export { APP_CONFIG };

// Re-export commonly used config values for convenience
export const {
  API_URL,
  APP_URL,
  FRONTEND_URL,
  CORS_ORIGINS,
  STRIPE_URLS,
  AUTH_URLS,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  IS_LOCAL,
} = APP_CONFIG;