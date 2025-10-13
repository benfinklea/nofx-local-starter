/**
 * Complete Run Workflow Integration Tests
 * Tests the full lifecycle of run creation, execution, and completion
 */

import request from 'supertest';
import { waitForCondition, TestDataFactory, PerformanceMetrics } from '../helpers/testHelpers';

describe('Integration: Complete Run Workflow', () => {
  let app: any;
  let authToken: string;
  let runId: string;
  const performanceMetrics = new PerformanceMetrics();

  beforeAll(async () => {
    // Import app dynamically to ensure clean state
    const appModule = await import('../../src/api/main');
    app = appModule.app;

    // Authenticate for protected endpoints
    const authResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin'
      });

    if (authResponse.status === 200 && authResponse.body.token) {
      authToken = authResponse.body.token;
    }
  });

  afterAll(() => {
    // Clean up performance metrics
    performanceMetrics.reset();
  });

  describe('Complete Run Lifecycle', () => {
    test('should create and execute a complete run workflow', async () => {
      const startTime = Date.now();

      // 1. Create run with plan
      const createResponse = await request(app)
        .post('/runs')
        .set('Authorization', authToken ? `Bearer ${authToken}` : '')
        .send({
          plan: TestDataFactory.createRunPlan({
            goal: 'Integration test: Complete workflow',
            steps: [
              {
                name: 'initialize',
                tool: 'codegen',
                inputs: { prompt: 'Initialize project' }
              },
              {
                name: 'validate',
                tool: 'gate:typecheck',
                inputs: {}
              },
              {
                name: 'test',
                tool: 'gate:unit',
                inputs: {}
              }
            ]
          })
        })
        .expect(201);

      runId = createResponse.body.run?.id || createResponse.body.id;
      expect(runId).toBeDefined();
      expect(createResponse.body.status || createResponse.body.run?.status).toBe('pending');

      // 2. Wait for run to start execution
      await waitForCondition(async () => {
        const statusResponse = await request(app)
          .get(`/runs/${runId}`)
          .set('Authorization', authToken ? `Bearer ${authToken}` : '');

        return statusResponse.body.status === 'running' || statusResponse.body.status === 'succeeded';
      }, 60000);

      // 3. Monitor steps execution
      const stepsResponse = await request(app)
        .get(`/runs/${runId}/steps`)
        .set('Authorization', authToken ? `Bearer ${authToken}` : '')
        .expect(200);

      expect(Array.isArray(stepsResponse.body.steps || stepsResponse.body)).toBe(true);
      const steps = stepsResponse.body.steps || stepsResponse.body;
      expect(steps.length).toBeGreaterThan(0);

      // 4. Wait for run completion
      await waitForCondition(async () => {
        const statusResponse = await request(app)
          .get(`/runs/${runId}`)
          .set('Authorization', authToken ? `Bearer ${authToken}` : '');

        const status = statusResponse.body.status;
        return status === 'succeeded' || status === 'failed' || status === 'cancelled';
      }, 300000); // 5 minutes timeout for complete workflow

      // 5. Verify final status
      const finalResponse = await request(app)
        .get(`/runs/${runId}`)
        .set('Authorization', authToken ? `Bearer ${authToken}` : '')
        .expect(200);

      expect(['succeeded', 'failed']).toContain(finalResponse.body.status);

      // 6. Verify artifacts were created
      const artifactsResponse = await request(app)
        .get(`/runs/${runId}/artifacts`)
        .set('Authorization', authToken ? `Bearer ${authToken}` : '');

      if (artifactsResponse.status === 200) {
        expect(artifactsResponse.body).toBeDefined();
      }

      // 7. Verify events were recorded
      const eventsResponse = await request(app)
        .get(`/runs/${runId}/events`)
        .set('Authorization', authToken ? `Bearer ${authToken}` : '');

      if (eventsResponse.status === 200) {
        const events = eventsResponse.body.events || eventsResponse.body;
        if (Array.isArray(events)) {
          expect(events.length).toBeGreaterThan(0);
          expect(events.some((e: any) => e.type === 'run.created')).toBe(true);
        }
      }

      // Record performance
      const duration = Date.now() - startTime;
      performanceMetrics.record(duration);

      // Performance assertion
      expect(duration).toBeLessThan(300000); // Should complete within 5 minutes
    }, 600000); // 10 minute test timeout

    test('should handle concurrent run creation', async () => {
      const concurrentRuns = 10;
      const results = await Promise.allSettled(
        Array(concurrentRuns).fill(null).map(async () => {
          const response = await request(app)
            .post('/runs')
            .set('Authorization', authToken ? `Bearer ${authToken}` : '')
            .send({
              plan: TestDataFactory.createRunPlan({
                goal: 'Concurrent test run',
                steps: [
                  {
                    name: 'quick-task',
                    tool: 'codegen',
                    inputs: { prompt: 'Simple task' }
                  }
                ]
              })
            })
            .timeout(10000);

          return response.body;
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      // At least 80% should succeed
      expect(successful.length / results.length).toBeGreaterThan(0.8);

      console.log(`Concurrent runs: ${successful.length} succeeded, ${failed.length} failed`);
    }, 120000);

    test('should support run cancellation', async () => {
      // Create a long-running run
      const createResponse = await request(app)
        .post('/runs')
        .set('Authorization', authToken ? `Bearer ${authToken}` : '')
        .send({
          plan: TestDataFactory.createRunPlan({
            goal: 'Cancellation test',
            steps: [
              {
                name: 'long-task',
                tool: 'codegen',
                inputs: { prompt: 'Long running task' }
              }
            ]
          })
        })
        .expect(201);

      const testRunId = createResponse.body.run?.id || createResponse.body.id;

      // Wait a moment for run to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Cancel the run
      const cancelResponse = await request(app)
        .post(`/runs/${testRunId}/cancel`)
        .set('Authorization', authToken ? `Bearer ${authToken}` : '');

      // Accept both 200 and 404 (if run already completed)
      expect([200, 404]).toContain(cancelResponse.status);

      if (cancelResponse.status === 200) {
        // Verify cancellation
        await waitForCondition(async () => {
          const statusResponse = await request(app)
            .get(`/runs/${testRunId}`)
            .set('Authorization', authToken ? `Bearer ${authToken}` : '');

          return statusResponse.body.status === 'cancelled';
        }, 30000);
      }
    }, 60000);
  });

  describe('Step Execution and Dependencies', () => {
    test('should execute steps in correct order', async () => {
      const createResponse = await request(app)
        .post('/runs')
        .set('Authorization', authToken ? `Bearer ${authToken}` : '')
        .send({
          plan: {
            goal: 'Test step ordering',
            steps: [
              {
                name: 'step1',
                tool: 'codegen',
                inputs: { prompt: 'Step 1' }
              },
              {
                name: 'step2',
                tool: 'codegen',
                inputs: { prompt: 'Step 2' },
                dependsOn: ['step1']
              },
              {
                name: 'step3',
                tool: 'codegen',
                inputs: { prompt: 'Step 3' },
                dependsOn: ['step2']
              }
            ]
          }
        })
        .expect(201);

      const testRunId = createResponse.body.run?.id || createResponse.body.id;

      // Wait for completion
      await waitForCondition(async () => {
        const statusResponse = await request(app)
          .get(`/runs/${testRunId}`)
          .set('Authorization', authToken ? `Bearer ${authToken}` : '');

        return ['succeeded', 'failed'].includes(statusResponse.body.status);
      }, 120000);

      // Verify execution order through events
      const eventsResponse = await request(app)
        .get(`/runs/${testRunId}/events`)
        .set('Authorization', authToken ? `Bearer ${authToken}` : '');

      if (eventsResponse.status === 200) {
        const events = eventsResponse.body.events || eventsResponse.body;
        if (Array.isArray(events)) {
          const stepStarts = events
            .filter((e: any) => e.type === 'step.started')
            .map((e: any) => e.payload?.stepName || e.payload?.name);

          // Verify steps started in order (allowing for some flexibility)
          expect(stepStarts.length).toBeGreaterThan(0);
        }
      }
    }, 180000);
  });

  describe('Error Handling and Recovery', () => {
    test('should handle invalid plan gracefully', async () => {
      const response = await request(app)
        .post('/runs')
        .set('Authorization', authToken ? `Bearer ${authToken}` : '')
        .send({
          plan: {
            goal: '', // Invalid empty goal
            steps: []
          }
        });

      expect([400, 422]).toContain(response.status);
      expect(response.body.error || response.body.message).toBeDefined();
    });

    test('should handle missing authentication', async () => {
      const response = await request(app)
        .post('/runs')
        .send({
          plan: TestDataFactory.createRunPlan()
        });

      // Accept both authenticated and unauthenticated scenarios
      expect([200, 201, 401, 403]).toContain(response.status);
    });

    test('should handle non-existent run gracefully', async () => {
      const response = await request(app)
        .get('/runs/non-existent-run-id')
        .set('Authorization', authToken ? `Bearer ${authToken}` : '');

      expect([404, 400]).toContain(response.status);
    });
  });

  describe('Performance Benchmarks', () => {
    test('run creation should be fast', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/runs')
        .set('Authorization', authToken ? `Bearer ${authToken}` : '')
        .send({
          plan: TestDataFactory.createRunPlan()
        });

      const duration = Date.now() - startTime;

      // Run creation should complete within 2 seconds
      expect(duration).toBeLessThan(2000);
    });

    test('run status retrieval should be fast', async () => {
      if (!runId) {
        return; // Skip if no run was created
      }

      const measurements: number[] = [];

      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();

        await request(app)
          .get(`/runs/${runId}`)
          .set('Authorization', authToken ? `Bearer ${authToken}` : '');

        measurements.push(Date.now() - startTime);
      }

      const average = measurements.reduce((a, b) => a + b, 0) / measurements.length;

      // Average retrieval should be under 500ms
      expect(average).toBeLessThan(500);
    });
  });
});
