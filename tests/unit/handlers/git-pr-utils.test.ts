/**
 * Tests for git_pr utility functions
 * Target coverage: 100% for utility functions
 */

import { jest } from '@jest/globals';
import path from 'path';

// Mock dependencies before importing git_pr
jest.mock('../../../src/lib/store', () => ({
  store: {
    driver: 'fs',
    updateStep: jest.fn(),
    getLatestGate: jest.fn(),
    createOrGetGate: jest.fn(),
    listStepsByRun: jest.fn(),
    listArtifactsByRun: jest.fn()
  }
}));

jest.mock('../../../src/lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        download: jest.fn()
      }))
    }
  },
  ARTIFACT_BUCKET: 'artifacts'
}));

jest.mock('node:fs', () => ({
  default: {
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    promises: {
      readFile: jest.fn()
    }
  },
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  promises: {
    readFile: jest.fn()
  }
}));

// Import the utility function we can test directly
import { safeRepoPath } from '../../../src/worker/handlers/git_pr';

describe('git_pr utility functions', () => {
  describe('safeRepoPath', () => {
    it('should resolve valid relative paths', () => {
      const repoRoot = '/workspace/repo';
      const result = safeRepoPath(repoRoot, 'src/index.ts');

      expect(result).toBe(path.join(repoRoot, 'src/index.ts'));
    });

    it('should resolve nested paths', () => {
      const repoRoot = '/workspace/repo';
      const result = safeRepoPath(repoRoot, 'src/components/Button.tsx');

      expect(result).toBe(path.join(repoRoot, 'src/components/Button.tsx'));
    });

    it('should throw error for empty path', () => {
      const repoRoot = '/workspace/repo';

      expect(() => safeRepoPath(repoRoot, '')).toThrow('empty path');
    });

    it('should throw error for absolute paths', () => {
      const repoRoot = '/workspace/repo';

      expect(() => safeRepoPath(repoRoot, '/etc/passwd')).toThrow('absolute paths not allowed');
    });

    it('should throw error for path traversal attempts with ..', () => {
      const repoRoot = '/workspace/repo';

      expect(() => safeRepoPath(repoRoot, '../../../etc/passwd')).toThrow('path traversal not allowed');
    });

    it('should throw error for path traversal at repo root level', () => {
      const repoRoot = '/workspace/repo';

      expect(() => safeRepoPath(repoRoot, '../outside')).toThrow('path traversal not allowed');
    });

    it('should allow paths with dots in filename', () => {
      const repoRoot = '/workspace/repo';
      const result = safeRepoPath(repoRoot, 'src/file.test.ts');

      expect(result).toBe(path.join(repoRoot, 'src/file.test.ts'));
    });

    it('should handle current directory reference', () => {
      const repoRoot = '/workspace/repo';
      const result = safeRepoPath(repoRoot, './src/index.ts');

      expect(result).toContain('src');
      expect(result).toContain('index.ts');
    });

    it('should prevent traversal with mixed separators', () => {
      const repoRoot = '/workspace/repo';

      expect(() => safeRepoPath(repoRoot, 'src/../../etc/passwd')).toThrow('path traversal not allowed');
    });
  });
});
