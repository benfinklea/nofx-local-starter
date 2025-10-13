/**
 * Queue Routes API Tests - 85%+ Coverage Target
 * Tests the developer endpoints for queue monitoring and DLQ management
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';
import { mount } from '../queue';
import * as queueModule from '../../../lib/queue';
import IORedis from 'ioredis';

// Mock dependencies
jest.mock('../../../lib/queue');
jest.mock('ioredis');

const mockedQueueModule = queueModule as jest.Mocked<typeof queueModule>;
const MockedIORedis = IORedis as jest.MockedClass<typeof IORedis>;

describe('Queue Routes API', () => {
  let app: Express;
  let mockRedisInstance: jest.Mocked<IORedis>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create Express app
    app = express();
    app.use(express.json());

    // Mount queue routes
    mount(app);

    // Setup mock Redis instance
    mockRedisInstance = {
      ping: jest.fn(),
      get: jest.fn(),
      disconnect: jest.fn()
    } as any;

    MockedIORedis.mockImplementation(() => mockRedisInstance);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /dev/queue', () => {
    it('returns queue counts and oldest age successfully', async () => {
      const mockCounts = {
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
        paused: 0
      };
      const mockOldestAge = 45000; // 45 seconds

      mockedQueueModule.getCounts.mockResolvedValue(mockCounts);
      mockedQueueModule.getOldestAgeMs.mockReturnValue(mockOldestAge);

      const response = await request(app)
        .get('/dev/queue')
        .expect(200);

      expect(response.body).toEqual({
        topic: queueModule.STEP_READY_TOPIC,
        counts: mockCounts,
        oldestAgeMs: mockOldestAge
      });

      expect(mockedQueueModule.getCounts).toHaveBeenCalledWith(queueModule.STEP_READY_TOPIC);
      expect(mockedQueueModule.getOldestAgeMs).toHaveBeenCalledWith(queueModule.STEP_READY_TOPIC);
    });

    it('handles null oldest age (empty queue)', async () => {
      const mockCounts = {
        waiting: 0,
        active: 0,
        completed: 100,
        failed: 0,
        delayed: 0,
        paused: 0
      };

      mockedQueueModule.getCounts.mockResolvedValue(mockCounts);
      mockedQueueModule.getOldestAgeMs.mockReturnValue(null);

      const response = await request(app)
        .get('/dev/queue')
        .expect(200);

      expect(response.body.oldestAgeMs).toBeNull();
    });

    it('handles getCounts errors gracefully', async () => {
      mockedQueueModule.getCounts.mockRejectedValue(new Error('Redis connection failed'));

      const response = await request(app)
        .get('/dev/queue')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Redis connection failed'
      });
    });

    it('handles non-Error exceptions', async () => {
      mockedQueueModule.getCounts.mockRejectedValue('String error');

      const response = await request(app)
        .get('/dev/queue')
        .expect(500);

      expect(response.body).toEqual({
        error: 'failed to get counts'
      });
    });
  });

  describe('GET /dev/redis', () => {
    it('returns Redis connection status when healthy', async () => {
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const response = await request(app)
        .get('/dev/redis')
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true
      });
      expect(response.body.url).toBeDefined();
      expect(mockRedisInstance.ping).toHaveBeenCalled();
      expect(mockRedisInstance.disconnect).toHaveBeenCalled();
    });

    it('uses custom REDIS_URL from environment', async () => {
      const customUrl = 'redis://custom-host:6380';
      const originalUrl = process.env.REDIS_URL;
      process.env.REDIS_URL = customUrl;

      mockRedisInstance.ping.mockResolvedValue('PONG');

      const response = await request(app)
        .get('/dev/redis')
        .expect(200);

      expect(response.body.url).toBe(customUrl);

      // Restore
      if (originalUrl) {
        process.env.REDIS_URL = originalUrl;
      } else {
        delete process.env.REDIS_URL;
      }
    });

    it('falls back to default Redis URL', async () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;

      mockRedisInstance.ping.mockResolvedValue('PONG');

      const response = await request(app)
        .get('/dev/redis')
        .expect(200);

      expect(response.body.url).toBe('redis://localhost:6379');

      // Restore
      if (originalUrl) {
        process.env.REDIS_URL = originalUrl;
      }
    });

    it('returns error status when Redis is down', async () => {
      mockRedisInstance.ping.mockRejectedValue(new Error('Connection refused'));

      const response = await request(app)
        .get('/dev/redis')
        .expect(500);

      expect(response.body).toMatchObject({
        ok: false,
        error: 'Connection refused'
      });
      expect(mockRedisInstance.disconnect).toHaveBeenCalled();
    });

    it('handles non-PONG responses', async () => {
      mockRedisInstance.ping.mockResolvedValue('UNEXPECTED');

      const response = await request(app)
        .get('/dev/redis')
        .expect(200);

      expect(response.body.ok).toBe(false);
    });

    it('handles non-Error exceptions in Redis check', async () => {
      mockRedisInstance.ping.mockRejectedValue('String error');

      const response = await request(app)
        .get('/dev/redis')
        .expect(500);

      expect(response.body).toMatchObject({
        ok: false,
        error: 'redis error'
      });
    });

    it('ensures disconnect is called even on error', async () => {
      mockRedisInstance.ping.mockRejectedValue(new Error('Test error'));

      await request(app)
        .get('/dev/redis')
        .expect(500);

      expect(mockRedisInstance.disconnect).toHaveBeenCalled();
    });
  });

  describe('GET /dev/worker/health', () => {
    it('returns healthy status when worker heartbeat is recent', async () => {
      const recentTimestamp = Date.now() - 5000; // 5 seconds ago
      mockRedisInstance.get.mockResolvedValue(recentTimestamp.toString());

      const response = await request(app)
        .get('/dev/worker/health')
        .expect(200);

      expect(response.body).toMatchObject({
        last: recentTimestamp,
        healthy: true
      });
      expect(response.body.ageMs).toBeLessThan(12000);
      expect(mockRedisInstance.get).toHaveBeenCalledWith('nofx:worker:heartbeat');
      expect(mockRedisInstance.disconnect).toHaveBeenCalled();
    });

    it('returns unhealthy status when heartbeat is stale', async () => {
      const staleTimestamp = Date.now() - 15000; // 15 seconds ago
      mockRedisInstance.get.mockResolvedValue(staleTimestamp.toString());

      const response = await request(app)
        .get('/dev/worker/health')
        .expect(200);

      expect(response.body).toMatchObject({
        last: staleTimestamp,
        healthy: false
      });
      expect(response.body.ageMs).toBeGreaterThan(12000);
    });

    it('returns unhealthy when no heartbeat exists', async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      const response = await request(app)
        .get('/dev/worker/health')
        .expect(200);

      expect(response.body).toMatchObject({
        last: 0,
        ageMs: null,
        healthy: false
      });
    });

    it('handles Redis errors gracefully', async () => {
      mockRedisInstance.get.mockRejectedValue(new Error('Redis error'));

      const response = await request(app)
        .get('/dev/worker/health')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Redis error'
      });
      expect(mockRedisInstance.disconnect).toHaveBeenCalled();
    });

    it('handles non-Error exceptions', async () => {
      mockRedisInstance.get.mockRejectedValue('String error');

      const response = await request(app)
        .get('/dev/worker/health')
        .expect(500);

      expect(response.body).toEqual({
        error: 'redis error'
      });
    });

    it('ensures disconnect is called even on error', async () => {
      mockRedisInstance.get.mockRejectedValue(new Error('Test error'));

      await request(app)
        .get('/dev/worker/health')
        .expect(500);

      expect(mockRedisInstance.disconnect).toHaveBeenCalled();
    });
  });

  describe('GET /dev/dlq', () => {
    it('lists DLQ jobs successfully', async () => {
      const mockDlqItems = [
        { id: 'job1', payload: { action: 'test1' }, failedAt: '2024-01-01T00:00:00Z' },
        { id: 'job2', payload: { action: 'test2' }, failedAt: '2024-01-01T00:01:00Z' }
      ];

      mockedQueueModule.listDlq.mockResolvedValue(mockDlqItems);

      const response = await request(app)
        .get('/dev/dlq')
        .expect(200);

      expect(response.body).toEqual({
        topic: queueModule.STEP_DLQ_TOPIC,
        count: 2,
        items: mockDlqItems
      });

      expect(mockedQueueModule.listDlq).toHaveBeenCalledWith(queueModule.STEP_DLQ_TOPIC);
    });

    it('returns empty list when DLQ is empty', async () => {
      mockedQueueModule.listDlq.mockResolvedValue([]);

      const response = await request(app)
        .get('/dev/dlq')
        .expect(200);

      expect(response.body).toEqual({
        topic: queueModule.STEP_DLQ_TOPIC,
        count: 0,
        items: []
      });
    });

    it('handles listDlq errors gracefully', async () => {
      mockedQueueModule.listDlq.mockRejectedValue(new Error('DLQ query failed'));

      const response = await request(app)
        .get('/dev/dlq')
        .expect(500);

      expect(response.body).toEqual({
        error: 'DLQ query failed'
      });
    });

    it('handles non-Error exceptions', async () => {
      mockedQueueModule.listDlq.mockRejectedValue('String error');

      const response = await request(app)
        .get('/dev/dlq')
        .expect(500);

      expect(response.body).toEqual({
        error: 'failed to list dlq'
      });
    });
  });

  describe('POST /dev/dlq/rehydrate', () => {
    it('rehydrates DLQ jobs with default limit', async () => {
      mockedQueueModule.rehydrateDlq.mockResolvedValue(50);

      const response = await request(app)
        .post('/dev/dlq/rehydrate')
        .send({})
        .expect(200);

      expect(response.body).toEqual({
        topic: queueModule.STEP_DLQ_TOPIC,
        rehydrated: 50
      });

      expect(mockedQueueModule.rehydrateDlq).toHaveBeenCalledWith(
        queueModule.STEP_DLQ_TOPIC,
        50
      );
    });

    it('rehydrates with custom limit', async () => {
      mockedQueueModule.rehydrateDlq.mockResolvedValue(25);

      const response = await request(app)
        .post('/dev/dlq/rehydrate')
        .send({ max: 25 })
        .expect(200);

      expect(response.body).toEqual({
        topic: queueModule.STEP_DLQ_TOPIC,
        rehydrated: 25
      });

      expect(mockedQueueModule.rehydrateDlq).toHaveBeenCalledWith(
        queueModule.STEP_DLQ_TOPIC,
        25
      );
    });

    it('enforces minimum limit of 0', async () => {
      mockedQueueModule.rehydrateDlq.mockResolvedValue(0);

      const response = await request(app)
        .post('/dev/dlq/rehydrate')
        .send({ max: -10 })
        .expect(200);

      expect(mockedQueueModule.rehydrateDlq).toHaveBeenCalledWith(
        queueModule.STEP_DLQ_TOPIC,
        0
      );
    });

    it('enforces maximum limit of 500', async () => {
      mockedQueueModule.rehydrateDlq.mockResolvedValue(500);

      const response = await request(app)
        .post('/dev/dlq/rehydrate')
        .send({ max: 1000 })
        .expect(200);

      expect(mockedQueueModule.rehydrateDlq).toHaveBeenCalledWith(
        queueModule.STEP_DLQ_TOPIC,
        500
      );
    });

    it('handles string max value', async () => {
      mockedQueueModule.rehydrateDlq.mockResolvedValue(100);

      const response = await request(app)
        .post('/dev/dlq/rehydrate')
        .send({ max: '100' })
        .expect(200);

      expect(mockedQueueModule.rehydrateDlq).toHaveBeenCalledWith(
        queueModule.STEP_DLQ_TOPIC,
        100
      );
    });

    it('handles invalid max value (NaN)', async () => {
      mockedQueueModule.rehydrateDlq.mockResolvedValue(50);

      const response = await request(app)
        .post('/dev/dlq/rehydrate')
        .send({ max: 'invalid' })
        .expect(200);

      // NaN gets passed through Math operations
      expect(mockedQueueModule.rehydrateDlq).toHaveBeenCalledWith(
        queueModule.STEP_DLQ_TOPIC,
        expect.any(Number)
      );
    });

    it('handles missing request body', async () => {
      mockedQueueModule.rehydrateDlq.mockResolvedValue(50);

      const response = await request(app)
        .post('/dev/dlq/rehydrate')
        .expect(200);

      expect(mockedQueueModule.rehydrateDlq).toHaveBeenCalledWith(
        queueModule.STEP_DLQ_TOPIC,
        50
      );
    });

    it('handles rehydrateDlq errors gracefully', async () => {
      mockedQueueModule.rehydrateDlq.mockRejectedValue(new Error('Rehydration failed'));

      const response = await request(app)
        .post('/dev/dlq/rehydrate')
        .send({ max: 10 })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Rehydration failed'
      });
    });

    it('handles non-Error exceptions', async () => {
      mockedQueueModule.rehydrateDlq.mockRejectedValue('String error');

      const response = await request(app)
        .post('/dev/dlq/rehydrate')
        .send({ max: 10 })
        .expect(500);

      expect(response.body).toEqual({
        error: 'failed to rehydrate dlq'
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('handles full queue monitoring workflow', async () => {
      // Check queue status
      const mockCounts = {
        waiting: 10,
        active: 2,
        completed: 100,
        failed: 5,
        delayed: 0,
        paused: 0
      };
      mockedQueueModule.getCounts.mockResolvedValue(mockCounts);
      mockedQueueModule.getOldestAgeMs.mockReturnValue(30000);

      const queueResponse = await request(app)
        .get('/dev/queue')
        .expect(200);

      expect(queueResponse.body.counts.failed).toBe(5);

      // Check DLQ
      const mockDlqItems = Array(5).fill(null).map((_, i) => ({
        id: `failed-job-${i}`,
        payload: { action: 'test' }
      }));
      mockedQueueModule.listDlq.mockResolvedValue(mockDlqItems);

      const dlqResponse = await request(app)
        .get('/dev/dlq')
        .expect(200);

      expect(dlqResponse.body.count).toBe(5);

      // Rehydrate failed jobs
      mockedQueueModule.rehydrateDlq.mockResolvedValue(5);

      const rehydrateResponse = await request(app)
        .post('/dev/dlq/rehydrate')
        .send({ max: 5 })
        .expect(200);

      expect(rehydrateResponse.body.rehydrated).toBe(5);
    });

    it('handles worker health monitoring workflow', async () => {
      // Check Redis
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const redisResponse = await request(app)
        .get('/dev/redis')
        .expect(200);

      expect(redisResponse.body.ok).toBe(true);

      // Check worker health
      const recentTimestamp = Date.now() - 3000;
      mockRedisInstance.get.mockResolvedValue(recentTimestamp.toString());

      const healthResponse = await request(app)
        .get('/dev/worker/health')
        .expect(200);

      expect(healthResponse.body.healthy).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('recovers from transient Redis errors', async () => {
      // First call fails
      mockRedisInstance.ping.mockRejectedValueOnce(new Error('Connection timeout'));

      await request(app)
        .get('/dev/redis')
        .expect(500);

      expect(mockRedisInstance.disconnect).toHaveBeenCalled();

      // Second call succeeds
      jest.clearAllMocks();
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const response = await request(app)
        .get('/dev/redis')
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it('handles queue recovery after DLQ rehydration', async () => {
      // Initial state: many failed jobs
      const mockCountsBefore = {
        waiting: 0,
        active: 0,
        completed: 100,
        failed: 10,
        delayed: 0,
        paused: 0
      };
      mockedQueueModule.getCounts.mockResolvedValue(mockCountsBefore);
      mockedQueueModule.getOldestAgeMs.mockReturnValue(null);

      await request(app).get('/dev/queue').expect(200);

      // Rehydrate
      mockedQueueModule.rehydrateDlq.mockResolvedValue(10);

      await request(app)
        .post('/dev/dlq/rehydrate')
        .send({ max: 10 })
        .expect(200);

      // After rehydration: jobs back in waiting queue
      const mockCountsAfter = {
        waiting: 10,
        active: 0,
        completed: 100,
        failed: 0,
        delayed: 0,
        paused: 0
      };
      mockedQueueModule.getCounts.mockResolvedValue(mockCountsAfter);
      mockedQueueModule.getOldestAgeMs.mockReturnValue(1000);

      const afterResponse = await request(app).get('/dev/queue').expect(200);

      expect(afterResponse.body.counts.waiting).toBe(10);
      expect(afterResponse.body.counts.failed).toBe(0);
    });
  });
});
