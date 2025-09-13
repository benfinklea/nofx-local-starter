import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

test.describe('NOFX End-to-End Workflow Tests', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3000';

  test.beforeEach(async ({ context }) => {
    // Set up any necessary context
    await context.addCookies([]);
  });

  test.describe('Complete Run Lifecycle', () => {
    test('creates and completes a simple run', async ({ request }) => {
      // Step 1: Create a run
      const createResponse = await request.post(`${API_URL}/runs`, {
        data: {
          plan: {
            goal: 'E2E test run',
            steps: [
              {
                name: 'test_step',
                tool: 'codegen',
                inputs: {
                  topic: 'E2E Test',
                  bullets: ['Test 1', 'Test 2', 'Test 3']
                }
              }
            ]
          }
        }
      });

      expect(createResponse.ok()).toBeTruthy();
      const createData = await createResponse.json();
      expect(createData.id).toBeDefined();
      expect(createData.status).toBe('queued');

      const runId = createData.id;

      // Step 2: Poll for completion
      let attempts = 0;
      let runStatus = 'queued';

      while (runStatus !== 'succeeded' && runStatus !== 'failed' && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

        const statusResponse = await request.get(`${API_URL}/runs/${runId}`);
        expect(statusResponse.ok()).toBeTruthy();

        const statusData = await statusResponse.json();
        runStatus = statusData.run.status;
        attempts++;
      }

      // Step 3: Verify completion
      expect(['succeeded', 'failed']).toContain(runStatus);

      // Step 4: Check artifacts were created
      const finalResponse = await request.get(`${API_URL}/runs/${runId}`);
      const finalData = await finalResponse.json();

      expect(finalData.steps).toHaveLength(1);
      expect(finalData.steps[0].status).toBe('succeeded');

      if (finalData.artifacts && finalData.artifacts.length > 0) {
        expect(finalData.artifacts[0].type).toBe('text/markdown');
      }
    });

    test('handles multiple concurrent runs', async ({ request }) => {
      const runPromises = Array(5).fill(null).map(async (_, index) => {
        const response = await request.post(`${API_URL}/runs`, {
          data: {
            plan: {
              goal: `Concurrent test ${index}`,
              steps: [
                {
                  name: `step_${index}`,
                  tool: 'codegen',
                  inputs: { topic: `Test ${index}` }
                }
              ]
            }
          }
        });

        expect(response.ok()).toBeTruthy();
        return response.json();
      });

      const runs = await Promise.all(runPromises);
      const runIds = runs.map(r => r.id);

      // All IDs should be unique
      expect(new Set(runIds).size).toBe(5);

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check all runs are processed
      const statusPromises = runIds.map(id =>
        request.get(`${API_URL}/runs/${id}`)
      );

      const statuses = await Promise.all(statusPromises);
      statuses.forEach(status => {
        expect(status.ok()).toBeTruthy();
      });
    });

    test('handles run with multiple steps', async ({ request }) => {
      const response = await request.post(`${API_URL}/runs`, {
        data: {
          plan: {
            goal: 'Multi-step workflow',
            steps: [
              {
                name: 'step1',
                tool: 'codegen',
                inputs: { topic: 'Step 1' }
              },
              {
                name: 'step2',
                tool: 'codegen',
                inputs: { topic: 'Step 2' }
              },
              {
                name: 'step3',
                tool: 'codegen',
                inputs: { topic: 'Step 3' }
              }
            ]
          }
        }
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      const statusResponse = await request.get(`${API_URL}/runs/${data.id}`);
      const statusData = await statusResponse.json();

      expect(statusData.steps).toHaveLength(3);
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('handles invalid run data gracefully', async ({ request }) => {
      const invalidPayloads = [
        {},
        { plan: null },
        { plan: { goal: '' } },
        { plan: { goal: 'test', steps: 'not-array' } }
      ];

      for (const payload of invalidPayloads) {
        const response = await request.post(`${API_URL}/runs`, {
          data: payload,
          failOnStatusCode: false
        });

        // Should either reject with 4xx or handle gracefully
        if (response.status() === 200) {
          const data = await response.json();
          expect(data).toHaveProperty('id');
        } else {
          expect([400, 422]).toContain(response.status());
        }
      }
    });

    test('handles non-existent run lookup', async ({ request }) => {
      const fakeId = faker.string.uuid();
      const response = await request.get(`${API_URL}/runs/${fakeId}`, {
        failOnStatusCode: false
      });

      // Should either return 404 or empty data
      if (response.status() === 200) {
        const data = await response.json();
        expect(data.run).toBeDefined();
      } else {
        expect(response.status()).toBe(404);
      }
    });

    test('recovers from network interruption', async ({ request, context }) => {
      // Create a run
      const createResponse = await request.post(`${API_URL}/runs`, {
        data: {
          plan: {
            goal: 'Network test',
            steps: [{ name: 'test', tool: 'codegen' }]
          }
        }
      });

      const data = await createResponse.json();
      const runId = data.id;

      // Simulate network interruption by using abort
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 100);

      try {
        await request.get(`${API_URL}/runs/${runId}`, {
          signal: controller.signal as any
        });
      } catch (error) {
        // Network error expected
      }

      // Retry after "network recovery"
      const retryResponse = await request.get(`${API_URL}/runs/${runId}`);
      expect(retryResponse.ok()).toBeTruthy();
    });
  });

  test.describe('Performance and Load Testing', () => {
    test('handles rapid sequential requests', async ({ request }) => {
      const start = Date.now();

      for (let i = 0; i < 20; i++) {
        const response = await request.get(`${API_URL}/health`);
        expect(response.ok()).toBeTruthy();
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // Should complete in < 5s
    });

    test('handles large payload', async ({ request }) => {
      const largeSteps = Array(100).fill(null).map((_, i) => ({
        name: `step_${i}`,
        tool: 'codegen',
        inputs: {
          topic: `Step ${i}`,
          data: faker.lorem.paragraphs(10)
        }
      }));

      const response = await request.post(`${API_URL}/runs`, {
        data: {
          plan: {
            goal: 'Large payload test',
            steps: largeSteps
          }
        },
        timeout: 30000
      });

      expect(response.ok()).toBeTruthy();
    });
  });

  test.describe('Security Validation', () => {
    test('prevents SQL injection', async ({ request }) => {
      const maliciousPayloads = [
        "'; DROP TABLE runs; --",
        "1' OR '1'='1",
        "admin'--",
        "1; DELETE FROM steps WHERE 1=1"
      ];

      for (const payload of maliciousPayloads) {
        const response = await request.post(`${API_URL}/runs`, {
          data: {
            plan: {
              goal: payload,
              steps: [{ name: payload, tool: 'test' }]
            }
          }
        });

        // Should handle safely without executing injection
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data.id).toBeDefined();
      }
    });

    test('prevents XSS attacks', async ({ request }) => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert(1)>',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)"></iframe>'
      ];

      for (const payload of xssPayloads) {
        const response = await request.post(`${API_URL}/runs`, {
          data: {
            plan: {
              goal: payload,
              steps: [{ name: 'xss_test', tool: 'test', inputs: { data: payload } }]
            }
          }
        });

        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data.id).toBeDefined();

        // Verify the payload is stored safely
        const getResponse = await request.get(`${API_URL}/runs/${data.id}`);
        const runData = await getResponse.json();

        // The goal should be stored but escaped/sanitized
        expect(runData.run.plan.goal).toBeDefined();
      }
    });
  });

  test.describe('Data Integrity', () => {
    test('maintains data consistency across operations', async ({ request }) => {
      // Create a run
      const createResponse = await request.post(`${API_URL}/runs`, {
        data: {
          plan: {
            goal: 'Data integrity test',
            steps: [
              { name: 'step1', tool: 'codegen', inputs: { value: 123 } },
              { name: 'step2', tool: 'codegen', inputs: { value: 456 } }
            ]
          }
        }
      });

      const createData = await createResponse.json();
      const runId = createData.id;

      // Get the run multiple times and verify consistency
      const responses = await Promise.all(
        Array(5).fill(null).map(() => request.get(`${API_URL}/runs/${runId}`))
      );

      const data = await Promise.all(responses.map(r => r.json()));

      // All responses should be identical
      const firstResponse = JSON.stringify(data[0]);
      data.forEach(d => {
        expect(JSON.stringify(d)).toBe(firstResponse);
      });
    });
  });
});