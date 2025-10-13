# Testing Prompt 3: Worker Handlers Testing Suite

## Priority: HIGH 🟠
**Estimated Time:** 5 hours
**Coverage Target:** 90% for all worker handlers

## Objective
Implement comprehensive test coverage for worker handlers that execute core business logic including code generation, database operations, workspace management, and manual operations. These handlers are critical for system operation and currently have insufficient test coverage.

## Files to Test

### Core Worker Handlers
- `src/worker/handlers/workspace_write.ts` (0% → 90%)
- `src/worker/handlers/manual.ts` (0% → 90%)
- `src/worker/handlers/codegen_v2.ts` (0% → 90%)
- `src/worker/handlers/codegen.ts` (Modified → 95%)
- `src/worker/handlers/loader.ts` (0% → 85%)
- `src/worker/handlers/static-loader.ts` (0% → 85%)

### Database & Git Handlers
- `src/worker/handlers/db_write.ts` (Modified → 90%)
- `src/worker/handlers/gate.ts` (Modified → 90%)
- `src/worker/handlers/git_ops.ts` (Modified → 90%)
- `src/worker/handlers/git_pr.ts` (Modified → 90%)

### Git Operation Services
- `src/worker/handlers/git_ops/BasicModeService.ts` (Modified → 90%)
- `src/worker/handlers/git_ops/AdvancedModeService.ts` (0% → 90%)
- `src/worker/handlers/git_ops/GitValidationService.ts` (0% → 95%)
- `src/worker/handlers/git_ops/WorkspaceManagementService.ts` (0% → 90%)

### Project Initialization
- `src/worker/handlers/project_init.ts` (Modified → 90%)

## Test Requirements

### 1. Unit Tests - Workspace Write Handler
```typescript
// Test scenarios for workspace_write.ts:
- File creation with proper permissions
- Directory structure creation
- File overwrite with backup
- Atomic write operations
- Concurrent write conflict resolution
- Symlink handling
- Large file handling (> 100MB)
- Binary file operations
- File locking mechanisms
- Cleanup on failure
- Path validation (traversal attacks)
- Encoding handling (UTF-8, ASCII, Binary)
- Filesystem quota enforcement
- Temporary file management
- Cross-platform path handling
```

### 2. Unit Tests - Manual Handler
```typescript
// Test scenarios for manual.ts:
- Manual step execution flow
- User input validation
- Step approval workflow
- Timeout handling for manual steps
- Rejection/cancellation handling
- Metadata preservation
- Audit trail generation
- Notification triggers
- Parallel manual steps
- Conditional manual steps
- Rollback on rejection
- Step retry logic
- Access control validation
- Step delegation
```

### 3. Unit Tests - Codegen V2 Handler
```typescript
// Test scenarios for codegen_v2.ts:
- Template rendering with variables
- Code generation from schemas
- Language-specific generation (TS, Python, Go)
- Import resolution and management
- Code formatting and linting
- Error handling in generation
- Partial generation recovery
- Cache management for templates
- Custom template support
- Generation performance optimization
- Incremental code generation
- Dependency graph building
- Type safety validation
- Documentation generation
```

### 4. Unit Tests - Database Write Handler
```typescript
// Test scenarios for db_write.ts:
- Transaction management (begin, commit, rollback)
- Batch insert operations
- Update with conditions
- Delete cascades
- Connection pooling
- Prepared statement caching
- SQL injection prevention
- Deadlock detection and retry
- Connection failure recovery
- Schema migration execution
- Backup before destructive operations
- Query timeout handling
- Multi-database support
- Read replica routing
```

### 5. Unit Tests - Gate Handler
```typescript
// Test scenarios for gate.ts:
- Condition evaluation (boolean logic)
- Async gate checks
- Gate timeout handling
- Multiple gate orchestration
- Gate failure recovery
- Conditional branching
- Gate result caching
- External service gates
- Rate limiting gates
- Time-based gates
- User approval gates
- Metric-based gates
- Circuit breaker pattern
- Gate bypass for admin
```

### 6. Unit Tests - Git Operations
```typescript
// Test scenarios for git operations:
- Repository cloning (SSH, HTTPS)
- Branch creation and switching
- Commit creation with message
- Push with conflict resolution
- Pull request creation
- Merge conflict handling
- Rebase operations
- Tag creation and pushing
- Submodule handling
- Large file storage (LFS)
- Shallow clone optimization
- Worktree management
- Git hooks execution
- Credential management
```

## Edge Cases to Test

1. **Filesystem Edge Cases**
   - Disk full scenarios
   - Permission denied errors
   - Corrupted file handling
   - Network drive operations
   - Case-sensitive filesystem issues

2. **Concurrency Edge Cases**
   - Multiple workers on same task
   - Resource lock timeouts
   - Queue message duplication
   - Worker crash recovery
   - Partial execution recovery

3. **Git Edge Cases**
   - Detached HEAD state
   - Force push scenarios
   - Repository corruption
   - Network interruption during clone
   - Invalid remote URLs

4. **Database Edge Cases**
   - Connection pool exhaustion
   - Long-running transaction blocking
   - Database failover handling
   - Schema version mismatch
   - Constraint violation handling

## Performance Requirements

- Handler initialization: < 100ms
- File operations: < 50ms per file
- Database operations: < 100ms per query
- Git operations: < 5s for clone
- Code generation: < 1s per file
- Gate evaluation: < 50ms

## Mocking Strategy

1. **Filesystem Mocks**
   ```typescript
   - Mock fs module
   - Virtual filesystem for tests
   - Mock file watchers
   - Mock file permissions
   ```

2. **Git Mocks**
   ```typescript
   - Mock git commands (simple-git)
   - Mock GitHub API
   - Mock SSH connections
   - Mock credential stores
   ```

3. **Database Mocks**
   ```typescript
   - Mock database drivers
   - Mock connection pools
   - Mock query results
   - Mock transactions
   ```

4. **Queue Mocks**
   ```typescript
   - Mock message queue
   - Mock job scheduling
   - Mock worker pool
   - Mock job results
   ```

## Handler Testing Patterns

### Basic Handler Test Structure
```typescript
describe('WorkspaceWriteHandler', () => {
  let handler: WorkspaceWriteHandler;
  let mockFs: jest.Mocked<typeof fs>;

  beforeEach(() => {
    mockFs = createMockFs();
    handler = new WorkspaceWriteHandler({ fs: mockFs });
  });

  describe('execute', () => {
    it('should write file with proper permissions', async () => {
      const context = createContext();
      const params = {
        path: '/workspace/file.txt',
        content: 'test content',
        permissions: '644'
      };

      const result = await handler.execute(context, params);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/workspace/file.txt',
        'test content',
        { mode: '644' }
      );
      expect(result.status).toBe('success');
    });
  });
});
```

### Integration Test Pattern
```typescript
describe('Handler Pipeline Integration', () => {
  it('should execute handler chain successfully', async () => {
    const pipeline = new HandlerPipeline([
      new GitOpsHandler(),
      new CodegenHandler(),
      new WorkspaceWriteHandler()
    ]);

    const result = await pipeline.execute({
      repo: 'test-repo',
      branch: 'feature',
      templates: ['service.ts'],
      output: '/workspace'
    });

    expect(result.filesCreated).toHaveLength(3);
    expect(result.status).toBe('completed');
  });
});
```

## Expected Outcomes

1. **Reliability**: Zero handler failures in production
2. **Performance**: All handlers meet latency requirements
3. **Idempotency**: All handlers are safely retryable
4. **Error Recovery**: Graceful degradation on failures
5. **Observability**: Complete logging and metrics

## Validation Checklist

- [ ] All handlers have unit tests
- [ ] Integration tests for handler chains
- [ ] Error scenarios thoroughly tested
- [ ] Performance benchmarks included
- [ ] Mock objects properly configured
- [ ] Cleanup logic tested
- [ ] Retry logic validated
- [ ] Timeout handling verified
- [ ] Resource limits enforced
- [ ] Audit trails generated

## Implementation Notes

1. **Test Isolation**
   - Use separate test databases
   - Clean up filesystem after tests
   - Reset git repositories
   - Clear message queues

2. **Test Data**
   - Use realistic test data
   - Include edge case datasets
   - Generate large datasets for load tests
   - Use deterministic random data

3. **Debugging Support**
   - Include detailed error messages
   - Log handler execution steps
   - Capture performance metrics
   - Enable debug mode in tests

4. **Continuous Integration**
   - Run tests in parallel
   - Generate coverage reports
   - Fail on coverage decrease
   - Performance regression detection