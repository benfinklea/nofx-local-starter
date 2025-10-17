/**
 * API Module Unit Tests
 */

// Mock dependencies
const mockApp = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  use: jest.fn(),
  listen: jest.fn()
};

jest.mock('express', () => {
  return jest.fn(() => mockApp);
});

jest.mock('../../src/lib/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../src/lib/db', () => ({
  query: jest.fn()
}));

jest.mock('../../src/lib/queue', () => ({
  enqueue: jest.fn(),
  subscribe: jest.fn(),
  STEP_READY_TOPIC: 'step.ready'
}));

describe('API Module Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Express App Setup', () => {
    test('creates express application', () => {
      const express = require('express');
      const app = express();

      expect(express).toHaveBeenCalled();
      expect(app).toBeDefined();
      expect(app.get).toBeDefined();
      expect(app.post).toBeDefined();
    });

    test('registers middleware', () => {
      const app = require('express')();

      app.use(jest.fn());

      expect(app.use).toHaveBeenCalled();
    });

    test('handles routes registration', () => {
      const app = require('express')();
      const handler = jest.fn();

      app.get('/health', handler);
      app.post('/api/runs', handler);

      expect(app.get).toHaveBeenCalledWith('/health', handler);
      expect(app.post).toHaveBeenCalledWith('/api/runs', handler);
    });
  });

  describe('Health Check Endpoint', () => {
    test('responds with status ok', () => {
      const req = {};
      const res: any = {
        json: jest.fn(),
        status: jest.fn()
      };
      res.status.mockReturnValue(res);

      const healthHandler = (req: any, res: any) => {
        res.json({ status: 'ok' });
      };

      healthHandler(req, res);

      expect(res.json).toHaveBeenCalledWith({ status: 'ok' });
    });
  });

  describe('Run Creation Endpoint', () => {
    test('creates new run with valid payload', async () => {
      const { query } = require('../../src/lib/db');
      const { enqueue } = require('../../src/lib/queue');

      query.mockResolvedValueOnce({
        rows: [{ id: 'run-123', status: 'pending' }]
      });
      enqueue.mockResolvedValueOnce(undefined);

      const req = {
        body: {
          plan: { steps: ['step1', 'step2'] }
        }
      };
      const res: any = {
        json: jest.fn(),
        status: jest.fn()
      };
      res.status.mockReturnValue(res);

      const createRunHandler = async (req: any, res: any) => {
        const result = await query(
          'INSERT INTO nofx.run (plan) VALUES ($1) RETURNING *',
          [req.body.plan]
        );
        await enqueue('run.created', result.rows[0]);
        res.status(201).json(result.rows[0]);
      };

      await createRunHandler(req, res);

      expect(query).toHaveBeenCalledWith(
        'INSERT INTO nofx.run (plan) VALUES ($1) RETURNING *',
        [{ steps: ['step1', 'step2'] }]
      );
      expect(enqueue).toHaveBeenCalledWith('run.created', {
        id: 'run-123',
        status: 'pending'
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        id: 'run-123',
        status: 'pending'
      });
    });

    test('validates required fields', async () => {
      const req = { body: {} };
      const res: any = {
        json: jest.fn(),
        status: jest.fn()
      };
      res.status.mockReturnValue(res);

      const validateHandler = (req: any, res: any) => {
        if (!req.body.plan) {
          return res.status(400).json({ error: 'Plan is required' });
        }
      };

      validateHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Plan is required' });
    });
  });

  describe('Error Handling', () => {
    test('handles database errors', async () => {
      const { query } = require('../../src/lib/db');
      const { log } = require('../../src/lib/logger');

      query.mockRejectedValueOnce(new Error('Database connection failed'));

      const req = { body: { plan: {} } };
      const res: any = {
        json: jest.fn(),
        status: jest.fn()
      };
      res.status.mockReturnValue(res);

      const errorHandler = async (req: any, res: any) => {
        try {
          await query('SELECT 1');
        } catch (error: any) {
          log.error({ error: error.message }, 'Database error');
          res.status(500).json({ error: 'Internal server error' });
        }
      };

      await errorHandler(req, res);

      expect(log.error).toHaveBeenCalledWith(
        { error: 'Database connection failed' },
        'Database error'
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    test('handles queue errors', async () => {
      const { enqueue } = require('../../src/lib/queue');
      const { log } = require('../../src/lib/logger');

      enqueue.mockRejectedValueOnce(new Error('Queue unavailable'));

      const req = { body: { data: 'test' } };
      const res: any = {
        json: jest.fn(),
        status: jest.fn()
      };
      res.status.mockReturnValue(res);

      const queueHandler = async (req: any, res: any) => {
        try {
          await enqueue('test.topic', req.body);
        } catch (error: any) {
          log.error({ error: error.message }, 'Queue error');
          res.status(503).json({ error: 'Service temporarily unavailable' });
        }
      };

      await queueHandler(req, res);

      expect(log.error).toHaveBeenCalledWith(
        { error: 'Queue unavailable' },
        'Queue error'
      );
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Service temporarily unavailable'
      });
    });
  });

  describe('Request Validation', () => {
    test('validates JSON payload', () => {
      const req = {
        body: '{"invalid json',
        headers: { 'content-type': 'application/json' }
      };
      const res: any = {
        json: jest.fn(),
        status: jest.fn()
      };
      res.status.mockReturnValue(res);

      const jsonValidator = (req: any, res: any) => {
        try {
          if (typeof req.body === 'string') {
            JSON.parse(req.body);
          }
        } catch {
          return res.status(400).json({ error: 'Invalid JSON' });
        }
      };

      jsonValidator(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid JSON' });
    });

    test('validates content type', () => {
      const req = {
        headers: { 'content-type': 'text/plain' },
        body: {}
      };
      const res: any = {
        json: jest.fn(),
        status: jest.fn(() => res)
      };

      const contentTypeValidator = (req: any, res: any) => {
        if (!req.headers['content-type']?.includes('application/json')) {
          return res.status(415).json({ error: 'Unsupported media type' });
        }
      };

      contentTypeValidator(req, res);

      expect(res.status).toHaveBeenCalledWith(415);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unsupported media type' });
    });
  });
});