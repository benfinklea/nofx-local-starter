import dotenv from 'dotenv';
import { Pool } from 'pg';
import http from 'node:http';

// Load test environment
dotenv.config({ path: '.env.test' });

// Default to in-memory queue to avoid external Redis during tests
process.env.QUEUE_DRIVER = process.env.QUEUE_DRIVER || 'redis';
process.env.DISABLE_INLINE_RUNNER = '1';
// Use filesystem-backed store during tests to avoid external DB dependency
process.env.DATA_DRIVER = process.env.DATA_DRIVER || 'fs';
process.env.DISABLE_REDIS_STRESS = '1';
// Prevent API server from auto-starting during tests (causes port conflicts)
process.env.DISABLE_SERVER_AUTOSTART = '1';

jest.mock('supertest', () => {
  const mock = require('./helpers/mockSupertest');
  return mock;
});

// Force HTTP servers created during tests (e.g., via supertest) to bind to
// 127.0.0.1 instead of 0.0.0.0, which is blocked by the sandbox.
const originalListen = http.Server.prototype.listen;
http.Server.prototype.listen = function patchedListen(port?: any, ...args: any[]) {
  // When called with only a port (or port + callback), insert localhost host.
  if (typeof port === 'number') {
    if (args.length === 0) {
      return originalListen.call(this, port, '127.0.0.1');
    }
    if (typeof args[0] === 'function') {
      const callback = args[0];
      return originalListen.call(this, port, '127.0.0.1', callback);
    }
  }
  return originalListen.call(this, port, ...args);
};

// Prevent real Redis connections during tests unless explicitly overridden
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    const client: any = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG'),
      duplicate: jest.fn().mockImplementation(() => client),
      subscribe: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockResolvedValue(0),
      lpush: jest.fn().mockResolvedValue(1),
      lrange: jest.fn().mockResolvedValue([]),
      del: jest.fn().mockResolvedValue(0)
    };
    return client;
  });
});


// Global test utilities
global.testUtils = {
  // Database cleanup between tests
  async cleanDatabase() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await pool.query('TRUNCATE nofx.run, nofx.step, nofx.artifact, nofx.event CASCADE');
    } catch (err) {
      // Ignore cleanup failures when the database is not available in CI
      if (process.env.CI) {
        console.warn('Skipping DB cleanup: database unavailable');
      }
    } finally {
      await pool.end().catch(() => {});
    }
  },

  // Generate random test data
  generateTestData() {
    const crypto = require('crypto');
    return {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      random: Math.random()
    };
  }
};

// Increase timeout for CI/CD environments
if (process.env.CI) {
  jest.setTimeout(60000);
}

// Mock external services by default
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ error: null }),
        download: jest.fn().mockResolvedValue({ data: Buffer.from('test'), error: null })
      }))
    }
  },
  ARTIFACT_BUCKET: 'test-artifacts'
}));

// Cleanup after each test
afterEach(async () => {
  jest.clearAllMocks();
  if (process.env.INTEGRATION_TEST) {
    await global.testUtils.cleanDatabase();
  }
});

afterAll(async () => {
  try {
    const registry: Set<any> | undefined = (globalThis as any).__NOFX_TEST_POOLS__;
    if (registry && registry.size) {
      for (const pool of registry) {
        if (pool && typeof pool.end === 'function') {
          await Promise.resolve(pool.end()).catch(() => {});
        }
      }
      registry.clear();
    }
  } catch {}
});

// Global error handler for unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection in test:', err);
  process.exit(1);
});
