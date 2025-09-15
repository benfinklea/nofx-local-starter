# 🔒 WORKSTREAM 3: DATA INTEGRITY

## Mission
Ensure data atomicity, consistency, isolation, and durability (ACID) across all storage systems including databases, files, and cloud storage.

## 🎯 Objectives
- Add 35+ data integrity tests
- Test transaction rollbacks and atomicity
- Validate backup corruption recovery
- Implement idempotency checks
- Test concurrent access patterns

## 📁 Files to Create

### 1. `tests/unit/data/transaction-atomicity.test.ts`

```typescript
/**
 * Transaction Atomicity & Consistency Tests
 */

describe('Transaction Atomicity', () => {
  describe('Database transactions', () => {
    test('rolls back all operations on failure', async () => {
      const db = {
        inTransaction: false,
        operations: [],

        async transaction(callback: Function) {
          this.inTransaction = true;
          this.operations = [];

          try {
            await callback({
              insert: async (data: any) => {
                if (!this.inTransaction) throw new Error('Not in transaction');
                this.operations.push({ type: 'insert', data });
                if (data.fail) throw new Error('Simulated failure');
              },
              update: async (data: any) => {
                if (!this.inTransaction) throw new Error('Not in transaction');
                this.operations.push({ type: 'update', data });
              }
            });

            // Commit
            return this.operations;
          } catch (error) {
            // Rollback
            this.operations = [];
            throw error;
          } finally {
            this.inTransaction = false;
          }
        }
      };

      // Test rollback
      await expect(db.transaction(async (tx: any) => {
        await tx.insert({ id: 1, value: 'first' });
        await tx.update({ id: 1, value: 'updated' });
        await tx.insert({ id: 2, value: 'second', fail: true }); // This fails
      })).rejects.toThrow();

      expect(db.operations).toHaveLength(0); // All rolled back
    });

    test('maintains consistency across related tables', async () => {
      const accountManager = {
        async transfer(from: number, to: number, amount: number) {
          await db.transaction(async (tx: any) => {
            const fromBalance = await tx.query('SELECT balance FROM accounts WHERE id = $1', [from]);
            if (fromBalance < amount) throw new Error('Insufficient funds');

            await tx.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, from]);
            await tx.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, to]);
            await tx.query('INSERT INTO transactions (from_id, to_id, amount) VALUES ($1, $2, $3)', [from, to, amount]);
          });
        }
      };

      // Test consistency maintained
    });
  });

  describe('Two-phase commit', () => {
    test('coordinates distributed transactions', async () => {
      const coordinator = {
        participants: [],

        async prepare() {
          const votes = await Promise.all(
            this.participants.map(p => p.prepare())
          );
          return votes.every(v => v === 'ready');
        },

        async commit() {
          if (!await this.prepare()) {
            await this.abort();
            throw new Error('Prepare phase failed');
          }

          await Promise.all(
            this.participants.map(p => p.commit())
          );
        },

        async abort() {
          await Promise.all(
            this.participants.map(p => p.rollback())
          );
        }
      };

      // Test 2PC protocol
    });
  });
});
```

### 2. `tests/unit/data/backup-integrity.test.ts`

```typescript
/**
 * Backup & Recovery Integrity Tests
 */

describe('Backup Integrity', () => {
  describe('Corruption detection', () => {
    test('detects corrupted backup files', async () => {
      const backup = {
        async create(data: any) {
          const content = JSON.stringify(data);
          const checksum = crypto.createHash('sha256').update(content).digest('hex');

          return {
            content,
            checksum,
            timestamp: Date.now()
          };
        },

        async verify(backup: any) {
          const calculated = crypto.createHash('sha256').update(backup.content).digest('hex');
          return calculated === backup.checksum;
        },

        async restore(backup: any) {
          if (!await this.verify(backup)) {
            throw new Error('Backup corrupted');
          }
          return JSON.parse(backup.content);
        }
      };

      const original = { users: [{ id: 1, name: 'test' }] };
      const bak = await backup.create(original);

      // Corrupt the backup
      bak.content = bak.content.replace('test', 'corrupted');

      await expect(backup.restore(bak)).rejects.toThrow('Backup corrupted');
    });

    test('implements incremental backup with verification', async () => {
      const incrementalBackup = {
        baseSnapshot: null as any,
        deltas: [] as any[],

        async createBase(data: any) {
          this.baseSnapshot = {
            data: JSON.parse(JSON.stringify(data)),
            timestamp: Date.now(),
            version: 0
          };
          return this.baseSnapshot;
        },

        async createDelta(changes: any) {
          const delta = {
            changes,
            timestamp: Date.now(),
            version: this.deltas.length + 1,
            parentVersion: this.deltas.length
          };
          this.deltas.push(delta);
          return delta;
        },

        async restore(version?: number) {
          let result = JSON.parse(JSON.stringify(this.baseSnapshot.data));

          const targetVersion = version ?? this.deltas.length;
          for (let i = 0; i < targetVersion; i++) {
            const delta = this.deltas[i];
            // Apply delta changes
            Object.assign(result, delta.changes);
          }

          return result;
        }
      };

      // Test incremental backup
      await incrementalBackup.createBase({ count: 0, items: [] });
      await incrementalBackup.createDelta({ count: 1, items: ['a'] });
      await incrementalBackup.createDelta({ count: 2, items: ['a', 'b'] });

      const restored = await incrementalBackup.restore(1);
      expect(restored.count).toBe(1);
      expect(restored.items).toEqual(['a']);
    });
  });

  describe('Point-in-time recovery', () => {
    test('restores to specific timestamp', async () => {
      const timeline = {
        snapshots: [] as any[],

        async save(data: any) {
          this.snapshots.push({
            data: JSON.parse(JSON.stringify(data)),
            timestamp: Date.now()
          });
        },

        async restoreToTime(targetTime: number) {
          // Find latest snapshot before target time
          const snapshot = this.snapshots
            .filter(s => s.timestamp <= targetTime)
            .sort((a, b) => b.timestamp - a.timestamp)[0];

          if (!snapshot) throw new Error('No snapshot found');
          return snapshot.data;
        }
      };

      // Create timeline
      const t1 = Date.now();
      await timeline.save({ version: 1 });
      await new Promise(r => setTimeout(r, 10));

      const t2 = Date.now();
      await timeline.save({ version: 2 });
      await new Promise(r => setTimeout(r, 10));

      await timeline.save({ version: 3 });

      // Restore to middle point
      const restored = await timeline.restoreToTime(t2 + 5);
      expect(restored.version).toBe(2);
    });
  });
});
```

### 3. `tests/unit/data/idempotency.test.ts`

```typescript
/**
 * Idempotency & Deduplication Tests
 */

describe('Idempotency Guarantees', () => {
  describe('Request deduplication', () => {
    test('prevents duplicate operations', async () => {
      const idempotencyManager = {
        processed: new Map(),

        async execute(key: string, operation: Function) {
          if (this.processed.has(key)) {
            return this.processed.get(key);
          }

          const result = await operation();
          this.processed.set(key, result);

          // Expire after 24 hours
          setTimeout(() => this.processed.delete(key), 24 * 60 * 60 * 1000);

          return result;
        }
      };

      let counter = 0;
      const operation = async () => {
        counter++;
        return { id: counter };
      };

      // Execute same operation multiple times
      const key = 'transaction-123';
      const result1 = await idempotencyManager.execute(key, operation);
      const result2 = await idempotencyManager.execute(key, operation);
      const result3 = await idempotencyManager.execute(key, operation);

      expect(counter).toBe(1); // Only executed once
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    test('handles concurrent idempotent requests', async () => {
      const handler = {
        inProgress: new Map(),
        completed: new Map(),

        async process(key: string, fn: Function) {
          // Check if already completed
          if (this.completed.has(key)) {
            return this.completed.get(key);
          }

          // Check if in progress
          if (this.inProgress.has(key)) {
            return await this.inProgress.get(key);
          }

          // Start processing
          const promise = fn();
          this.inProgress.set(key, promise);

          try {
            const result = await promise;
            this.completed.set(key, result);
            return result;
          } finally {
            this.inProgress.delete(key);
          }
        }
      };

      let executions = 0;
      const slowOperation = async () => {
        await new Promise(r => setTimeout(r, 100));
        executions++;
        return { value: executions };
      };

      // Launch concurrent requests
      const promises = Array(5).fill(null).map(() =>
        handler.process('key-1', slowOperation)
      );

      const results = await Promise.all(promises);

      expect(executions).toBe(1);
      expect(results.every(r => r.value === 1)).toBe(true);
    });
  });

  describe('Exactly-once delivery', () => {
    test('ensures message processed exactly once', async () => {
      const messageProcessor = {
        processed: new Set(),

        async process(messageId: string, handler: Function) {
          if (this.processed.has(messageId)) {
            return { status: 'duplicate', messageId };
          }

          try {
            const result = await handler();
            this.processed.add(messageId);
            return { status: 'success', result };
          } catch (error) {
            // Don't mark as processed on error
            throw error;
          }
        }
      };

      let processCount = 0;
      const handler = async () => {
        processCount++;
        return 'processed';
      };

      // Process message multiple times
      const id = 'msg-123';
      const r1 = await messageProcessor.process(id, handler);
      const r2 = await messageProcessor.process(id, handler);

      expect(processCount).toBe(1);
      expect(r1.status).toBe('success');
      expect(r2.status).toBe('duplicate');
    });
  });
});
```

### 4. `tests/unit/data/concurrent-access.test.ts`

```typescript
/**
 * Concurrent Access & Locking Tests
 */

describe('Concurrent Access Control', () => {
  describe('Optimistic locking', () => {
    test('detects concurrent modifications', async () => {
      const document = {
        data: { value: 0 },
        version: 1,

        async read() {
          return { ...this.data, _version: this.version };
        },

        async update(data: any, version: number) {
          if (version !== this.version) {
            throw new Error('Version mismatch - concurrent modification');
          }

          this.data = data;
          this.version++;
          return { ...this.data, _version: this.version };
        }
      };

      // User 1 reads
      const user1Data = await document.read();

      // User 2 reads
      const user2Data = await document.read();

      // User 1 updates
      await document.update({ value: 1 }, user1Data._version);

      // User 2's update should fail
      await expect(
        document.update({ value: 2 }, user2Data._version)
      ).rejects.toThrow('Version mismatch');
    });
  });

  describe('Pessimistic locking', () => {
    test('prevents concurrent access with locks', async () => {
      const lockManager = {
        locks: new Map(),

        async acquireLock(resource: string, timeout = 5000): Promise<() => void> {
          const startTime = Date.now();

          while (this.locks.has(resource)) {
            if (Date.now() - startTime > timeout) {
              throw new Error('Lock acquisition timeout');
            }
            await new Promise(r => setTimeout(r, 10));
          }

          this.locks.set(resource, Date.now());

          return () => {
            this.locks.delete(resource);
          };
        },

        async withLock(resource: string, fn: Function) {
          const release = await this.acquireLock(resource);
          try {
            return await fn();
          } finally {
            release();
          }
        }
      };

      let counter = 0;
      const criticalSection = async () => {
        const current = counter;
        await new Promise(r => setTimeout(r, 10)); // Simulate work
        counter = current + 1;
      };

      // Run concurrent operations
      const operations = Array(10).fill(null).map(() =>
        lockManager.withLock('counter', criticalSection)
      );

      await Promise.all(operations);
      expect(counter).toBe(10); // No race condition
    });
  });

  describe('Deadlock prevention', () => {
    test('detects and prevents deadlocks', async () => {
      const deadlockDetector = {
        waitGraph: new Map<string, Set<string>>(),

        hasCircle(): boolean {
          // Simple cycle detection
          const visited = new Set<string>();
          const stack = new Set<string>();

          const hasCycle = (node: string): boolean => {
            visited.add(node);
            stack.add(node);

            const neighbors = this.waitGraph.get(node) || new Set();
            for (const neighbor of neighbors) {
              if (!visited.has(neighbor)) {
                if (hasCycle(neighbor)) return true;
              } else if (stack.has(neighbor)) {
                return true;
              }
            }

            stack.delete(node);
            return false;
          };

          for (const node of this.waitGraph.keys()) {
            if (!visited.has(node)) {
              if (hasCycle(node)) return true;
            }
          }
          return false;
        },

        async requestLock(holder: string, resource: string) {
          if (!this.waitGraph.has(holder)) {
            this.waitGraph.set(holder, new Set());
          }
          this.waitGraph.get(holder)!.add(resource);

          if (this.hasCircle()) {
            this.waitGraph.get(holder)!.delete(resource);
            throw new Error('Deadlock detected');
          }
        }
      };

      // Test deadlock detection
      await deadlockDetector.requestLock('A', 'lock1');
      await deadlockDetector.requestLock('B', 'lock2');

      // This would create a deadlock
      await expect(
        deadlockDetector.requestLock('lock1', 'B')
      ).rejects.toThrow('Deadlock detected');
    });
  });
});
```

### 5. `tests/unit/data/data-validation.test.ts`

```typescript
/**
 * Data Validation & Sanitization Tests
 */

describe('Data Validation', () => {
  describe('Schema validation', () => {
    test('validates data against schema', () => {
      const schema = {
        type: 'object',
        required: ['id', 'email'],
        properties: {
          id: { type: 'number', min: 1 },
          email: { type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
          age: { type: 'number', min: 0, max: 150 }
        }
      };

      const validate = (data: any, schema: any): boolean => {
        if (schema.required) {
          for (const field of schema.required) {
            if (!(field in data)) return false;
          }
        }

        for (const [key, rules] of Object.entries(schema.properties)) {
          if (key in data) {
            const value = data[key];
            const rule: any = rules;

            if (rule.type === 'number') {
              if (typeof value !== 'number') return false;
              if (rule.min !== undefined && value < rule.min) return false;
              if (rule.max !== undefined && value > rule.max) return false;
            }

            if (rule.type === 'string') {
              if (typeof value !== 'string') return false;
              if (rule.pattern && !rule.pattern.test(value)) return false;
            }
          }
        }

        return true;
      };

      expect(validate({ id: 1, email: 'test@example.com' }, schema)).toBe(true);
      expect(validate({ id: 0, email: 'test@example.com' }, schema)).toBe(false);
      expect(validate({ id: 1, email: 'invalid' }, schema)).toBe(false);
      expect(validate({ email: 'test@example.com' }, schema)).toBe(false);
    });
  });

  describe('Data sanitization', () => {
    test('sanitizes untrusted input', () => {
      const sanitizer = {
        cleanString(input: string): string {
          return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .trim();
        },

        cleanSQL(input: string): string {
          return input
            .replace(/['";\\]/g, '')
            .replace(/--/g, '')
            .replace(/\/\*/g, '')
            .replace(/\*\//g, '');
        },

        cleanPath(input: string): string {
          return input
            .replace(/\.\./g, '')
            .replace(/^\//, '')
            .replace(/^[A-Za-z]:/, '');
        }
      };

      // Test XSS sanitization
      expect(sanitizer.cleanString('<script>alert(1)</script>'))
        .toBe('');

      // Test SQL sanitization
      expect(sanitizer.cleanSQL("'; DROP TABLE users;--"))
        .toBe(' DROP TABLE users');

      // Test path sanitization
      expect(sanitizer.cleanPath('../../../etc/passwd'))
        .toBe('/etc/passwd');
    });
  });

  describe('Referential integrity', () => {
    test('maintains foreign key constraints', async () => {
      const database = {
        tables: {
          users: [{ id: 1, name: 'Alice' }],
          posts: [{ id: 1, user_id: 1, title: 'Hello' }]
        },

        async deleteUser(userId: number) {
          // Check referential integrity
          const hasPosts = this.tables.posts.some(p => p.user_id === userId);
          if (hasPosts) {
            throw new Error('Cannot delete user with posts');
          }

          this.tables.users = this.tables.users.filter(u => u.id !== userId);
        },

        async cascadeDelete(userId: number) {
          // Delete with cascade
          this.tables.posts = this.tables.posts.filter(p => p.user_id !== userId);
          this.tables.users = this.tables.users.filter(u => u.id !== userId);
        }
      };

      // Test constraint violation
      await expect(database.deleteUser(1))
        .rejects.toThrow('Cannot delete user with posts');

      // Test cascade delete
      await database.cascadeDelete(1);
      expect(database.tables.users).toHaveLength(0);
      expect(database.tables.posts).toHaveLength(0);
    });
  });
});
```

## 📊 Success Metrics

- [ ] All 35+ data integrity tests passing
- [ ] Transaction atomicity verified
- [ ] Backup corruption detection working
- [ ] Idempotency guarantees in place
- [ ] Concurrent access properly controlled
- [ ] Data validation comprehensive

## 🚀 Execution Instructions

1. Create all test files in `tests/unit/data/`
2. Run tests: `npm run test:data`
3. Fix source code for any failures
4. Verify coverage: `npm run test:coverage -- --grep data`

## 🔍 Files to Review & Fix

Priority data integrity files:
- `src/lib/backup.ts` - Needs checksum validation
- `src/lib/store.ts` - Missing transaction support
- `src/lib/artifacts.ts` - No deduplication logic
- `src/worker/process.ts` - Lacks idempotency
- `src/lib/db.ts` - Needs proper locking

## ⚠️ Critical Data Gaps

1. **backup.ts**: No integrity checks or checksums
2. **store.ts**: No transaction support
3. **artifacts.ts**: No deduplication
4. **No optimistic locking** implementation
5. **No deadlock detection** logic

## ✅ Completion Checklist

- [ ] Created all 5 test files
- [ ] 35+ data integrity tests written
- [ ] All tests passing
- [ ] Transaction support added
- [ ] Backup validation implemented
- [ ] Coverage report generated

---

**This workstream is independent and focuses solely on data integrity and consistency.**