/**
 * Test Helper Utilities for Integration and E2E Tests
 * Provides common functionality for waiting, polling, and assertions
 */

/**
 * Wait for a condition to become true with timeout
 */
export async function waitForCondition(
  conditionFn: () => Promise<boolean>,
  timeoutMs: number = 30000,
  pollIntervalMs: number = 500
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await conditionFn();
      if (result) {
        return;
      }
    } catch (error) {
      // Continue polling on error
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

/**
 * Calculate percentile from array of numbers
 */
export function percentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] ?? 0;
}

/**
 * Generate test payload with random data
 */
export function generateTestPayload(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    action: 'process',
    timestamp: new Date().toISOString(),
    data: {
      testId: Math.random().toString(36).substring(7),
      ...overrides
    }
  };
}

/**
 * Retry function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('All retries failed');
}

/**
 * Mock webhook receiver for testing
 */
export class WebhookReceiver {
  private server: any;
  private port: number = 0;
  private receivedWebhooks: Array<{
    body: any;
    headers: Record<string, string>;
    timestamp: Date;
  }> = [];
  private webhookPromise: Promise<any> | null = null;
  private webhookResolve: ((value: any) => void) | null = null;

  async start(): Promise<string> {
    const express = require('express');
    const app = express();

    app.use(express.json());

    app.post('/webhook', (req: any, res: any) => {
      const webhook = {
        body: req.body,
        headers: req.headers,
        timestamp: new Date()
      };

      this.receivedWebhooks.push(webhook);

      if (this.webhookResolve) {
        this.webhookResolve(webhook);
        this.webhookResolve = null;
        this.webhookPromise = null;
      }

      res.status(200).json({ received: true });
    });

    return new Promise((resolve) => {
      this.server = app.listen(0, () => {
        this.port = this.server.address().port;
        resolve(`http://localhost:${this.port}/webhook`);
      });
    });
  }

  async waitForWebhook(timeoutMs: number = 30000): Promise<any> {
    if (this.receivedWebhooks.length > 0) {
      return this.receivedWebhooks[this.receivedWebhooks.length - 1];
    }

    this.webhookPromise = new Promise((resolve, reject) => {
      this.webhookResolve = resolve;

      setTimeout(() => {
        reject(new Error(`No webhook received within ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return this.webhookPromise;
  }

  getReceivedWebhooks() {
    return this.receivedWebhooks;
  }

  async stop() {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server.close(() => resolve());
      });
    }
  }
}

/**
 * Performance metrics collector
 */
export class PerformanceMetrics {
  private measurements: number[] = [];

  record(durationMs: number): void {
    this.measurements.push(durationMs);
  }

  getP50(): number {
    return percentile(this.measurements, 50);
  }

  getP95(): number {
    return percentile(this.measurements, 95);
  }

  getP99(): number {
    return percentile(this.measurements, 99);
  }

  getAverage(): number {
    if (this.measurements.length === 0) return 0;
    return this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length;
  }

  getMin(): number {
    return Math.min(...this.measurements);
  }

  getMax(): number {
    return Math.max(...this.measurements);
  }

  getCount(): number {
    return this.measurements.length;
  }

  reset(): void {
    this.measurements = [];
  }
}

/**
 * Test data factory for creating consistent test data
 */
export class TestDataFactory {
  static createRunPlan(overrides: Record<string, any> = {}) {
    return {
      goal: 'Test run execution',
      steps: [
        {
          name: 'test-step-1',
          tool: 'codegen',
          inputs: {
            prompt: 'Generate test code'
          }
        }
      ],
      ...overrides
    };
  }

  static createProject(overrides: Record<string, any> = {}) {
    return {
      name: `test-project-${Date.now()}`,
      template: 'nodejs-express',
      settings: {
        environment: 'development',
        nodeVersion: '18'
      },
      ...overrides
    };
  }

  static createUser(overrides: Record<string, any> = {}) {
    const id = Math.random().toString(36).substring(7);
    return {
      email: `test-user-${id}@example.com`,
      password: 'SecurePass123!',
      firstName: 'Test',
      lastName: 'User',
      ...overrides
    };
  }
}
