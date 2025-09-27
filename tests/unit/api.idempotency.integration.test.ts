import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/api/main';
import { store } from '../../src/lib/store';

// Mock dependencies
jest.mock('../../src/lib/queue', () => ({
  enqueue: jest.fn(),
  STEP_READY_TOPIC: 'step.ready',
  hasSubscribers: jest.fn(() => true),
  getOldestAgeMs: jest.fn(() => 0)
}));

jest.mock('../../src/lib/events', () => ({
  recordEvent: jest.fn()
}));

jest.mock('../../src/lib/observability', () => ({
  requestObservability: (req: any, res: any, next: any) => next(),
  setContext: jest.fn(),
  getContext: jest.fn(() => ({
    correlationId: 'test-correlation-123',
    requestId: 'test-request-456'
  })),
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../src/auth/middleware', () => ({
  optionalAuth: (req: any, res: any, next: any) => next(),
  requireAuth: (req: any, res: any, next: any) => next(),
  checkUsage: jest.fn(),
  rateLimit: jest.fn(),
  trackApiUsage: jest.fn()
}));

jest.mock('../../src/lib/auth', () => ({
  isAdmin: jest.fn(() => true)
}));

jest.mock('../../src/lib/projects', () => ({
  getProject: jest.fn(() => ({ id: 'test-project', name: 'Test Project' })),
  updateProject: jest.fn()
}));

// Mock database with basic functionality
const mockQuery = jest.fn();
jest.mock('../../src/lib/db', () => ({
  query: mockQuery
}));

describe('API Idempotency Integration', () => {
  let testIdempotencyKey: string;

  beforeAll(async () => {
    // Mock store initialization
    jest.spyOn(store, 'getPlans').mockResolvedValue([]);
    jest.spyOn(store, 'createRun').mockResolvedValue({
      id: 'run_123',
      status: 'queued',
      plan: null,
      created_at: new Date().toISOString()
    });
    jest.spyOn(store, 'createStep').mockResolvedValue({
      id: 'step_123',
      run_id: 'run_123',
      name: 'test_step',
      tool: 'test_tool',
      inputs: {},
      status: 'queued',
      created_at: new Date().toISOString(),
      idempotency_key: 'test_key'
    });
    jest.spyOn(store, 'getStepByIdempotencyKey').mockResolvedValue(null);
    jest.spyOn(store, 'getStep').mockResolvedValue({
      id: 'step_123',
      run_id: 'run_123',
      name: 'test_step',
      tool: 'test_tool',
      inputs: {},
      status: 'queued',
      created_at: new Date().toISOString()
    });

    // Mock successful idempotency cache table creation
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    testIdempotencyKey = `test_${randomUUID()}`;

    // Reset mock implementations
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  describe('POST /runs', () => {
    const testPlan = {
      goal: 'Test goal',
      steps: [
        {
          name: 'test_step',
          tool: 'test_tool',
          inputs: { message: 'Hello World' }
        }
      ]
    };

    it('should handle idempotent run creation', async () => {
      const firstResponse = await request(app)
        .post('/runs')
        .set('X-Idempotency-Key', testIdempotencyKey)
        .send(testPlan)
        .expect(200);

      expect(firstResponse.body.run).toBeDefined();
      expect(firstResponse.body.run.id).toBe('run_123');

      // Verify cache was queried for subsequent request
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining(['local', testIdempotencyKey, 'POST', '/runs'])
      );
    });

    it('should replay cached response for duplicate requests', async () => {
      // Mock cached response
      const cachedResponse = {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: {
          run: { id: 'cached_run_456', status: 'queued' },
          cached: true
        },
        created_at: '2025-01-01T00:00:00Z'
      };

      mockQuery.mockImplementation((query: string) => {
        if (query.includes('SELECT')) {
          return Promise.resolve({ rows: [cachedResponse] });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      const response = await request(app)
        .post('/runs')
        .set('X-Idempotency-Key', testIdempotencyKey)
        .send(testPlan)
        .expect(200);

      expect(response.body).toEqual(cachedResponse.body);
      expect(response.headers['x-idempotency-replayed']).toBe('true');
      expect(response.headers['x-idempotency-original-date']).toBe(cachedResponse.created_at);
    });
  });

  describe('POST /runs/preview', () => {
    const testInput = {
      goal: 'Test preview goal',
      steps: []
    };

    it('should support idempotency for preview requests', async () => {
      await request(app)
        .post('/runs/preview')
        .set('X-Idempotency-Key', testIdempotencyKey)
        .send(testInput)
        .expect(200);

      // Verify idempotency cache was queried
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining(['local', testIdempotencyKey, 'POST', '/runs/preview'])
      );
    });
  });

  describe('POST /runs/:runId/steps/:stepId/retry', () => {
    it('should support idempotency for retry requests', async () => {
      const runId = 'run_123';
      const stepId = 'step_456';

      // Mock retryStep function
      const { retryStep } = require('../../src/lib/runRecovery');
      jest.spyOn(require('../../src/lib/runRecovery'), 'retryStep').mockResolvedValue(undefined);

      await request(app)
        .post(`/runs/${runId}/steps/${stepId}/retry`)
        .set('X-Idempotency-Key', testIdempotencyKey)
        .send({})
        .expect(202);

      // Verify idempotency cache was queried
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining(['local', testIdempotencyKey, 'POST', `/runs/${runId}/steps/${stepId}/retry`])
      );
    });
  });

  describe('Idempotency Key Validation', () => {
    it('should reject invalid idempotency keys', async () => {
      const testPlan = {
        goal: 'Test goal',
        steps: []
      };

      await request(app)
        .post('/runs')
        .set('X-Idempotency-Key', 'invalid@key!')
        .send(testPlan)
        .expect(400)
        .expect((res) => {
          expect(res.body.title).toBe('Invalid Idempotency Key');
          expect(res.body.detail).toContain('invalid characters');
        });
    });

    it('should accept valid idempotency keys', async () => {
      const testPlan = {
        goal: 'Test goal',
        steps: []
      };

      const validKey = 'valid_key_12345';

      await request(app)
        .post('/runs')
        .set('X-Idempotency-Key', validKey)
        .send(testPlan)
        .expect(200);
    });
  });

  describe('CORS Headers', () => {
    it('should include idempotency headers in CORS response', async () => {
      const response = await request(app)
        .options('/runs')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'x-idempotency-key')
        .expect(204);

      const allowedHeaders = response.headers['access-control-allow-headers'];
      const exposedHeaders = response.headers['access-control-expose-headers'];

      expect(allowedHeaders).toContain('x-idempotency-key');
      expect(exposedHeaders).toContain('x-idempotency-replayed');
      expect(exposedHeaders).toContain('x-idempotency-original-date');
    });
  });

  describe('Error Handling', () => {
    it('should continue processing when idempotency cache fails', async () => {
      // Mock cache failure
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      const testPlan = {
        goal: 'Test goal with cache failure',
        steps: []
      };

      await request(app)
        .post('/runs')
        .set('X-Idempotency-Key', testIdempotencyKey)
        .send(testPlan)
        .expect(200);

      // Should still process the request despite cache failure
      expect(store.createRun).toHaveBeenCalled();
    });
  });

  describe('Non-Idempotent Methods', () => {
    it('should not apply idempotency to GET requests', async () => {
      await request(app)
        .get('/runs')
        .set('X-Idempotency-Key', testIdempotencyKey)
        .expect(200);

      // Should not query idempotency cache for GET requests
      const cacheQueries = mockQuery.mock.calls.filter(call =>
        call[0] && call[0].includes('idempotency_cache')
      );
      expect(cacheQueries).toHaveLength(0);
    });
  });
});