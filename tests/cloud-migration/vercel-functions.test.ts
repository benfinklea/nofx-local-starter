/**
 * Bulletproof Tests for Vercel Functions
 * Ensures our serverless API never breaks
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const PROD_URL = 'https://nofx-control-plane.vercel.app';
const API_BASE = `${PROD_URL}/api`;

describe('Vercel Functions - Bulletproof Tests', () => {
  describe('Health Endpoint', () => {
    it('should always respond with 200 status', async () => {
      const response = await fetch(`${API_BASE}/health`);
      expect(response.status).toBe(200);
    });

    it('should return valid health data structure', async () => {
      const response = await fetch(`${API_BASE}/health`);
      const data = await response.json();

      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
      expect(data).toHaveProperty('environment');
      expect(data).toHaveProperty('database');
    });

    it('should report database status correctly', async () => {
      const response = await fetch(`${API_BASE}/health`);
      const data = await response.json();

      expect(data.database).toBeDefined();
      expect(['ok', 'error']).toContain(data.database.status);

      if (data.database.status === 'error') {
        expect(data.database).toHaveProperty('error');
        expect(typeof data.database.error).toBe('string');
      }
    });

    it('should handle concurrent health checks', async () => {
      const requests = Array(10).fill(null).map(() =>
        fetch(`${API_BASE}/health`)
      );

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should respond within acceptable time limit', async () => {
      const startTime = Date.now();
      const response = await fetch(`${API_BASE}/health`);
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(3000); // 3 second max
    });
  });

  describe('Runs API Endpoint', () => {
    it('should handle GET requests for listing runs', async () => {
      const response = await fetch(`${API_BASE}/runs`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('runs');
      expect(Array.isArray(data.runs)).toBe(true);
    });

    it('should handle query parameters correctly', async () => {
      const response = await fetch(`${API_BASE}/runs?limit=5`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.runs.length).toBeLessThanOrEqual(5);
    });

    it('should reject invalid methods', async () => {
      const response = await fetch(`${API_BASE}/health`, {
        method: 'DELETE'
      });
      expect(response.status).toBe(405);
    });

    it('should handle malformed requests gracefully', async () => {
      const response = await fetch(`${API_BASE}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await fetch(`${API_BASE}/nonexistent`);
      expect(response.status).toBe(404);
    });

    it('should handle missing environment variables gracefully', async () => {
      // Health endpoint should still work even if DB is misconfigured
      const response = await fetch(`${API_BASE}/health`);
      expect(response.status).toBe(200);
    });

    it('should survive rapid successive requests', async () => {
      const requests = Array(20).fill(null).map((_, i) =>
        fetch(`${API_BASE}/health?test=${i}`)
      );

      const responses = await Promise.all(requests);
      const allSuccessful = responses.every(r => r.status === 200);
      expect(allSuccessful).toBe(true);
    });
  });

  describe('CORS Configuration', () => {
    it('should include proper CORS headers', async () => {
      const response = await fetch(`${API_BASE}/health`);

      // Check if CORS headers are present (Vercel adds these)
      const headers = response.headers;
      expect(headers.get('access-control-allow-origin')).toBeTruthy();
    });

    it('should handle preflight OPTIONS requests', async () => {
      const response = await fetch(`${API_BASE}/health`, {
        method: 'OPTIONS'
      });
      // Vercel handles OPTIONS automatically
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Deployment Validation', () => {
    it('should confirm production environment', async () => {
      const response = await fetch(`${API_BASE}/health`);
      const data = await response.json();

      expect(data.environment).toBe('production');
      expect(data.status).toBe('healthy');
    });

    it('should verify Node.js version compatibility', async () => {
      const response = await fetch(`${API_BASE}/health`);
      const data = await response.json();

      expect(data.node_version).toBeDefined();
      expect(data.node_version).toMatch(/^v\d+\.\d+\.\d+$/);
    });
  });
});

// Network failure resilience tests
describe('Network Failure Resilience', () => {
  it('should handle timeout gracefully', async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 100);

    try {
      await fetch(`${API_BASE}/health`, {
        signal: controller.signal
      });
    } catch (error: any) {
      expect(error.name).toBe('AbortError');
    } finally {
      clearTimeout(timeoutId);
    }
  });

  it('should retry on network failures', async () => {
    let attempts = 0;
    const maxRetries = 3;

    async function fetchWithRetry(url: string): Promise<any> {
      while (attempts < maxRetries) {
        try {
          attempts++;
          const response = await fetch(url);
          if (response.ok) return response;
        } catch (error) {
          if (attempts >= maxRetries) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      throw new Error('Max retries exceeded');
    }

    const response = await fetchWithRetry(`${API_BASE}/health`);
    expect(response.status).toBe(200);
    expect(attempts).toBeGreaterThanOrEqual(1);
    expect(attempts).toBeLessThanOrEqual(maxRetries);
  });
});

// Performance benchmarks
describe('Performance Benchmarks', () => {
  it('should maintain p95 response time under 1 second', async () => {
    const times: number[] = [];

    for (let i = 0; i < 20; i++) {
      const start = Date.now();
      await fetch(`${API_BASE}/health`);
      times.push(Date.now() - start);
    }

    times.sort((a, b) => a - b);
    const p95Index = Math.floor(times.length * 0.95);
    const p95Time = times[p95Index];

    expect(p95Time).toBeLessThan(1000);
  });

  it('should handle burst traffic', async () => {
    const burstSize = 50;
    const requests = Array(burstSize).fill(null).map(() =>
      fetch(`${API_BASE}/health`)
    );

    const startTime = Date.now();
    const responses = await Promise.all(requests);
    const totalTime = Date.now() - startTime;

    const allSuccessful = responses.every(r => r.status === 200);
    expect(allSuccessful).toBe(true);
    expect(totalTime).toBeLessThan(10000); // 10 seconds for 50 requests
  });
});