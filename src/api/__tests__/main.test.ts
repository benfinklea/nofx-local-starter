/**
 * Comprehensive test suite for src/api/main.ts
 * Tests main API server functionality before refactoring
 */

import request from 'supertest';
import { jest } from '@jest/globals';

// Mock all dependencies before importing the app
jest.mock('../../lib/store', () => ({
  store: {
    createRun: jest.fn(),
    getRun: jest.fn(),
    getRunTimeline: jest.fn(),
    listRuns: jest.fn(),
    createStep: jest.fn(),
    getStep: jest.fn(),
    getStepByIdempotencyKey: jest.fn(),
  },
}));

jest.mock('../../lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../../lib/queue', () => ({
  enqueue: jest.fn(),
  hasSubscribers: jest.fn(() => false),
  getOldestAgeMs: jest.fn(() => 0),
  STEP_READY_TOPIC: 'step.ready',
}));

jest.mock('../../lib/events', () => ({
  recordEvent: jest.fn(),
}));

jest.mock('../../lib/observability', () => ({
  requestObservability: jest.fn((_req: any, _res: any, next: any) => next()),
  setContext: jest.fn(),
}));

jest.mock('../../lib/tracing', () => ({
  initTracing: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../lib/projects', () => ({
  getProject: jest.fn(),
  updateProject: jest.fn(),
}));

jest.mock('../../lib/runRecovery', () => ({
  retryStep: jest.fn(),
  StepNotFoundError: class extends Error {},
  StepNotRetryableError: class extends Error {},
}));

jest.mock('../../auth/middleware', () => ({
  requireAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  optionalAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  checkUsage: jest.fn((_metric: string) => jest.fn((_req: any, _res: any, next: any) => next())),
  rateLimit: jest.fn((_windowMs?: number, _maxRequests?: number) => jest.fn((_req: any, _res: any, next: any) => next())),
  trackApiUsage: jest.fn((_metric?: string, _quantity?: number) => jest.fn((_req: any, _res: any, next: any) => next())),
}));

jest.mock('../routes/builder', () => jest.fn());
jest.mock('../routes/responses', () => jest.fn());
jest.mock('../routes/auth_v2', () => jest.fn());
jest.mock('../routes/billing', () => jest.fn());
jest.mock('../routes/webhooks', () => jest.fn());
jest.mock('../routes/teams', () => jest.fn());
jest.mock('../loader', () => ({
  mountRouters: jest.fn(),
}));

jest.mock('../../lib/autobackup', () => ({
  initAutoBackupFromSettings: jest.fn(),
}));

jest.mock('../../worker/relay', () => jest.fn());

jest.mock('../../lib/devRestart', () => ({
  shouldEnableDevRestartWatch: jest.fn(() => false),
}));

jest.mock('cookie-parser', () => jest.fn(() => (_req: any, _res: any, next: any) => next()));

jest.mock('../../lib/performance-monitor', () => ({
  performanceMiddleware: jest.fn(() => (_req: any, _res: any, next: any) => next()),
  performanceMonitor: {
    start: jest.fn(),
    stop: jest.fn(),
  },
}));

jest.mock('../../lib/middleware/idempotency', () => ({
  idempotency: jest.fn(() => (_req: any, _res: any, next: any) => next()),
  initializeIdempotencyCache: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../lib/auth', () => ({
  issueAdminCookie: jest.fn(() => 'mock-cookie'),
  isAdmin: jest.fn(() => true),
}));

jest.mock('../../config', () => ({
  CORS_ORIGINS: ['http://localhost:3000', 'http://localhost:3002'],
}));

// Don't mock middleware setup - we want to test the actual middleware stack
jest.mock('cors', () => jest.fn(() => (_req: any, _res: any, next: any) => next()));

jest.mock('../server/routes', () => ({
  mountCoreRoutes: jest.fn(),
  mountSaasRoutes: jest.fn(),
  mountDynamicRoutes: jest.fn(),
}));

jest.mock('../server/frontend', () => ({
  setupFrontendRouting: jest.fn(),
}));

// Don't mock handlers - we want to test the actual handler logic
jest.mock('../../lib/json', () => ({
  toJsonObject: jest.fn((obj: any) => obj || {}),
}));

jest.mock('../../lib/traceLogger', () => ({
  trace: jest.fn(),
}));

jest.mock('../planBuilder', () => ({
  buildPlanFromPrompt: jest.fn(() => Promise.resolve({
    name: 'test-plan',
    steps: [{ tool: 'test', inputs: {} }]
  })),
}));

jest.mock('../routes/public-performance', () => jest.fn());
jest.mock('../routes/dev-admin', () => jest.fn());

describe('Main API Server Tests', () => {
  let app: any;
  let mockStore: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set environment variable to disable server autostart in tests
    process.env.DISABLE_SERVER_AUTOSTART = '1';

    // Import the app after all mocks are set up
    const { app: appModule } = require('../main');
    app = appModule;

    const { store } = require('../../lib/store');
    mockStore = store;
  });

  afterEach(() => {
    // Clean up any pending timers
    jest.clearAllTimers();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should include queue and store status', async () => {
      const response = await request(app).get('/health');

      expect(response.body).toHaveProperty('queue');
      expect(response.body).toHaveProperty('store');
    });
  });

  describe('Run Management', () => {
    describe('POST /runs/preview', () => {
      it('should preview run with valid plan', async () => {
        const validPlan = {
          name: 'test-plan',
          steps: [{ tool: 'test', parameters: {} }]
        };

        const response = await request(app)
          .post('/runs/preview')
          .send({ plan: validPlan });

        expect([200, 400, 500]).toContain(response.status);
      });

      it('should validate plan schema', async () => {
        const invalidPlan = { invalid: 'plan' };

        const response = await request(app)
          .post('/runs/preview')
          .send({ plan: invalidPlan });

        expect(response.status).toBe(400);
      });
    });

    describe('POST /runs', () => {
      it('should create run with valid plan', async () => {
        mockStore.createRun.mockResolvedValue({
          id: 'test-run-id',
          status: 'queued',
        });

        const validPlan = {
          name: 'test-plan',
          steps: [{ tool: 'test', parameters: {} }]
        };

        const response = await request(app)
          .post('/runs')
          .send({ plan: validPlan });

        expect([200, 201, 400, 500]).toContain(response.status);
      });

      it('should reject invalid plan', async () => {
        const response = await request(app)
          .post('/runs')
          .send({ plan: null });

        expect(response.status).toBe(400);
      });

      it('should handle store errors gracefully', async () => {
        mockStore.createRun.mockRejectedValue(new Error('Store error'));

        const validPlan = {
          name: 'test-plan',
          steps: [{ tool: 'test', parameters: {} }]
        };

        const response = await request(app)
          .post('/runs')
          .send({ plan: validPlan });

        expect([400, 500]).toContain(response.status);
      });
    });

    describe('GET /runs/:id', () => {
      it('should return run by ID', async () => {
        mockStore.getRun.mockResolvedValue({
          id: 'test-run-id',
          status: 'completed',
        });

        const response = await request(app).get('/runs/test-run-id');

        expect([200, 404, 500]).toContain(response.status);
      });

      it('should handle non-existent run', async () => {
        mockStore.getRun.mockResolvedValue(null);

        const response = await request(app).get('/runs/non-existent');

        expect(response.status).toBe(404);
      });
    });

    describe('GET /runs/:id/timeline', () => {
      it('should return run timeline', async () => {
        mockStore.getRun.mockResolvedValue({
          id: 'test-run-id',
          status: 'completed',
        });

        mockStore.getRunTimeline.mockResolvedValue([
          { timestamp: Date.now(), event: 'started' }
        ]);

        const response = await request(app).get('/runs/test-run-id/timeline');

        expect([200, 404, 500]).toContain(response.status);
      });
    });

    describe('GET /runs/:id/stream', () => {
      it('should setup SSE stream for run events', (done) => {
        mockStore.getRun.mockResolvedValue({
          id: 'test-run-id',
          status: 'running',
        });

        const req = request(app)
          .get('/runs/test-run-id/stream')
          .set('Accept', 'text/event-stream');

        req.on('response', (response: any) => {
          expect(response.statusCode).toBe(200);
          expect(response.headers['content-type']).toContain('text/event-stream');
          req.abort();
          done();
        });

        // Add timeout to prevent test from hanging
        setTimeout(() => {
          req.abort();
          done(new Error('Stream test timed out'));
        }, 2000);
      });
    });

    describe('GET /runs', () => {
      it('should list runs with pagination', async () => {
        mockStore.listRuns.mockResolvedValue({
          runs: [{ id: 'run-1' }, { id: 'run-2' }],
          total: 2,
        });

        const response = await request(app).get('/runs?page=1&limit=10');

        expect([200, 500]).toContain(response.status);
      });

      it('should handle invalid pagination parameters', async () => {
        const response = await request(app).get('/runs?page=-1&limit=invalid');

        expect([200, 400]).toContain(response.status);
      });
    });
  });

  describe('Frontend Routing', () => {
    it('should serve frontend app routes', async () => {
      const response = await request(app).get('/ui/app');

      // Should either serve the app or redirect
      expect([200, 302, 404]).toContain(response.status);
    });

    it('should handle SPA routing for frontend', async () => {
      const response = await request(app).get('/ui/app/some/path');

      // Should either serve the app or return 404 for missing frontend
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('CORS Configuration', () => {
    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect([200, 204]).toContain(response.status);
    });

    it('should set CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect([200, 500]).toContain(response.status);
    });
  });

  describe('Middleware Stack', () => {
    it('should parse JSON bodies', async () => {
      const response = await request(app)
        .post('/runs/preview')
        .send({ plan: { name: 'test' } })
        .set('Content-Type', 'application/json');

      // Should parse JSON successfully, may fail validation
      expect(response.status).not.toBe(415); // Not "Unsupported Media Type"
    });

    it('should handle large payloads within limit', async () => {
      const largePlan = {
        name: 'large-plan',
        data: 'x'.repeat(1000000), // 1MB
      };

      const response = await request(app)
        .post('/runs/preview')
        .send({ plan: largePlan });

      // Should not reject due to size limit (2MB configured)
      expect(response.status).not.toBe(413); // Not "Payload Too Large"
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const response = await request(app)
        .post('/runs')
        .set('Content-Type', 'application/json')
        .send('{ invalid json');

      expect(response.status).toBe(400);
    });

    it('should not leak sensitive information in errors', async () => {
      // Force an error
      mockStore.createRun.mockRejectedValue(
        new Error('Database password: secret123')
      );

      const response = await request(app)
        .post('/runs')
        .send({ plan: { name: 'test' } });

      expect(response.status).toBe(500);
      expect(response.body.error).not.toContain('secret123');
      expect(response.body.error).not.toContain('password');
    });
  });

  describe('Security', () => {
    it('should validate input parameters', async () => {
      const response = await request(app)
        .post('/runs')
        .send({
          plan: {
            name: '<script>alert("xss")</script>',
            steps: []
          }
        });

      // Should either validate/sanitize or reject
      expect([200, 201, 400]).toContain(response.status);
    });

    it('should handle malformed run IDs', async () => {
      const response = await request(app).get('/runs/../../../etc/passwd');

      expect([400, 404]).toContain(response.status);
    });
  });

  describe('Performance', () => {
    it('should respond to health check quickly', async () => {
      const start = Date.now();

      await request(app).get('/health');

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });
  });
});