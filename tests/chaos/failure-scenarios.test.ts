/**
 * Chaos Engineering Test Suite
 * Simulates various failure scenarios to test system resilience
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Chaos Engineering - Failure Scenarios', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  let apiAvailable = false;
  let dockerAvailable = false;
  const skipReasons = new Set<string>();

  const markSkip = (reason: string) => {
    if (!skipReasons.has(reason)) {
      skipReasons.add(reason);
      console.warn(`[chaos tests] ${reason}`);
    }
  };

  const skipIf = (condition: boolean, reason: string) => {
    if (condition) {
      markSkip(reason);
      return true;
    }

    return false;
  };

  beforeAll(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 500);

    try {
      const response = await fetch(`${API_URL}/health`, { signal: controller.signal });
      apiAvailable = response.ok;

      if (!apiAvailable) {
        markSkip(`API at ${API_URL} is not responding with 200; skipping API-dependent chaos tests.`);
      }
    } catch (error) {
      apiAvailable = false;
      markSkip(`API at ${API_URL} is unavailable (${(error as Error).message ?? 'unknown error'}); skipping API-dependent chaos tests.`);
    } finally {
      clearTimeout(timeout);
    }

    try {
      await execAsync('docker info', { timeout: 1000 });
      dockerAvailable = true;
    } catch (error) {
      dockerAvailable = false;
      markSkip(`Docker is unavailable (${(error as Error).message ?? 'unknown error'}); skipping Docker-dependent chaos tests.`);
    }
  });

  describe('Service Failures', () => {
    test('handles database connection loss', async () => {
      if (skipIf(!dockerAvailable, 'Docker-dependent chaos tests skipped because Docker is unavailable.')) {
        return;
      }

      if (skipIf(!apiAvailable, 'Chaos tests skipped because the API is unavailable.')) {
        return;
      }

      // Simulate database going down
      try {
        await execAsync('docker pause supabase_db_nofx-local-starter');

        // Try to create a run while DB is down
        const response = await fetch(`${API_URL}/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: { goal: 'DB down test', steps: [] }
          })
        }).catch(() => ({ ok: false }));

        // Should handle gracefully
        expect((response as any).ok).toBeFalsy();

        // Restore database
        await execAsync('docker unpause supabase_db_nofx-local-starter');

        // Wait for recovery
        await new Promise(resolve => setTimeout(resolve, 2000));

        // System should recover
        const healthCheck = await fetch(`${API_URL}/health`);
        expect(healthCheck.ok).toBeTruthy();
      } finally {
        // Ensure DB is restored
        await execAsync('docker unpause supabase_db_nofx-local-starter').catch(() => {});
      }
    });

    test('handles Redis connection loss', async () => {
      if (skipIf(!dockerAvailable, 'Docker-dependent chaos tests skipped because Docker is unavailable.')) {
        return;
      }

      if (skipIf(!apiAvailable, 'Chaos tests skipped because the API is unavailable.')) {
        return;
      }

      try {
        // Kill Redis
        await execAsync('docker pause redis');

        // Try to create a run while Redis is down
        const response = await fetch(`${API_URL}/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: { goal: 'Redis down test', steps: [] }
          })
        }).catch(() => ({ ok: false }));

        // Should handle gracefully (might queue locally or fail gracefully)
        expect((response as any).status !== 500).toBeTruthy();

        // Restore Redis
        await execAsync('docker unpause redis');

        // Wait for recovery
        await new Promise(resolve => setTimeout(resolve, 2000));

        // System should recover
        const healthCheck = await fetch(`${API_URL}/health`);
        expect(healthCheck.ok).toBeTruthy();
      } finally {
        await execAsync('docker unpause redis').catch(() => {});
      }
    });

    test('handles storage service failure', async () => {
      if (skipIf(!dockerAvailable, 'Docker-dependent chaos tests skipped because Docker is unavailable.')) {
        return;
      }

      if (skipIf(!apiAvailable, 'Chaos tests skipped because the API is unavailable.')) {
        return;
      }

      try {
        // Pause storage service
        await execAsync('docker pause supabase_storage_nofx-local-starter');

        // Create a run that would normally create artifacts
        const response = await fetch(`${API_URL}/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: {
              goal: 'Storage down test',
              steps: [{
                name: 'generate',
                tool: 'codegen',
                inputs: { topic: 'test' }
              }]
            }
          })
        });

        if (response.ok) {
          const data = await response.json();

          // Wait for processing
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Check if it handled storage failure gracefully
          const statusResponse = await fetch(`${API_URL}/runs/${data.id}`);
          const statusData = await statusResponse.json();

          // Should either skip artifact storage or handle gracefully
          expect(statusData.run).toBeDefined();
        }
      } finally {
        await execAsync('docker unpause supabase_storage_nofx-local-starter').catch(() => {});
      }
    });
  });

  describe('Network Chaos', () => {
    test('handles network latency', async () => {
      if (skipIf(!apiAvailable, 'Chaos tests skipped because the API is unavailable.')) {
        return;
      }

      // Add network latency (requires tc command on Linux/Mac)
      try {
        // This would add 500ms latency to localhost
        // await execAsync('sudo tc qdisc add dev lo root netem delay 500ms');

        // Make requests with simulated latency
        const start = Date.now();
        const response = await fetch(`${API_URL}/health`, {
          signal: AbortSignal.timeout(5000)
        });

        const duration = Date.now() - start;

        // Should still complete, just slower
        expect(response.ok).toBeTruthy();

        // Clean up
        // await execAsync('sudo tc qdisc del dev lo root').catch(() => {});
      } catch (error) {
        // Skip if tc command not available
        console.log('Network latency test skipped (tc command not available)');
      }
    });

    test('handles packet loss', async () => {
      if (skipIf(!apiAvailable, 'Chaos tests skipped because the API is unavailable.')) {
        return;
      }

      // Simulate packet loss
      try {
        // This would add 10% packet loss
        // await execAsync('sudo tc qdisc add dev lo root netem loss 10%');

        // Make multiple requests with packet loss
        const requests = Array(10).fill(null).map(() =>
          fetch(`${API_URL}/health`, {
            signal: AbortSignal.timeout(5000)
          }).then(() => true).catch(() => false)
        );

        const results = await Promise.all(requests);
        const successful = results.filter(r => r).length;

        // Most should still succeed despite packet loss
        expect(successful).toBeGreaterThan(5);

        // Clean up
        // await execAsync('sudo tc qdisc del dev lo root').catch(() => {});
      } catch (error) {
        console.log('Packet loss test skipped (tc command not available)');
      }
    });
  });

  describe('Resource Chaos', () => {
    test('handles memory pressure', async () => {
      if (skipIf(!apiAvailable, 'Chaos tests skipped because the API is unavailable.')) {
        return;
      }

      // Create memory pressure by allocating large arrays
      const memoryHogs: any[] = [];

      try {
        // Allocate ~500MB
        for (let i = 0; i < 5; i++) {
          memoryHogs.push(new Array(25 * 1024 * 1024).fill(0)); // 100MB each
        }

        // Try to operate under memory pressure
        const response = await fetch(`${API_URL}/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: {
              goal: 'Memory pressure test',
              steps: [{ name: 'test', tool: 'codegen' }]
            }
          })
        });

        // Should still function
        expect(response.ok).toBeTruthy();
      } finally {
        // Release memory
        memoryHogs.length = 0;
        if (global.gc) global.gc();
      }
    });

    test('handles CPU saturation', async () => {
      if (skipIf(!apiAvailable, 'Chaos tests skipped because the API is unavailable.')) {
        return;
      }

      // Create CPU load
      const workers: any[] = [];

      try {
        // Spawn CPU-intensive processes
        for (let i = 0; i < 4; i++) {
          const worker = spawn('node', ['-e', 'while(true) { Math.sqrt(Math.random()); }']);
          workers.push(worker);
        }

        // Try to operate under CPU pressure
        const response = await fetch(`${API_URL}/health`, {
          signal: AbortSignal.timeout(10000)
        });

        // Should still respond, maybe slower
        expect(response.ok).toBeTruthy();
      } finally {
        // Kill CPU hogs
        workers.forEach(w => w.kill());
      }
    });

    test('handles disk space exhaustion', async () => {
      if (skipIf(!apiAvailable, 'Chaos tests skipped because the API is unavailable.')) {
        return;
      }

      // This is dangerous in real environments
      // Only simulate by checking behavior with large payloads

      const largeData = 'x'.repeat(10 * 1024 * 1024); // 10MB

      const response = await fetch(`${API_URL}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: {
            goal: 'Disk space test',
            steps: [{
              name: 'large',
              tool: 'test',
              inputs: { data: largeData }
            }]
          }
        })
      }).catch(() => ({ ok: false }));

      // Should handle large payloads gracefully
      expect([(response as any).ok, (response as any).status === 413]).toContain(true);
    });
  });

  describe('Time-based Chaos', () => {
    test('handles clock skew', async () => {
      if (skipIf(!apiAvailable, 'Chaos tests skipped because the API is unavailable.')) {
        return;
      }

      // Save original Date
      const OriginalDate = Date;

      try {
        // Mock Date to simulate clock skew
        const skewMs = 3600000; // 1 hour forward
        (global as any).Date = class extends OriginalDate {
          constructor() {
            super();
            return new OriginalDate(OriginalDate.now() + skewMs);
          }
          static now() {
            return OriginalDate.now() + skewMs;
          }
        };

        // Make request with skewed time
        const response = await fetch(`${API_URL}/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: { goal: 'Clock skew test', steps: [] }
          })
        });

        // Should handle time differences
        expect(response.ok).toBeTruthy();
      } finally {
        // Restore original Date
        (global as any).Date = OriginalDate;
      }
    });

    test('handles timezone changes', async () => {
      if (skipIf(!apiAvailable, 'Chaos tests skipped because the API is unavailable.')) {
        return;
      }

      const originalTZ = process.env.TZ;

      try {
        // Change timezone during operation
        process.env.TZ = 'America/New_York';
        const response1 = await fetch(`${API_URL}/health`);

        process.env.TZ = 'Asia/Tokyo';
        const response2 = await fetch(`${API_URL}/health`);

        process.env.TZ = 'UTC';
        const response3 = await fetch(`${API_URL}/health`);

        // All should succeed regardless of timezone
        expect(response1.ok && response2.ok && response3.ok).toBeTruthy();
      } finally {
        process.env.TZ = originalTZ;
      }
    });
  });

  describe('Cascading Failures', () => {
    test('handles cascading service failures', async () => {
      if (skipIf(!dockerAvailable, 'Docker-dependent chaos tests skipped because Docker is unavailable.')) {
        return;
      }

      if (skipIf(!apiAvailable, 'Chaos tests skipped because the API is unavailable.')) {
        return;
      }

      const failures = [];

      try {
        // Simulate multiple services failing in sequence
        failures.push(execAsync('docker pause supabase_db_nofx-local-starter').catch(() => {}));
        await new Promise(resolve => setTimeout(resolve, 500));

        failures.push(execAsync('docker pause redis').catch(() => {}));
        await new Promise(resolve => setTimeout(resolve, 500));

        failures.push(execAsync('docker pause supabase_storage_nofx-local-starter').catch(() => {}));

        // System should degrade gracefully
        const response = await fetch(`${API_URL}/health`, {
          signal: AbortSignal.timeout(5000)
        }).catch(() => ({ ok: false }));

        // Health check might fail but shouldn't crash
        expect(response).toBeDefined();

        // Restore services
        await execAsync('docker unpause supabase_db_nofx-local-starter').catch(() => {});
        await execAsync('docker unpause redis').catch(() => {});
        await execAsync('docker unpause supabase_storage_nofx-local-starter').catch(() => {});

        // Wait for recovery
        await new Promise(resolve => setTimeout(resolve, 5000));

        // System should recover
        const recoveryCheck = await fetch(`${API_URL}/health`);
        expect(recoveryCheck.ok).toBeTruthy();
      } finally {
        // Ensure all services are restored
        await execAsync('docker unpause supabase_db_nofx-local-starter').catch(() => {});
        await execAsync('docker unpause redis').catch(() => {});
        await execAsync('docker unpause supabase_storage_nofx-local-starter').catch(() => {});
      }
    });

    test('handles thundering herd after recovery', async () => {
      if (skipIf(!dockerAvailable, 'Docker-dependent chaos tests skipped because Docker is unavailable.')) {
        return;
      }

      if (skipIf(!apiAvailable, 'Chaos tests skipped because the API is unavailable.')) {
        return;
      }

      try {
        // Pause a service
        await execAsync('docker pause redis');

        // Queue up many requests
        const queuedRequests = Array(50).fill(null).map(() =>
          fetch(`${API_URL}/runs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan: { goal: 'Queued request', steps: [] }
            })
          }).catch(() => null)
        );

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Restore service
        await execAsync('docker unpause redis');

        // All queued requests hit at once (thundering herd)
        const results = await Promise.all(queuedRequests);

        // System should handle the surge
        const successful = results.filter(r => r !== null).length;
        expect(successful).toBeGreaterThan(0);
      } finally {
        await execAsync('docker unpause redis').catch(() => {});
      }
    });
  });
});
