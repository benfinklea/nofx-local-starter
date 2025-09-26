/**
 * Smoke Tests - Quick verification that all systems are operational
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../src/api/main';
import { pool } from '../src/lib/db';
import { store } from '../src/lib/store';
import { validateEnvironment } from '../src/validation/schemas';

describe('Smoke Tests - System Health', () => {
  beforeAll(async () => {
    // Validate environment on startup
    try {
      validateEnvironment();
    } catch (error) {
      console.error('Environment validation failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Core Services', () => {
    it('should have database connectivity', async () => {
      const result = await pool.query('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);
    });

    it('should have health endpoint responding', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.database.status).toBe('ok');
    });

    it('should have proper error handling', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      expect(response.body.error).toBeDefined();
      expect(response.body.code).toBeDefined();
    });
  });

  describe('Store Operations', () => {
    let testRunId: string;

    it('should create a run', async () => {
      const run = await store.createRun(
        { steps: [], goal: 'test' },
        'test-project'
      );

      expect(run).toBeDefined();
      expect(run.id).toBeDefined();
      expect(run.status).toBe('queued');

      testRunId = run.id;
    });

    it('should retrieve a run', async () => {
      const run = await store.getRun(testRunId);

      expect(run).toBeDefined();
      expect(run?.id).toBe(testRunId);
    });

    it('should create a step', async () => {
      const step = await store.createStep(
        testRunId,
        'test-step',
        'test-tool',
        { test: true }
      );

      expect(step).toBeDefined();
      expect(step?.run_id).toBe(testRunId);
      expect(step?.status).toBe('queued');
    });

    it('should handle idempotency', async () => {
      const idempotencyKey = 'test-key-' + Date.now();

      const step1 = await store.createStep(
        testRunId,
        'idempotent-step',
        'test-tool',
        { test: true },
        idempotencyKey
      );

      const step2 = await store.createStep(
        testRunId,
        'idempotent-step',
        'test-tool',
        { test: true },
        idempotencyKey
      );

      expect(step1?.id).toBe(step2?.id);
    });

    it('should record events', async () => {
      await store.recordEvent(testRunId, 'test.event', { data: 'test' });

      const events = await store.listEvents(testRunId);
      expect(events.length).toBeGreaterThan(0);

      const testEvent = events.find(e => e.type === 'test.event');
      expect(testEvent).toBeDefined();
      expect(testEvent?.payload).toEqual({ data: 'test' });
    });

    it('should handle gates', async () => {
      const step = await store.createStep(
        testRunId,
        'gated-step',
        'test-tool'
      );

      if (step) {
        const gate = await store.createOrGetGate(
          testRunId,
          step.id,
          'manual'
        );

        expect(gate).toBeDefined();
        expect(gate?.status).toBe('pending');
      }
    });
  });

  describe('Repository Pattern', () => {
    it('should have working RunRepository', async () => {
      const { RunRepository } = require('../src/repositories/RunRepository');
      const repo = new RunRepository();

      const run = await repo.create(
        { steps: [], goal: 'repo test' },
        'test'
      );

      expect(run).toBeDefined();
      expect(run.id).toBeDefined();
    });

    it('should have working StepRepository', async () => {
      const { StepRepository } = require('../src/repositories/StepRepository');
      const repo = new StepRepository();

      // First create a run
      const { RunRepository } = require('../src/repositories/RunRepository');
      const runRepo = new RunRepository();
      const run = await runRepo.create({ steps: [], goal: 'test' }, 'test');

      const step = await repo.create(
        run.id,
        'test-step',
        'test-tool',
        { test: true }
      );

      expect(step).toBeDefined();
      expect(step?.run_id).toBe(run.id);
    });
  });

  describe('Security Middleware', () => {
    it('should have security headers', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should have rate limiting', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('should have CORS configured', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/runs/preview')
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/runs')
        .query({ limit: 'not-a-number' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate path parameters', async () => {
      const response = await request(app)
        .get('/api/runs/not-a-uuid')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Error Recovery', () => {
    it('should handle database errors gracefully', async () => {
      // Temporarily break database connection
      const originalQuery = pool.query;
      pool.query = () => Promise.reject(new Error('Database error'));

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.database.status).toBe('error');

      // Restore database connection
      pool.query = originalQuery;
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/runs/preview')
        .set('Content-Type', 'application/json')
        .send('{ invalid json')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should respond quickly to health checks', async () => {
      const start = Date.now();

      await request(app)
        .get('/health')
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should respond in < 100ms
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Migration Validation', () => {
    it('should have RLS enabled on critical tables', async () => {
      const result = await pool.query(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'nofx'
        AND tablename IN ('run', 'step', 'event', 'gate')
        AND rowsecurity = false
      `);

      expect(result.rows).toHaveLength(0);
    });

    it('should have required indexes', async () => {
      const result = await pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'nofx'
        AND indexname IN (
          'idx_run_status',
          'idx_step_run_id',
          'idx_event_run_id'
        )
      `);

      expect(result.rows.length).toBeGreaterThan(0);
    });
  });
});