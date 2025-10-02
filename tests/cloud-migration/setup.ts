/**
 * Test setup for cloud migration tests
 */

import dotenv from 'dotenv';
import { beforeAll, afterAll } from '@jest/globals';

// Load environment variables for tests
dotenv.config({ path: '.env.test' });

// Set test timeouts
jest.setTimeout(30000);

// Global setup
beforeAll(async () => {
  console.log('🛡️ Starting Cloud Migration Bulletproof Tests');
  console.log(`📍 Testing against: ${process.env.PROD_URL || 'https://nofx-local-starter.vercel.app'}`);
  console.log(`🔍 Environment: ${process.env.NODE_ENV || 'test'}`);
});

// Global teardown
afterAll(async () => {
  console.log('✅ Cloud Migration Tests Complete');
});

// Suppress console errors during tests unless debugging
if (!process.env.DEBUG) {
  global.console.error = jest.fn();
  global.console.warn = jest.fn();
}

// Add custom matchers
expect.extend({
  toBeHealthy(received) {
    const pass = received === 'healthy' || received === 'ok';
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be healthy`
          : `expected ${received} to be healthy`
    };
  },
  toBeValidUrl(received) {
    try {
      new URL(received);
      return {
        pass: true,
        message: () => `expected ${received} not to be a valid URL`
      };
    } catch {
      return {
        pass: false,
        message: () => `expected ${received} to be a valid URL`
      };
    }
  },
  toBeWithinResponseTime(received, maxTime) {
    const pass = received <= maxTime;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received}ms to be greater than ${maxTime}ms`
          : `expected ${received}ms to be less than or equal to ${maxTime}ms`
    };
  }
});