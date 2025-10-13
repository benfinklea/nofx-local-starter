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
(http.Server.prototype.listen as any) = function patchedListen(this: any, port?: any, ...args: any[]) {
  // When called with only a port (or port + callback), insert localhost host.
  if (typeof port === 'number') {
    if (args.length === 0) {
      return (originalListen as any).call(this, port, '127.0.0.1');
    }
    if (typeof args[0] === 'function') {
      const callback = args[0];
      return (originalListen as any).call(this, port, '127.0.0.1', callback);
    }
  }
  return (originalListen as any).call(this, port, ...args);
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
(global as any).testUtils = {
  // Database cleanup between tests with retry
  async cleanDatabase() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await pool.query('TRUNCATE nofx.run, nofx.step, nofx.artifact, nofx.event CASCADE');
        break; // Success
      } catch (err) {
        if (attempt === maxRetries) {
          // Ignore cleanup failures when the database is not available in CI
          if (process.env.CI) {
            console.warn('Skipping DB cleanup: database unavailable');
          } else {
            console.error('Database cleanup failed:', err);
          }
        } else {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        }
      }
    }

    try {
      await pool.end();
    } catch (err) {
      // Ignore pool end errors
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
  },

  // Wait for condition with timeout
  async waitFor(condition: () => boolean | Promise<boolean>, timeoutMs = 5000, intervalMs = 100): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (await Promise.resolve(condition())) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    throw new Error(`Condition not met within ${timeoutMs}ms`);
  },

  // Flush all pending promises
  async flushPromises(): Promise<void> {
    await new Promise(resolve => setImmediate(resolve));
  }
};

// Increase timeout for CI/CD environments
if (process.env.CI) {
  jest.setTimeout(60000);
}

// Retry failed tests automatically to reduce flakiness
// Retry twice in CI, no retry locally
jest.retryTimes(process.env.CI ? 2 : 0);

// Mock external services by default
// Create a storage map to track uploaded files
const mockStorageMap = new Map<string, Buffer>();
// Export globally for test access
(global as any).mockStorageMap = mockStorageMap;

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockImplementation(async (path: string, content: Buffer) => {
          // Store the uploaded content
          mockStorageMap.set(path, content);
          return { error: null };
        }),
        download: jest.fn().mockImplementation(async (path: string) => {
          // Return the stored content if it exists
          const data = mockStorageMap.get(path);
          if (data) {
            return { data, error: null };
          }
          // Return 404-like error if not found
          return {
            data: null,
            error: { message: 'Object not found', statusCode: '404' }
          };
        })
      }))
    }
  },
  ARTIFACT_BUCKET: 'test-artifacts'
}));

// Mock Claude Agent SDK to avoid ES module parsing issues
// Session memory store for testing
const sessionMemory = new Map<string, string[]>();

jest.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: jest.fn().mockImplementation(function* ({ prompt, options }) {
    const model = options?.model || 'claude-sonnet-4-5';
    const sessionId = options?.resume;

    // Validate model (simulate API behavior)
    const validModels = [
      'claude-sonnet-4-5',
      'claude-sonnet-4',
      'claude-opus-4',
      'claude-haiku-3-5',
    ];

    if (!validModels.includes(model)) {
      throw new Error(`Invalid model: ${model}. Must be one of: ${validModels.join(', ')}`);
    }

    // Build response with session memory
    let responseText = 'Mock SDK response';

    if (sessionId) {
      // Get previous messages from session
      const history = sessionMemory.get(sessionId) || [];

      // Store current prompt
      history.push(prompt);
      sessionMemory.set(sessionId, history);

      // Check if this is a follow-up question about previous messages
      const lowerPrompt = prompt.toLowerCase();
      if (lowerPrompt.includes('previous') || lowerPrompt.includes('remember') || lowerPrompt.includes('what did i') || lowerPrompt.includes('what was')) {
        // Extract information from previous messages
        for (const prevMsg of history) {
          // Look for numbers in previous messages
          const numberMatch = prevMsg.match(/\d+/);
          if (numberMatch) {
            responseText = `The number was ${numberMatch[0]}`;
            break;
          }
        }
      } else if (lowerPrompt.includes('remember this number')) {
        // Acknowledge remembering
        const numberMatch = prompt.match(/\d+/);
        responseText = numberMatch ? `Acknowledged, I will remember ${numberMatch[0]}` : 'Acknowledged';
      }
    }

    yield {
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: responseText }]
      },
      uuid: 'mock-uuid',
      session_id: sessionId || 'mock-session'
    };
    yield {
      type: 'result',
      usage: {
        input_tokens: 100,
        output_tokens: 50
      },
      total_cost_usd: 0.001,
      uuid: 'mock-result-uuid',
      session_id: sessionId || 'mock-session'
    };
  })
}));

// Cleanup after each test with retry
afterEach(async () => {
  jest.clearAllMocks();
  // Note: We do NOT clear mockStorageMap here because some tests
  // rely on artifacts persisting across test cases within the same suite

  if (process.env.INTEGRATION_TEST) {
    // Retry database cleanup up to 3 times
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await (global as any).testUtils.cleanDatabase();
        break;
      } catch (err) {
        if (attempt === 3) {
          console.warn('Database cleanup failed after 3 attempts');
        } else {
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        }
      }
    }
  }

  // Give time for async operations to complete
  await new Promise(resolve => setImmediate(resolve));
});

afterAll(async () => {
  // Clean up database connection pools with retry
  try {
    const registry: Set<any> | undefined = (globalThis as any).__NOFX_TEST_POOLS__;
    if (registry && registry.size) {
      const cleanupPromises = Array.from(registry).map(async (pool) => {
        if (pool && typeof pool.end === 'function') {
          // Retry pool cleanup
          for (let attempt = 1; attempt <= 3; attempt++) {
            let timeoutHandle: NodeJS.Timeout | null = null;
            try {
              await Promise.race([
                Promise.resolve(pool.end()),
                new Promise((_, reject) => {
                  timeoutHandle = setTimeout(() => reject(new Error('Pool cleanup timeout')), 5000);
                })
              ]);
              if (timeoutHandle) clearTimeout(timeoutHandle);
              break;
            } catch (err) {
              if (timeoutHandle) clearTimeout(timeoutHandle);
              if (attempt === 3) {
                console.warn('Pool cleanup failed:', err);
              } else {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }
          }
        }
      });

      await Promise.allSettled(cleanupPromises);
      registry.clear();
    }
  } catch (err) {
    console.warn('Error during pool cleanup:', err);
  }

  // Final flush of pending operations
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Global error handler for unhandled rejections (with debouncing)
let unhandledRejectionTimeout: NodeJS.Timeout | null = null;
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection in test:', err);

  // Debounce the exit to allow cleanup
  if (unhandledRejectionTimeout) {
    clearTimeout(unhandledRejectionTimeout);
  }

  unhandledRejectionTimeout = setTimeout(() => {
    process.exit(1);
  }, 100);
});
