# Testing Prompt 8: Git Operations & Version Control Testing Suite

## Priority: MEDIUM 🟡
**Estimated Time:** 5 hours
**Coverage Target:** 90% for all git operations and version control services

## Objective
Implement comprehensive test coverage for git operations including repository management, PR creation, worktree handling, branching strategies, and version control workflows. These components are critical for code management and collaboration features.

## Files to Test

### Git Operation Handlers
- `src/worker/handlers/git_ops.ts` (Modified → 95%)
- `src/worker/handlers/git_pr.ts` (Modified → 95%)
- `src/worker/handlers/git_ops/BasicModeService.ts` (Modified → 90%)
- `src/worker/handlers/git_ops/AdvancedModeService.ts` (0% → 90%)
- `src/worker/handlers/git_ops/GitValidationService.ts` (0% → 95%)
- `src/worker/handlers/git_ops/WorkspaceManagementService.ts` (0% → 90%)

### Project Initialization
- `src/worker/handlers/project_init.ts` (Modified → 90%)

## Testing Framework & Tools

### Primary Testing Framework: Jest
All git operation tests MUST be written using Jest with proper async handling for git commands.

### Using the test-generator Subagent
Leverage the test-generator for complex git scenarios:
```bash
# Generate git operation tests
/test-generator "Create comprehensive tests for git worktree operations with conflict resolution"

# Generate PR workflow tests
/test-generator "Generate tests for complete PR lifecycle: create, review, merge, close"

# Create branch strategy tests
/test-generator "Create tests for git branching strategies including feature, release, hotfix flows"

# Generate conflict resolution tests
/test-generator "Generate tests for merge conflict detection and resolution strategies"
```

The test-generator subagent will:
- Analyze git command sequences
- Generate repository state fixtures
- Create conflict scenarios
- Build worktree test cases
- Generate CI/CD integration tests

### Required Testing Tools
- **Jest**: Primary framework
- **simple-git**: Git operations (to be mocked)
- **memfs**: In-memory filesystem for tests
- **tempy**: Temporary directory creation
- **nodegit**: Advanced git operations (optional)

## Test Requirements

### 1. Unit Tests - Git Validation Service
```typescript
// GitValidationService tests with Jest:
describe('GitValidationService', () => {
  let service: GitValidationService;
  let mockGit: jest.Mocked<SimpleGit>;

  beforeEach(() => {
    mockGit = createMockGit();
    service = new GitValidationService(mockGit);
  });

  describe('repository validation', () => {
    test('validates clean repository state', async () => {
      mockGit.status.mockResolvedValue({
        isClean: () => true,
        modified: [],
        not_added: [],
        conflicted: []
      });

      const isValid = await service.validateRepository('/repo/path');

      expect(isValid).toBe(true);
      expect(mockGit.status).toHaveBeenCalled();
    });

    test('detects uncommitted changes', async () => {
      mockGit.status.mockResolvedValue({
        isClean: () => false,
        modified: ['file1.ts', 'file2.ts'],
        not_added: ['new-file.ts'],
        conflicted: []
      });

      const validation = await service.validateRepository('/repo/path');

      expect(validation.hasUncommittedChanges).toBe(true);
      expect(validation.modifiedFiles).toHaveLength(2);
      expect(validation.untrackedFiles).toHaveLength(1);
    });

    test('detects merge conflicts', async () => {
      mockGit.status.mockResolvedValue({
        isClean: () => false,
        conflicted: ['conflict.ts']
      });

      const validation = await service.validateRepository('/repo/path');

      expect(validation.hasConflicts).toBe(true);
      expect(validation.conflictedFiles).toContain('conflict.ts');
    });
  });

  describe('branch validation', () => {
    test('validates branch naming conventions', () => {
      const validBranches = [
        'feature/add-login',
        'bugfix/fix-memory-leak',
        'release/v1.2.3',
        'hotfix/critical-security'
      ];

      validBranches.forEach(branch => {
        expect(service.isValidBranchName(branch)).toBe(true);
      });

      const invalidBranches = [
        'Feature/uppercase', // Wrong case
        'add login', // Spaces
        '../../../etc/passwd' // Path traversal
      ];

      invalidBranches.forEach(branch => {
        expect(service.isValidBranchName(branch)).toBe(false);
      });
    });

    test('checks branch existence', async () => {
      mockGit.branchLocal.mockResolvedValue({
        all: ['main', 'develop', 'feature/test'],
        current: 'main'
      });

      const exists = await service.branchExists('feature/test');
      expect(exists).toBe(true);

      const notExists = await service.branchExists('feature/missing');
      expect(notExists).toBe(false);
    });
  });

  // Additional test scenarios:
  // - Remote URL validation
  // - SSH key verification
  // - Repository permissions check
  // - Git hooks validation
  // - Submodule validation
  // - LFS setup verification
});
```

### 2. Unit Tests - Workspace Management Service
```typescript
describe('WorkspaceManagementService', () => {
  let service: WorkspaceManagementService;
  let mockGit: jest.Mocked<SimpleGit>;
  let mockFs: jest.Mocked<typeof fs>;

  beforeEach(() => {
    mockGit = createMockGit();
    mockFs = createMockFs();
    service = new WorkspaceManagementService(mockGit, mockFs);
  });

  describe('worktree operations', () => {
    test('creates new worktree', async () => {
      const config = {
        path: '/workspace/feature-branch',
        branch: 'feature/new-feature',
        commitish: 'main'
      };

      await service.createWorktree(config);

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'add',
        '-b',
        'feature/new-feature',
        '/workspace/feature-branch',
        'main'
      ]);

      expect(mockFs.existsSync).toHaveBeenCalledWith('/workspace/feature-branch');
    });

    test('lists active worktrees', async () => {
      mockGit.raw.mockResolvedValue(`
        /main/repo main abc123
        /workspace/feature feature/test def456
        /workspace/hotfix hotfix/urgent ghi789
      `);

      const worktrees = await service.listWorktrees();

      expect(worktrees).toHaveLength(3);
      expect(worktrees[1]).toEqual({
        path: '/workspace/feature',
        branch: 'feature/test',
        commit: 'def456'
      });
    });

    test('removes worktree safely', async () => {
      // Check for uncommitted changes first
      mockGit.status.mockResolvedValue({
        isClean: () => true
      });

      await service.removeWorktree('/workspace/feature');

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '/workspace/feature'
      ]);
    });

    test('prevents removal with uncommitted changes', async () => {
      mockGit.status.mockResolvedValue({
        isClean: () => false,
        modified: ['file.ts']
      });

      await expect(service.removeWorktree('/workspace/feature'))
        .rejects.toThrow('Uncommitted changes in worktree');
    });
  });

  // Additional scenarios:
  // - Worktree pruning
  // - Concurrent worktree access
  // - Worktree locking
  // - Cross-worktree operations
  // - Worktree repair
});
```

### 3. Integration Tests - Pull Request Workflow
```typescript
describe('Pull Request Workflow', () => {
  let gitPrHandler: GitPrHandler;
  let mockGitHub: jest.Mocked<Octokit>;

  beforeEach(() => {
    mockGitHub = createMockGitHub();
    gitPrHandler = new GitPrHandler({ github: mockGitHub });
  });

  test('complete PR lifecycle', async () => {
    // 1. Create feature branch
    await gitPrHandler.createBranch({
      name: 'feature/awesome-feature',
      from: 'main'
    });

    // 2. Make changes and commit
    await gitPrHandler.commitChanges({
      files: ['src/feature.ts'],
      message: 'Add awesome feature'
    });

    // 3. Push branch
    await gitPrHandler.pushBranch('feature/awesome-feature');

    // 4. Create PR
    const pr = await gitPrHandler.createPullRequest({
      title: 'Add awesome feature',
      body: 'This PR adds an awesome feature',
      base: 'main',
      head: 'feature/awesome-feature',
      draft: false
    });

    expect(pr.number).toBeDefined();
    expect(mockGitHub.pulls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Add awesome feature',
        draft: false
      })
    );

    // 5. Add reviewers
    await gitPrHandler.requestReviewers(pr.number, ['reviewer1', 'reviewer2']);

    // 6. Handle review feedback
    await gitPrHandler.commitChanges({
      files: ['src/feature.ts'],
      message: 'Address review feedback'
    });

    // 7. Merge PR
    await gitPrHandler.mergePullRequest(pr.number, {
      merge_method: 'squash'
    });

    expect(mockGitHub.pulls.merge).toHaveBeenCalledWith({
      pull_number: pr.number,
      merge_method: 'squash'
    });

    // 8. Clean up branch
    await gitPrHandler.deleteBranch('feature/awesome-feature');
  });

  test('handles merge conflicts', async () => {
    mockGitHub.pulls.get.mockResolvedValue({
      data: {
        mergeable: false,
        mergeable_state: 'conflicting'
      }
    });

    const prStatus = await gitPrHandler.checkPullRequestStatus(123);

    expect(prStatus.hasConflicts).toBe(true);
    expect(prStatus.mergeable).toBe(false);
  });

  // Additional PR scenarios:
  // - PR templates
  // - Auto-labeling
  // - CI status checks
  // - Branch protection rules
  // - Auto-merge conditions
  // - PR comments and discussions
});
```

### 4. Unit Tests - Advanced Mode Service
```typescript
describe('AdvancedModeService', () => {
  let service: AdvancedModeService;

  describe('complex git operations', () => {
    test('performs interactive rebase', async () => {
      const rebasePlan = [
        { action: 'pick', commit: 'abc123', message: 'Initial commit' },
        { action: 'squash', commit: 'def456', message: 'Fix typo' },
        { action: 'reword', commit: 'ghi789', message: 'Add feature' }
      ];

      await service.interactiveRebase('HEAD~3', rebasePlan);

      // Verify rebase sequence
      const log = await service.getCommitHistory(3);
      expect(log).toHaveLength(2); // One squashed
    });

    test('cherry-picks commits', async () => {
      await service.cherryPick(['abc123', 'def456'], {
        mainline: 1,
        strategy: 'recursive'
      });

      const log = await service.getCommitHistory(2);
      expect(log[0].message).toContain('cherry picked from');
    });

    test('performs three-way merge', async () => {
      const result = await service.mergeBranches({
        source: 'feature/branch',
        target: 'main',
        strategy: 'recursive',
        options: ['patience', 'no-rename']
      });

      expect(result.conflicts).toHaveLength(0);
      expect(result.merged).toBe(true);
    });

    test('creates and applies patches', async () => {
      // Create patch
      const patch = await service.createPatch('HEAD~2..HEAD');
      expect(patch).toContain('diff --git');

      // Apply patch
      await service.applyPatch(patch, {
        check: true,
        reverse: false
      });
    });
  });

  // Additional advanced scenarios:
  // - Bisect operations
  // - Stash management
  // - Reflog navigation
  // - Tag management
  // - Submodule updates
  // - Git attributes handling
});
```

### 5. Unit Tests - Basic Mode Service
```typescript
describe('BasicModeService', () => {
  test('performs basic commit operations', async () => {
    const service = new BasicModeService();

    // Stage files
    await service.stageFiles(['file1.ts', 'file2.ts']);

    // Commit with message
    const commit = await service.commit('feat: Add new feature');

    expect(commit.sha).toMatch(/^[a-f0-9]{40}$/);
    expect(commit.message).toBe('feat: Add new feature');
  });

  test('handles file operations', async () => {
    const service = new BasicModeService();

    // Add file
    await service.addFile('new-file.ts', 'content');

    // Modify file
    await service.modifyFile('existing.ts', 'new content');

    // Remove file
    await service.removeFile('old-file.ts');

    // Move file
    await service.moveFile('src/old.ts', 'src/new.ts');

    const status = await service.getStatus();
    expect(status.created).toContain('new-file.ts');
    expect(status.modified).toContain('existing.ts');
    expect(status.deleted).toContain('old-file.ts');
    expect(status.renamed).toContainEqual({
      from: 'src/old.ts',
      to: 'src/new.ts'
    });
  });
});
```

### 6. Error Handling Tests
```typescript
describe('Git Error Handling', () => {
  test('handles network failures gracefully', async () => {
    const service = new GitOpsService();

    // Simulate network failure
    jest.spyOn(service, 'fetch').mockRejectedValue(
      new Error('Network error')
    );

    const result = await service.syncWithRemote();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Network');
    expect(result.retryable).toBe(true);
  });

  test('handles authentication failures', async () => {
    const service = new GitOpsService();

    jest.spyOn(service, 'push').mockRejectedValue(
      new Error('Authentication failed')
    );

    const result = await service.pushChanges();

    expect(result.success).toBe(false);
    expect(result.requiresAuth).toBe(true);
  });

  test('handles merge conflicts', async () => {
    const service = new GitOpsService();

    const result = await service.mergeBranch('feature');

    expect(result.hasConflicts).toBe(true);
    expect(result.conflictedFiles).toHaveLength(2);
    expect(result.resolutionStrategy).toBeDefined();
  });
});
```

## Edge Cases to Test

1. **Repository Edge Cases**
   - Bare repositories
   - Shallow clones
   - Large repositories (>1GB)
   - Repositories with submodules
   - Corrupted git objects

2. **Branch Edge Cases**
   - Detached HEAD state
   - Orphan branches
   - Protected branches
   - Branch name conflicts
   - Remote tracking issues

3. **Merge Edge Cases**
   - Complex conflict resolution
   - Binary file conflicts
   - Renamed file conflicts
   - Directory/file conflicts
   - Octopus merges

4. **Network Edge Cases**
   - Partial fetch failures
   - Push rejection scenarios
   - Authentication timeout
   - Proxy configuration
   - SSH key issues

## Performance Requirements

- Clone operation: < 30s for typical repo
- Branch creation: < 100ms
- Commit operation: < 500ms
- Push/pull: < 5s for small changes
- PR creation: < 2s
- Worktree creation: < 1s

## Expected Outcomes

1. **Reliability**: 99.9% success rate for git operations
2. **Performance**: All operations within time limits
3. **Conflict Resolution**: Automated resolution for 80% of conflicts
4. **Data Integrity**: Zero data loss during operations
5. **Concurrency**: Safe parallel operations

## Validation Checklist

- [ ] All git commands properly mocked
- [ ] Error scenarios thoroughly tested
- [ ] Network failures handled gracefully
- [ ] Conflict resolution tested
- [ ] Performance benchmarks included
- [ ] Authentication flows validated
- [ ] Worktree operations tested
- [ ] PR workflows complete
- [ ] Repository state validated
- [ ] Cleanup operations verified

## Jest Configuration for Git Tests

```javascript
// jest.config.js additions for git tests
module.exports = {
  // ... existing config
  testMatch: [
    '**/git_ops/**/*.test.ts',
    '**/handlers/git*.test.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/test/git-setup.js'],
  testTimeout: 20000, // Git operations can be slow
};

// test/git-setup.js
const tempy = require('tempy');

global.beforeEach(() => {
  // Create temporary git repo for each test
  global.testRepoPath = tempy.directory();
});

global.afterEach(() => {
  // Clean up temporary repos
  if (global.testRepoPath) {
    fs.rmSync(global.testRepoPath, { recursive: true, force: true });
  }
});
```

## Testing Best Practices

1. **Repository Isolation**
   - Use temporary repos for each test
   - Reset to known state before tests
   - Clean up after tests
   - Avoid modifying real repos

2. **Mock Strategy**
   - Mock git commands, not logic
   - Use real git for integration tests
   - Mock network operations
   - Simulate various git states

3. **Test Organization**
   - Group by git operation type
   - Separate unit and integration tests
   - Use descriptive test names
   - Include error scenarios