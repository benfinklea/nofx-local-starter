/**
 * Test Helper Utilities for Authentication & Security Tests
 * Provides factories, mocks, and utilities for comprehensive testing
 */

import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
// Import to ensure Express Request type extensions are available
import '../middleware';

/**
 * User factory for creating test users
 */
export class UserFactory {
  static createUser(overrides: Partial<any> = {}) {
    return {
      id: overrides.id || `user_${crypto.randomBytes(8).toString('hex')}`,
      email: overrides.email || `test_${Date.now()}@example.com`,
      full_name: overrides.full_name || 'Test User',
      role: overrides.role || 'user',
      aud: 'authenticated',
      ...overrides
    };
  }

  static createAdminUser(overrides: Partial<any> = {}) {
    return this.createUser({
      role: 'admin',
      ...overrides
    });
  }
}

/**
 * API Key factory for creating test API keys
 */
export class ApiKeyFactory {
  static generateKey(): string {
    return 'nofx_test_' + crypto.randomBytes(32).toString('hex');
  }

  static createApiKeyData(overrides: Partial<any> = {}) {
    return {
      id: overrides.id || `key_${crypto.randomBytes(8).toString('hex')}`,
      user_id: overrides.user_id || 'user123',
      name: overrides.name || 'Test API Key',
      key_hash: overrides.key_hash || crypto.createHash('sha256').update('test_key').digest('hex'),
      permissions: overrides.permissions || ['read', 'write'],
      created_at: overrides.created_at || new Date().toISOString(),
      last_used_at: overrides.last_used_at || null,
      is_active: overrides.is_active !== undefined ? overrides.is_active : true,
      ...overrides
    };
  }
}

/**
 * Request/Response mock factory
 */
export class MockFactory {
  static createRequest(overrides: Partial<Request> = {}): Partial<Request> {
    const req: Partial<Request> = {
      headers: {},
      cookies: {},
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1',
      params: {},
      body: {},
      query: {},
      ...overrides
    };

    // Add custom properties
    if (overrides.userId !== undefined) (req as any).userId = overrides.userId;
    if (overrides.user !== undefined) (req as any).user = overrides.user;
    if (overrides.userTier !== undefined) (req as any).userTier = overrides.userTier;

    return req;
  }

  static createResponse(): { res: Partial<Response>; mocks: any } {
    const mockStatus = jest.fn().mockReturnThis();
    const mockJson = jest.fn().mockReturnThis();
    const mockSetHeader = jest.fn().mockReturnThis();
    const mockOn = jest.fn();

    const res: Partial<Response> = {
      status: mockStatus,
      json: mockJson,
      setHeader: mockSetHeader,
      on: mockOn,
      statusCode: 200
    };

    return {
      res,
      mocks: {
        status: mockStatus,
        json: mockJson,
        setHeader: mockSetHeader,
        on: mockOn
      }
    };
  }

  static createNext(): jest.MockedFunction<NextFunction> {
    return jest.fn() as jest.MockedFunction<NextFunction>;
  }
}

/**
 * Supabase mock factory
 */
export class SupabaseMockFactory {
  static createMockClient(data: any = null, error: any = null) {
    return {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data, error }),
      order: jest.fn().mockReturnThis()
    };
  }

  static createSuccessResponse(data: any) {
    return { data, error: null };
  }

  static createErrorResponse(message: string) {
    return { data: null, error: { message } };
  }
}

/**
 * Security test utilities
 */
export class SecurityTestUtils {
  /**
   * Common malicious input patterns for injection testing
   */
  static getMaliciousInputs() {
    return {
      sqlInjection: [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "1 UNION SELECT * FROM users",
        "'; EXEC sp_executesql N'SELECT * FROM users'; --"
      ],
      xss: [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert(1)>',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<svg onload=alert(1)>'
      ],
      pathTraversal: [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        'file:///etc/passwd',
        '/../../sensitive-file'
      ],
      headerInjection: [
        'test\r\nX-Admin: true',
        'test\nAuthorization: Bearer admin',
        'test%0AX-Bypass: true'
      ],
      oversized: [
        'a'.repeat(100000),
        'b'.repeat(1000000)
      ]
    };
  }

  /**
   * Generate timing attack resistant test
   */
  static async timingAttackTest(
    authenticFunc: () => Promise<any>,
    iterations: number = 100
  ): Promise<{ average: number; stdDev: number; isResistant: boolean }> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await authenticFunc().catch(() => {});
      const end = process.hrtime.bigint();
      times.push(Number(end - start) / 1000000); // Convert to ms
    }

    const average = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);

    // Timing attack resistant if standard deviation is low relative to mean
    const isResistant = stdDev / average < 0.1; // Less than 10% variation

    return { average, stdDev, isResistant };
  }
}

/**
 * Rate limiting test utilities
 */
export class RateLimitTestUtils {
  /**
   * Simulate burst of requests
   */
  static async simulateRequestBurst(
    requestFunc: () => Promise<any>,
    count: number
  ): Promise<{ successful: number; rateLimited: number }> {
    const results = await Promise.allSettled(
      Array(count).fill(null).map(() => requestFunc())
    );

    return {
      successful: results.filter(r => r.status === 'fulfilled').length,
      rateLimited: results.filter(r => r.status === 'rejected').length
    };
  }

  /**
   * Test rate limit window behavior
   */
  static async testRateLimitWindow(
    requestFunc: () => Promise<boolean>,
    limit: number,
    windowMs: number
  ): Promise<{ withinLimit: boolean; afterReset: boolean }> {
    // Make requests up to limit
    const withinLimitResults = await Promise.all(
      Array(limit).fill(null).map(() => requestFunc())
    );
    const withinLimit = withinLimitResults.every(r => r === true);

    // Try one more (should be blocked)
    const exceededResult = await requestFunc();
    const correctlyBlocked = exceededResult === false;

    // Wait for window to reset
    await new Promise(resolve => setTimeout(resolve, windowMs + 100));

    // Should work again after reset
    const afterReset = await requestFunc();

    return {
      withinLimit: withinLimit && correctlyBlocked,
      afterReset
    };
  }
}

/**
 * Performance benchmarking utilities
 */
export class PerformanceTestUtils {
  /**
   * Measure function execution time
   */
  static async measureExecutionTime(
    func: () => Promise<any>
  ): Promise<number> {
    const start = process.hrtime.bigint();
    await func();
    const end = process.hrtime.bigint();
    return Number(end - start) / 1000000; // Convert to ms
  }

  /**
   * Benchmark function with multiple iterations
   */
  static async benchmark(
    func: () => Promise<any>,
    iterations: number = 100
  ): Promise<{
    min: number;
    max: number;
    average: number;
    median: number;
    p95: number;
    p99: number;
  }> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const time = await this.measureExecutionTime(func);
      times.push(time);
    }

    times.sort((a, b) => a - b);

    return {
      min: times[0],
      max: times[times.length - 1],
      average: times.reduce((a, b) => a + b, 0) / times.length,
      median: times[Math.floor(times.length / 2)],
      p95: times[Math.floor(times.length * 0.95)],
      p99: times[Math.floor(times.length * 0.99)]
    };
  }

  /**
   * Assert performance threshold
   */
  static assertPerformance(
    actualMs: number,
    thresholdMs: number,
    operation: string
  ): void {
    if (actualMs > thresholdMs) {
      throw new Error(
        `Performance threshold exceeded for ${operation}: ${actualMs}ms > ${thresholdMs}ms`
      );
    }
  }
}

/**
 * Mock time utilities
 */
export class TimeTestUtils {
  private static originalDateNow = Date.now;

  /**
   * Mock current time
   */
  static mockTime(timestamp: number): void {
    Date.now = jest.fn(() => timestamp);
  }

  /**
   * Advance time by milliseconds
   */
  static advanceTime(ms: number): void {
    const current = Date.now();
    Date.now = jest.fn(() => current + ms);
  }

  /**
   * Restore original time
   */
  static restoreTime(): void {
    Date.now = this.originalDateNow;
  }

  /**
   * Test with expired token scenario
   */
  static simulateExpiredToken(expirationMs: number = 3600000): {
    issuedAt: number;
    expiresAt: number;
    currentTime: number;
  } {
    const issuedAt = Date.now() - expirationMs - 1000; // Expired 1 second ago
    const expiresAt = issuedAt + expirationMs;
    const currentTime = Date.now();

    return { issuedAt, expiresAt, currentTime };
  }
}

/**
 * Concurrency test utilities
 */
export class ConcurrencyTestUtils {
  /**
   * Run multiple concurrent operations
   */
  static async runConcurrent<T>(
    func: () => Promise<T>,
    count: number
  ): Promise<Array<{ status: 'success' | 'error'; result?: T; error?: any }>> {
    const results = await Promise.allSettled(
      Array(count).fill(null).map(() => func())
    );

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return { status: 'success', result: result.value };
      } else {
        return { status: 'error', error: result.reason };
      }
    });
  }

  /**
   * Test for race conditions
   */
  static async testRaceCondition(
    setup: () => Promise<void>,
    operation: () => Promise<any>,
    verify: (results: any[]) => boolean,
    iterations: number = 10
  ): Promise<boolean> {
    for (let i = 0; i < iterations; i++) {
      await setup();
      const results = await Promise.all(
        Array(5).fill(null).map(() => operation())
      );

      if (!verify(results)) {
        return false; // Race condition detected
      }
    }

    return true; // No race condition detected
  }
}

/**
 * JWT token test utilities
 */
export class JwtTestUtils {
  /**
   * Create mock JWT payload
   */
  static createJwtPayload(overrides: any = {}) {
    return {
      sub: overrides.sub || 'user123',
      email: overrides.email || 'test@example.com',
      aud: overrides.aud || 'authenticated',
      role: overrides.role || 'user',
      iat: overrides.iat || Math.floor(Date.now() / 1000),
      exp: overrides.exp || Math.floor(Date.now() / 1000) + 3600,
      ...overrides
    };
  }

  /**
   * Create expired JWT payload
   */
  static createExpiredJwtPayload(overrides: any = {}) {
    const now = Math.floor(Date.now() / 1000);
    return this.createJwtPayload({
      iat: now - 7200,
      exp: now - 3600, // Expired 1 hour ago
      ...overrides
    });
  }

  /**
   * Create malformed JWT scenarios
   */
  static getMalformedTokens() {
    return [
      '', // Empty
      'invalid', // No structure
      'header.payload', // Missing signature
      'header.payload.signature.extra', // Too many parts
      'header..signature', // Empty payload
      '.payload.signature', // Empty header
      'header.payload.', // Empty signature
      Buffer.from('malicious').toString('base64'), // Non-JWT format
      'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyIn0.', // Algorithm "none"
    ];
  }
}

/**
 * Audit log test utilities
 */
export class AuditLogTestUtils {
  /**
   * Verify audit log was created
   */
  static verifyAuditLogCreated(
    createAuditLogMock: jest.Mock,
    expectedAction: string,
    expectedUserId: string
  ): boolean {
    const calls = createAuditLogMock.mock.calls;
    return calls.some(call =>
      call[0] === expectedUserId && call[1] === expectedAction
    );
  }

  /**
   * Extract audit log data
   */
  static extractAuditLogData(createAuditLogMock: jest.Mock): any[] {
    return createAuditLogMock.mock.calls.map(call => ({
      userId: call[0],
      action: call[1],
      resourceType: call[2],
      resourceId: call[3],
      metadata: call[4],
      request: call[5]
    }));
  }
}
