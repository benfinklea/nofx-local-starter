# Testing Prompt 5: Database & Store Layer Testing Suite

## Priority: HIGH 🟠
**Estimated Time:** 5 hours
**Coverage Target:** 90% for all database and store services

## Objective
Implement comprehensive test coverage for the database layer, FileSystemStore services, and data persistence mechanisms. These components are fundamental for data integrity and system reliability.

## Files to Test

### FileSystemStore Services
- `src/lib/store/FileSystemStore/FileOperationService.ts` (0% → 95%)
- `src/lib/store/FileSystemStore/ArtifactManagementService.ts` (0% → 90%)
- `src/lib/store/FileSystemStore/StepManagementService.ts` (0% → 90%)
- `src/lib/store/FileSystemStore/EventManagementService.ts` (0% → 90%)
- `src/lib/store/FileSystemStore/RunManagementService.ts` (Modified → 95%)

### Core Store & Database
- `src/lib/store.ts` (Modified → 90%)
- `src/lib/db.ts` (0% → 85%)
- `src/lib/migrations.ts` (0% → 90%)
- `src/lib/registry.ts` (0% → 85%)

### Data Management
- `src/lib/cache.ts` (0% → 85%)
- `src/lib/backup.ts` (0% → 90%)
- `src/lib/autobackup.ts` (0% → 85%)
- `src/lib/runRecovery.ts` (0% → 90%)

## Testing Framework & Tools

### Primary Testing Framework: Jest
All tests MUST be written using Jest. The project already has Jest configured with proper settings for TypeScript and async testing.

### Using the test-generator Subagent
Utilize the Claude Code test-generator subagent for rapid test development:
```bash
# Generate comprehensive store tests
/test-generator "Create unit tests for FileSystemStore with transaction handling"

# Generate database integration tests
/test-generator "Generate integration tests for database migrations and rollbacks"

# Create mock factories
/test-generator "Create mock factories for FileSystemStore dependencies"
```

The test-generator subagent will help with:
- Analyzing store interfaces and generating tests
- Creating database mock implementations
- Generating test data factories
- Identifying transaction edge cases
- Creating performance benchmarks

### Additional Testing Libraries
- **Jest**: Primary framework (configured)
- **jest-mock-extended**: Advanced mocking
- **@databases/pg-test**: PostgreSQL testing utilities
- **sqlite3**: In-memory database for tests
- **faker**: Test data generation

## Test Requirements

### 1. Unit Tests - FileOperationService
```typescript
// Test scenarios using Jest:
describe('FileOperationService', () => {
  let service: FileOperationService;
  let mockFs: jest.Mocked<typeof fs>;

  beforeEach(() => {
    mockFs = jest.mocked(fs);
    service = new FileOperationService(mockFs);
  });

  test('atomic write operations', async () => {
    // Test atomic writes with rollback
  });

  test('concurrent file access', async () => {
    // Test file locking and concurrent access
  });

  test('large file handling', async () => {
    // Test streaming for large files
  });

  test('file permission management', async () => {
    // Test permission checks and updates
  });
});

// Additional scenarios:
- Directory traversal and listing
- Symbolic link handling
- File watching and change detection
- Temporary file cleanup
- Cross-platform path normalization
- File compression/decompression
- Checksum verification
- Partial file updates
```

### 2. Unit Tests - ArtifactManagementService
```typescript
// Test scenarios for artifact management:
describe('ArtifactManagementService', () => {
  test('artifact storage with versioning', async () => {
    // Test version control for artifacts
  });

  test('artifact retrieval by query', async () => {
    // Test complex artifact queries
  });

  test('artifact lifecycle management', async () => {
    // Test creation, update, archival, deletion
  });

  test('artifact relationship mapping', async () => {
    // Test parent-child relationships
  });
});

// Additional scenarios:
- Artifact deduplication
- Storage optimization
- Metadata indexing
- Binary artifact handling
- Artifact signing and verification
- Access control per artifact
- Bulk operations
- Artifact migration between stores
```

### 3. Integration Tests - Database Operations
```typescript
// Database integration tests with Jest:
describe('Database Integration', () => {
  let db: Database;
  let testContainer: StartedTestContainer;

  beforeAll(async () => {
    // Start test database container
    testContainer = await new GenericContainer("postgres:14")
      .withExposedPorts(5432)
      .start();

    db = await connectDatabase(testContainer.getConnectionUrl());
  });

  afterAll(async () => {
    await db.close();
    await testContainer.stop();
  });

  test('transaction rollback on error', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.query('INSERT INTO users VALUES ($1)', ['test']);
        throw new Error('Rollback test');
      })
    ).rejects.toThrow();

    const result = await db.query('SELECT * FROM users WHERE id = $1', ['test']);
    expect(result.rows).toHaveLength(0);
  });
});

// Additional scenarios:
- Connection pooling limits
- Prepared statement caching
- Query timeout handling
- Deadlock detection
- Multi-database transactions
- Read/write splitting
- Schema migrations
- Index performance
```

### 4. Unit Tests - Migration System
```typescript
// Migration testing with Jest:
describe('Migration System', () => {
  test('forward migration execution', async () => {
    const migrator = new Migrator(db);
    await migrator.up();

    const version = await migrator.getCurrentVersion();
    expect(version).toBe('20240101_initial');
  });

  test('rollback migration', async () => {
    const migrator = new Migrator(db);
    await migrator.down(1);

    const version = await migrator.getCurrentVersion();
    expect(version).toBe('20231231_previous');
  });

  test('migration with data transformation', async () => {
    // Test data migration scenarios
  });
});

// Additional scenarios:
- Idempotent migrations
- Concurrent migration prevention
- Migration dependency resolution
- Schema validation post-migration
- Data integrity checks
- Migration performance tracking
- Dry-run mode
- Migration conflict resolution
```

### 5. Unit Tests - Caching Layer
```typescript
// Cache testing with Jest:
describe('CacheService', () => {
  let cache: CacheService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    cache = new CacheService(mockRedis);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('cache invalidation on update', async () => {
    await cache.set('key', 'value');
    await cache.invalidate('key');

    const result = await cache.get('key');
    expect(result).toBeNull();
  });

  test('TTL expiration', async () => {
    await cache.set('key', 'value', { ttl: 1000 });

    jest.advanceTimersByTime(1001);

    const result = await cache.get('key');
    expect(result).toBeNull();
  });
});

// Additional scenarios:
- Cache warming strategies
- Distributed cache synchronization
- Cache stampede prevention
- LRU eviction policy
- Cache compression
- Multi-tier caching
- Cache statistics tracking
```

### 6. Unit Tests - Backup & Recovery
```typescript
// Backup and recovery testing:
describe('Backup and Recovery', () => {
  test('incremental backup creation', async () => {
    const backup = new BackupService();
    const result = await backup.createIncremental();

    expect(result.size).toBeLessThan(FULL_BACKUP_SIZE);
    expect(result.type).toBe('incremental');
  });

  test('point-in-time recovery', async () => {
    const recovery = new RecoveryService();
    const timestamp = new Date('2024-01-01T12:00:00Z');

    await recovery.restoreToPoint(timestamp);

    const state = await getSystemState();
    expect(state.timestamp).toEqual(timestamp);
  });
});

// Additional scenarios:
- Backup encryption
- Backup compression ratios
- Multi-destination backup
- Backup verification
- Recovery time objectives (RTO)
- Recovery point objectives (RPO)
- Disaster recovery testing
- Cross-region backup replication
```

## Edge Cases to Test

1. **Storage Edge Cases**
   - Disk space exhaustion
   - File system corruption
   - Network storage disconnection
   - Permission changes during operation
   - Concurrent file modifications

2. **Database Edge Cases**
   - Connection pool exhaustion
   - Long-running transaction blocking
   - Database failover scenarios
   - Network partition handling
   - Character encoding issues

3. **Cache Edge Cases**
   - Cache avalanche scenarios
   - Memory pressure eviction
   - Cache coherency issues
   - Serialization failures
   - Network timeouts

4. **Backup Edge Cases**
   - Backup during high load
   - Corrupted backup detection
   - Backup storage failures
   - Concurrent backup attempts
   - Recovery with missing segments

## Performance Requirements

- File operations: < 10ms for small files
- Database queries: < 50ms for indexed queries
- Cache operations: < 1ms for get/set
- Backup creation: < 60s for incremental
- Migration execution: < 30s per migration
- Transaction commit: < 100ms

## Expected Outcomes

1. **Data Integrity**: Zero data corruption incidents
2. **Performance**: All operations within SLA
3. **Reliability**: 99.99% availability for storage layer
4. **Recovery**: RTO < 5 minutes, RPO < 1 minute
5. **Scalability**: Support 10,000+ concurrent operations

## Validation Checklist

- [ ] All CRUD operations tested
- [ ] Transaction boundaries verified
- [ ] Concurrent access handled correctly
- [ ] Error recovery paths tested
- [ ] Performance benchmarks met
- [ ] Data consistency maintained
- [ ] Backup/restore procedures validated
- [ ] Migration rollback tested
- [ ] Cache coherency verified
- [ ] Resource cleanup confirmed

## Jest Configuration Tips

```javascript
// jest.config.js additions for database tests
module.exports = {
  // ... existing config
  testTimeout: 30000, // Increase for database tests
  globalSetup: './test/setup/database.js',
  globalTeardown: './test/teardown/database.js',
  testEnvironment: 'node',
  coverageThreshold: {
    './src/lib/store/**/*.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};
```

## Implementation Notes

1. **Test Data Management**
   - Use transactions for test isolation
   - Create test data factories
   - Use database snapshots for complex scenarios
   - Implement data cleanup in afterEach

2. **Mock Strategies**
   - Use jest.mock() for module mocking
   - Create reusable mock factories
   - Use jest.spyOn() for partial mocking
   - Implement custom matchers for database assertions

3. **Performance Testing**
   - Include performance assertions in tests
   - Use Jest's timer mocks for time-dependent tests
   - Measure and assert on operation counts
   - Profile tests to identify bottlenecks