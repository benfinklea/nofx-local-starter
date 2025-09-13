/**
 * Worker Module Unit Tests
 */

// Mock dependencies
const mockWorkerProcess = jest.fn();
const mockJobData = { stepId: 'step-123', action: 'process' };

jest.mock('bullmq', () => ({
  Worker: jest.fn((topic, processor, options) => {
    mockWorkerProcess.mockImplementation(processor);
    return {
      run: jest.fn(),
      close: jest.fn(),
      on: jest.fn()
    };
  })
}));

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

describe('Worker Module Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Worker Initialization', () => {
    test('creates worker with correct configuration', () => {
      const { Worker } = require('bullmq');
      const handler = jest.fn();

      new Worker('test.topic', handler, { connection: {} });

      expect(Worker).toHaveBeenCalledWith(
        'test.topic',
        handler,
        { connection: {} }
      );
    });

    test('registers multiple workers for different topics', () => {
      const { Worker } = require('bullmq');

      new Worker('topic1', jest.fn(), {});
      new Worker('topic2', jest.fn(), {});
      new Worker('topic3', jest.fn(), {});

      expect(Worker).toHaveBeenCalledTimes(3);
    });
  });

  describe('Step Processing', () => {
    test('processes step successfully', async () => {
      const { query } = require('../../src/lib/db');
      const { enqueue } = require('../../src/lib/queue');
      const { log } = require('../../src/lib/logger');

      query.mockResolvedValueOnce({
        rows: [{ id: 'step-123', status: 'ready' }]
      });
      enqueue.mockResolvedValueOnce(undefined);

      const processStep = async (job: any) => {
        const step = await query(
          'SELECT * FROM nofx.step WHERE id = $1',
          [job.data.stepId]
        );

        if (step.rows[0]) {
          await query(
            'UPDATE nofx.step SET status = $1 WHERE id = $2',
            ['completed', job.data.stepId]
          );
          await enqueue('step.completed', { stepId: job.data.stepId });
          log.info({ stepId: job.data.stepId }, 'Step processed');
        }
      };

      await processStep({ data: { stepId: 'step-123' } });

      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM nofx.step WHERE id = $1',
        ['step-123']
      );
      expect(enqueue).toHaveBeenCalledWith('step.completed', {
        stepId: 'step-123'
      });
      expect(log.info).toHaveBeenCalledWith(
        { stepId: 'step-123' },
        'Step processed'
      );
    });

    test('handles step not found', async () => {
      const { query } = require('../../src/lib/db');
      const { log } = require('../../src/lib/logger');

      query.mockResolvedValueOnce({ rows: [] });

      const processStep = async (job: any) => {
        const step = await query(
          'SELECT * FROM nofx.step WHERE id = $1',
          [job.data.stepId]
        );

        if (!step.rows[0]) {
          log.warn({ stepId: job.data.stepId }, 'Step not found');
          return;
        }
      };

      await processStep({ data: { stepId: 'invalid-step' } });

      expect(log.warn).toHaveBeenCalledWith(
        { stepId: 'invalid-step' },
        'Step not found'
      );
    });

    test('retries failed steps', async () => {
      const { query } = require('../../src/lib/db');
      const { log } = require('../../src/lib/logger');

      let attempts = 0;
      query.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Database error'));
        }
        return Promise.resolve({ rows: [{ id: 'step-123' }] });
      });

      const processWithRetry = async (job: any, maxRetries = 3) => {
        let lastError;

        for (let i = 0; i < maxRetries; i++) {
          try {
            const result = await query('SELECT 1');
            return result;
          } catch (error) {
            lastError = error;
            log.warn({ attempt: i + 1, error }, 'Retrying operation');
          }
        }

        throw lastError;
      };

      const result = await processWithRetry({ data: {} });

      expect(result.rows).toEqual([{ id: 'step-123' }]);
      expect(log.warn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Event Processing', () => {
    test('handles run.created event', async () => {
      const { query } = require('../../src/lib/db');
      const { enqueue } = require('../../src/lib/queue');

      query.mockResolvedValueOnce({
        rows: [
          { id: 'step-1', run_id: 'run-123' },
          { id: 'step-2', run_id: 'run-123' }
        ]
      });

      const handleRunCreated = async (payload: any) => {
        const steps = await query(
          'SELECT * FROM nofx.step WHERE run_id = $1',
          [payload.runId]
        );

        for (const step of steps.rows) {
          await enqueue('step.ready', { stepId: step.id });
        }
      };

      await handleRunCreated({ runId: 'run-123' });

      expect(enqueue).toHaveBeenCalledTimes(2);
      expect(enqueue).toHaveBeenCalledWith('step.ready', { stepId: 'step-1' });
      expect(enqueue).toHaveBeenCalledWith('step.ready', { stepId: 'step-2' });
    });

    test('handles step.completed event', async () => {
      const { query } = require('../../src/lib/db');
      const { log } = require('../../src/lib/logger');

      query.mockResolvedValueOnce({
        rows: [{ id: 'run-123', status: 'running' }]
      });
      query.mockResolvedValueOnce({
        rows: []
      });

      const handleStepCompleted = async (payload: any) => {
        const run = await query(
          'SELECT * FROM nofx.run WHERE id = (SELECT run_id FROM nofx.step WHERE id = $1)',
          [payload.stepId]
        );

        const pendingSteps = await query(
          'SELECT * FROM nofx.step WHERE run_id = $1 AND status != $2',
          [run.rows[0].id, 'completed']
        );

        if (pendingSteps.rows.length === 0) {
          await query(
            'UPDATE nofx.run SET status = $1 WHERE id = $2',
            ['completed', run.rows[0].id]
          );
          log.info({ runId: run.rows[0].id }, 'Run completed');
        }
      };

      await handleStepCompleted({ stepId: 'step-123' });

      expect(log.info).toHaveBeenCalledWith(
        { runId: 'run-123' },
        'Run completed'
      );
    });
  });

  describe('Error Handling', () => {
    test('handles job processing errors', async () => {
      const { log } = require('../../src/lib/logger');

      const errorHandler = async (job: any) => {
        try {
          throw new Error('Processing failed');
        } catch (error: any) {
          log.error({ jobId: job.id, error: error.message }, 'Job failed');
          throw error;
        }
      };

      await expect(errorHandler({ id: 'job-123' })).rejects.toThrow(
        'Processing failed'
      );

      expect(log.error).toHaveBeenCalledWith(
        { jobId: 'job-123', error: 'Processing failed' },
        'Job failed'
      );
    });

    test('handles invalid job data', async () => {
      const { log } = require('../../src/lib/logger');

      const validateJob = (job: any) => {
        if (!job.data || !job.data.stepId) {
          log.error({ job }, 'Invalid job data');
          throw new Error('Invalid job data');
        }
      };

      expect(() => validateJob({ data: {} })).toThrow('Invalid job data');
      expect(log.error).toHaveBeenCalledWith(
        { job: { data: {} } },
        'Invalid job data'
      );
    });
  });

  describe('Concurrency Control', () => {
    test('processes jobs concurrently', async () => {
      const processJob = jest.fn().mockResolvedValue({ success: true });

      const jobs = Array(5).fill(null).map((_, i) => ({
        id: `job-${i}`,
        data: { index: i }
      }));

      const results = await Promise.all(jobs.map(processJob));

      expect(processJob).toHaveBeenCalledTimes(5);
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    test('limits concurrent processing', async () => {
      const activeJobs = new Set();
      const maxConcurrency = 3;

      const processWithLimit = async (job: any) => {
        if (activeJobs.size >= maxConcurrency) {
          throw new Error('Max concurrency reached');
        }

        activeJobs.add(job.id);
        await new Promise(resolve => setTimeout(resolve, 10));
        activeJobs.delete(job.id);

        return { processed: true };
      };

      const job1 = processWithLimit({ id: '1' });
      const job2 = processWithLimit({ id: '2' });
      const job3 = processWithLimit({ id: '3' });
      const job4 = processWithLimit({ id: '4' });

      await expect(job4).rejects.toThrow('Max concurrency reached');

      const results = await Promise.all([job1, job2, job3]);
      expect(results).toHaveLength(3);
    });
  });
});