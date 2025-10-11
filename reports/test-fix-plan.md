# Test Fix Plan - Prioritized by Difficulty

## Test Results Summary
- **Total**: 87 tests
- **Passed**: 62 (71%)
- **Failed**: 25 (29%)

## Failure Categories

### EASY (10 failures) - Import/Mock Issues
**Issue**: `fsp` is undefined in mocked tests
**Root Cause**: Mock setup doesn't properly mock `fs/promises`
**Affected Tests**:
1. Gate operations (5 tests) - createOrGetGate, updateGate, getLatestGate, listGatesByRun
2. Artifact operations (2 tests) - addArtifact, listArtifactsByRun  
3. Outbox operations (3 tests) - outboxAdd, outboxListUnsent, outboxMarkSent

**Fix**: Add proper `fsp` mock in test setup
**Estimate**: 15 minutes

### EASY (1 failure) - Null Safety
**Issue**: `run.id.slice(0, 8)` fails when `run.id` is undefined
**Location**: `RunManagementService.ts:98`
**Affected Tests**:
1. listRunsByUser fallback test

**Fix**: Add null check: `run.id?.slice(0, 8) ?? 'Unknown'`
**Estimate**: 5 minutes

### MEDIUM (8 failures) - JSON Formatting Mismatch
**Issue**: Tests expect compact JSON, code writes formatted JSON
**Examples**:
- Expected: `"status":"queued"`  
- Received: `"status": "queued"` (with spaces and newlines)

**Affected Tests**:
1. createRun - mkdirSync expectations
2. updateRun - JSON format expectations (2 tests)
3. resetRun - JSON format expectations
4. listRuns - title format expectations (2 tests)
5. createStep - JSON format expectations
6. updateStep - JSON format expectations

**Fix Options**:
A. Update test expectations to match formatted JSON
B. Use JSON.parse() in tests instead of string matching
C. Make code write compact JSON

**Recommendation**: Option B (parse and compare objects)
**Estimate**: 30 minutes

### MEDIUM (1 failure) - Event Storage Format
**Issue**: Events stored as individual files, test expects array in single file
**Location**: `recordEvent` test expects `/events.json`, code writes `/events/{id}.json`
**Affected Tests**:
1. recordEvent test
2. listEvents test

**Fix**: Update test expectations to match actual storage format
**Estimate**: 20 minutes

### MEDIUM (1 failure) - Step Reset Implementation
**Issue**: `resetStep` fails with `fsp.readdir` undefined
**Location**: FileSystemStore:95
**Root Cause**: Both mock issue AND implementation issue

**Fix**: Fix mock + verify resetStep implementation
**Estimate**: 15 minutes

### HARD (4 failures) - Test Logic Issues
**Issue**: Tests have incorrect expectations or test invalid scenarios
**Affected Tests**:
1. JSON parsing errors - test expects undefined, gets valid data
2. Complete run lifecycle - depends on gate mocks
3. Outbox lifecycle - depends on outbox mocks

**Fix**: Rewrite test logic to match actual behavior
**Estimate**: 45 minutes

## Execution Order

### Phase 1: Quick Wins (20 min)
1. ✅ Fix `fsp` mock (10 tests fixed)
2. ✅ Fix null safety in RunManagementService (1 test fixed)

### Phase 2: Format Issues (50 min)
3. ✅ Fix JSON formatting expectations (8 tests fixed)
4. ✅ Fix event storage format (2 tests fixed)

### Phase 3: Implementation Fixes (60 min)
5. ✅ Fix resetStep implementation (1 test fixed)
6. ✅ Rewrite problematic test logic (3 tests fixed)

### Phase 4: Edge Cases (90 min)
7. ✅ Add null/undefined handling tests
8. ✅ Add boundary condition tests (empty arrays, max limits)
9. ✅ Add concurrent operation tests
10. ✅ Add error recovery tests

**Total Estimated Time**: 3.5 hours
**Expected Outcome**: 100% passing tests + 20-30 new edge case tests
