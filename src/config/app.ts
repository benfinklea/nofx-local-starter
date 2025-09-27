/**
 * Central Application Configuration
 * Handles environment detection and URL management for all platforms
 */

/**
 * Detects the base URL based on the deployment platform
 */
function getBaseUrl(): string {
  // Vercel deployment
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Railway deployment
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }

  // Render deployment
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }

  // Custom API URL override
  if (process.env.API_URL) {
    return process.env.API_URL;
  }

  // Local development fallback
  return 'http://localhost:3000';
}

/**
 * Gets the frontend URL for the current environment
 */
function getFrontendUrl(): string {
  // Explicit frontend URL
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }

  // Vercel preview deployment
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Local development
  return 'http://localhost:5173';
}

/**
 * Application configuration based on environment
 */
export const APP_CONFIG = {
  // Core URLs
  API_URL: getBaseUrl(),
  APP_URL: process.env.APP_URL || getBaseUrl(),
  FRONTEND_URL: getFrontendUrl(),
  PORT: Number(process.env.PORT) || 3000,

  // Environment detection
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_VERCEL: !!process.env.VERCEL,
  IS_RAILWAY: !!process.env.RAILWAY_ENVIRONMENT,
  IS_RENDER: !!process.env.RENDER,
  IS_LOCAL: !process.env.VERCEL && !process.env.RAILWAY_ENVIRONMENT && !process.env.RENDER,

  // CORS origins - automatically include frontend and app URLs
  CORS_ORIGINS: [
    getFrontendUrl(),
    getBaseUrl(),
    'http://localhost:5173', // Local frontend dev
    'http://localhost:3000', // Local API dev
    ...(process.env.CORS_ORIGINS?.split(',').map(url => url.trim()) || []),
  ].filter((url, index, array) => url && array.indexOf(url) === index), // Remove duplicates

  // Stripe URLs for billing
  STRIPE_URLS: {
    SUCCESS: `${process.env.APP_URL || getBaseUrl()}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    CANCEL: `${process.env.APP_URL || getBaseUrl()}/billing/plans`,
    RETURN: `${process.env.APP_URL || getBaseUrl()}/billing`,
  },

  // Auth URLs
  AUTH_URLS: {
    PASSWORD_RESET: `${process.env.APP_URL || getBaseUrl()}/auth/update-password`,
  },
} as const;

// Log configuration in development for debugging
if (process.env.NODE_ENV === 'development') {
  // Use proper logging instead of console.log
  const { log } = require('../lib/observability');
  log.info({
    API_URL: APP_CONFIG.API_URL,
    FRONTEND_URL: APP_CONFIG.FRONTEND_URL,
    IS_LOCAL: APP_CONFIG.IS_LOCAL,
    IS_VERCEL: APP_CONFIG.IS_VERCEL,
    CORS_ORIGINS: APP_CONFIG.CORS_ORIGINS,
  }, '🔧 App Configuration initialized');
}