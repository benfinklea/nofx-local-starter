/**
 * Shared Test Setup Module
 * Provides cached mocks and setup utilities to speed up test execution
 *
 * This module implements Strategy 2: Implement Shared Test Context & Setup Caching
 * - Reuses mock instances across tests when appropriate
 * - Reduces object creation overhead
 * - Provides consistent reset patterns
 */

import { jest } from '@jest/globals';

// ============================================================================
// Mock Store Factory
// ============================================================================

export function createMockStore() {
  return {
    createRun: jest.fn().mockResolvedValue({ id: 'run-123' }),
    getRun: jest.fn().mockResolvedValue({ id: 'run-123', status: 'pending' }),
    updateRun: jest.fn().mockResolvedValue({ id: 'run-123', status: 'running' }),
    deleteRun: jest.fn().mockResolvedValue(undefined),

    createStep: jest.fn().mockResolvedValue({ id: 'step-123', status: 'pending' }),
    getStep: jest.fn().mockResolvedValue({ id: 'step-123', status: 'pending' }),
    updateStep: jest.fn().mockResolvedValue({ id: 'step-123', status: 'completed' }),
    listStepsByRun: jest.fn().mockResolvedValue([]),

    createProject: jest.fn().mockResolvedValue({ id: 'project-123' }),
    getProject: jest.fn().mockResolvedValue({ id: 'project-123', name: 'Test Project' }),
    updateProject: jest.fn().mockResolvedValue({ id: 'project-123' }),
    deleteProject: jest.fn().mockResolvedValue(undefined),

    storeArtifact: jest.fn().mockResolvedValue({ path: '/artifacts/test.txt' }),
    getArtifact: jest.fn().mockResolvedValue({ content: 'test content' }),
    listArtifacts: jest.fn().mockResolvedValue([]),

    recordEvent: jest.fn().mockResolvedValue({ id: 'event-123' }),
    listEvents: jest.fn().mockResolvedValue([]),
  };
}

// ============================================================================
// Mock Queue Factory
// ============================================================================

export function createMockQueue() {
  return {
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    process: jest.fn().mockResolvedValue(undefined),
    getJob: jest.fn().mockResolvedValue({ id: 'job-123', data: {} }),
    removeJob: jest.fn().mockResolvedValue(undefined),
    getWaiting: jest.fn().mockResolvedValue([]),
    getActive: jest.fn().mockResolvedValue([]),
    getCompleted: jest.fn().mockResolvedValue([]),
    getFailed: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
  };
}

// ============================================================================
// Mock Logger Factory
// ============================================================================

export function createMockLogger() {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    child: jest.fn().mockReturnThis(),
  };
}

// ============================================================================
// Mock Database Client Factory
// ============================================================================

export function createMockDbClient() {
  return {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: jest.fn().mockResolvedValue(undefined),
    end: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  };
}

// ============================================================================
// Mock Redis Client Factory
// ============================================================================

export function createMockRedisClient() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    hget: jest.fn().mockResolvedValue(null),
    hset: jest.fn().mockResolvedValue(1),
    hdel: jest.fn().mockResolvedValue(1),
    hgetall: jest.fn().mockResolvedValue({}),
    lpush: jest.fn().mockResolvedValue(1),
    rpush: jest.fn().mockResolvedValue(1),
    lpop: jest.fn().mockResolvedValue(null),
    rpop: jest.fn().mockResolvedValue(null),
    lrange: jest.fn().mockResolvedValue([]),
    disconnect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue('OK'),
  };
}

// ============================================================================
// Mock Handler Factory
// ============================================================================

export function createMockHandler(name: string = 'test-handler') {
  return {
    name,
    version: '1.0.0',
    match: jest.fn().mockReturnValue(true),
    run: jest.fn().mockResolvedValue({
      status: 'completed',
      output: { result: 'success' },
    }),
    validate: jest.fn().mockReturnValue(true),
  };
}

// ============================================================================
// Mock Express Request/Response Factory
// ============================================================================

export function createMockExpressRequest(overrides: any = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    method: 'GET',
    url: '/test',
    path: '/test',
    get: jest.fn().mockReturnValue(undefined),
    header: jest.fn().mockReturnValue(undefined),
    ...overrides,
  };
}

export function createMockExpressResponse() {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    sendStatus: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  };
  return res;
}

// ============================================================================
// Shared Mock Cache
// ============================================================================

interface SharedMocksCache {
  store?: ReturnType<typeof createMockStore>;
  queue?: ReturnType<typeof createMockQueue>;
  logger?: ReturnType<typeof createMockLogger>;
  db?: ReturnType<typeof createMockDbClient>;
  redis?: ReturnType<typeof createMockRedisClient>;
}

let cachedMocks: SharedMocksCache = {};

/**
 * Get shared mock instances (creates on first access, reuses thereafter)
 * Use this for read-only mocks that don't need per-test isolation
 */
export function getSharedMocks(): SharedMocksCache {
  if (!cachedMocks.store) cachedMocks.store = createMockStore();
  if (!cachedMocks.queue) cachedMocks.queue = createMockQueue();
  if (!cachedMocks.logger) cachedMocks.logger = createMockLogger();
  if (!cachedMocks.db) cachedMocks.db = createMockDbClient();
  if (!cachedMocks.redis) cachedMocks.redis = createMockRedisClient();

  return cachedMocks;
}

/**
 * Reset all shared mocks (call this in beforeEach)
 * Clears mock call history while keeping the same instances
 */
export function resetSharedMocks() {
  Object.values(cachedMocks).forEach(mock => {
    if (mock && typeof mock === 'object') {
      Object.values(mock).forEach(fn => {
        if (fn && typeof fn === 'object' && 'mockClear' in fn) {
          (fn as jest.Mock).mockClear();
        }
      });
    }
  });
}

/**
 * Completely clear the shared mock cache (rarely needed)
 * Use this only when you need fresh instances
 */
export function clearSharedMocks() {
  cachedMocks = {};
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a fresh mock for tests that need isolation
 * Use this when you need to modify mock behavior for specific tests
 */
export function createFreshMocks() {
  return {
    store: createMockStore(),
    queue: createMockQueue(),
    logger: createMockLogger(),
    db: createMockDbClient(),
    redis: createMockRedisClient(),
  };
}

/**
 * Common test data generators
 */
export const testData = {
  run: (overrides: any = {}) => ({
    id: 'run-123',
    projectId: 'project-123',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  step: (overrides: any = {}) => ({
    id: 'step-123',
    runId: 'run-123',
    name: 'test-step',
    status: 'pending',
    tool: 'codegen',
    inputs: {},
    createdAt: new Date(),
    ...overrides,
  }),

  project: (overrides: any = {}) => ({
    id: 'project-123',
    name: 'Test Project',
    ownerId: 'user-123',
    createdAt: new Date(),
    ...overrides,
  }),

  user: (overrides: any = {}) => ({
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    ...overrides,
  }),
};

/**
 * Wait for condition helper (useful for async tests)
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const result = await Promise.resolve(condition());
    if (result) return;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

/**
 * Delay helper for tests
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
