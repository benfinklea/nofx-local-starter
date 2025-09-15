import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load test environment
dotenv.config({ path: '.env.test' });

// Ensure queue tests use Redis adapter (mocks);
process.env.QUEUE_DRIVER = process.env.QUEUE_DRIVER || 'redis';

// Global test utilities
global.testUtils = {
  // Database cleanup between tests
  async cleanDatabase() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await pool.query('TRUNCATE nofx.run, nofx.step, nofx.artifact, nofx.event CASCADE');
    } finally {
      await pool.end();
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

// Global error handler for unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection in test:', err);
  process.exit(1);
});
