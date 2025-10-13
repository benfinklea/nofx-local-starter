/**
 * Edge case tests for git_pr handler to achieve 100% coverage
 */

import { jest } from '@jest/globals';

// Mock all dependencies
jest.mock('../../../src/lib/store', () => ({
  store: {
    driver: 'postgres', // Test Supabase path
    updateStep: jest.fn(),
    getLatestGate: jest.fn(),
    createOrGetGate: jest.fn(),
    listStepsByRun: jest.fn(),
    listArtifactsByRun: jest.fn()
  }
}));

jest.mock('../../../src/lib/events', () => ({
  recordEvent: jest.fn()
}));

jest.mock('../../../src/lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn()
    }
  },
  ARTIFACT_BUCKET: 'artifacts'
}));

jest.mock('../../../src/lib/logger', () => ({
  log: {
    warn: jest.fn(),
    info: jest.fn()
  }
}));

jest.mock('../../../src/lib/queue', () => ({
  enqueue: jest.fn(),
  STEP_READY_TOPIC: 'step-ready'
}));

jest.mock('../../../src/lib/secrets', () => ({
  buildMinimalEnv: jest.fn(),
  getSecret: jest.fn()
}));

jest.mock('../../../src/lib/json', () => ({
  toJsonObject: jest.fn(obj => obj)
}));

jest.mock('node:child_process', () => ({
  spawnSync: jest.fn()
}));

jest.mock('node:fs', () => ({
  default: {
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    promises: {
      readFile: jest.fn()
    }
  },
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  promises: {
    readFile: jest.fn()
  }
}));

(global as any).fetch = jest.fn();

import gitPrHandler from '../../../src/worker/handlers/git_pr';
import { store } from '../../../src/lib/store';
import { supabase } from '../../../src/lib/supabase';
import { buildMinimalEnv, getSecret } from '../../../src/lib/secrets';
import { spawnSync } from 'node:child_process';

const mockStore = jest.mocked(store);
const mockSupabase = jest.mocked(supabase);
const mockBuildMinimalEnv = jest.mocked(buildMinimalEnv);
const mockGetSecret = jest.mocked(getSecret);
const mockSpawnSync = jest.mocked(spawnSync);
const mockFetch = jest.mocked(fetch);

describe('git_pr edge cases for 100% coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.updateStep.mockResolvedValue(undefined);
    mockBuildMinimalEnv.mockReturnValue({ NODE_ENV: 'test' });
    mockGetSecret.mockReturnValue('ghp_test_token');
    mockStore.getLatestGate.mockResolvedValue({ status: 'passed' } as any);

    // Default successful git operations
    mockSpawnSync.mockImplementation((cmd: any, args?: any) => {
      if (cmd === 'git' && args?.includes('config')) {
        if (args?.includes('--get') && args?.includes('remote.origin.url')) {
          return { status: 0, stdout: 'git@github.com:owner/repo.git', stderr: '' } as any;
        }
        if (args?.includes('user.email')) {
          return { status: 0, stdout: 'test@example.com', stderr: '' } as any;
        }
        if (args?.includes('user.name')) {
          return { status: 0, stdout: 'Test User', stderr: '' } as any;
        }
      }
      return { status: 0, stdout: '', stderr: '' } as any;
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ html_url: 'https://github.com/owner/repo/pull/1' })
    } as any);
  });

  it('should handle Supabase artifact download', async () => {
    // Set driver to postgres to test Supabase path
    (mockStore as any).driver = 'postgres';

    const mockDownload = jest.fn() as any;
    mockDownload.mockResolvedValue({
      data: {
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      },
      error: null
    });

    mockSupabase.storage.from.mockReturnValue({
      download: mockDownload
    } as any);

    const step = {
      id: 'step-123',
      name: 'create-pr',
      tool: 'git_pr',
      inputs: {
        title: 'Test PR',
        commits: [
          {
            path: 'file.txt',
            fromArtifact: 'artifacts/run-123/step-456/file.txt'
          }
        ]
      }
    };

    await gitPrHandler.run({
      runId: 'run-123',
      step: step as any
    });

    // Should download from Supabase
    expect(mockSupabase.storage.from).toHaveBeenCalledWith('artifacts');
    expect(mockDownload).toHaveBeenCalledWith('artifacts/run-123/step-456/file.txt');
  });

  it('should handle Supabase download error', async () => {
    (mockStore as any).driver = 'postgres';

    const mockDownload = jest.fn() as any;
    mockDownload.mockResolvedValue({
      data: null,
      error: { message: 'Not found' }
    });

    mockSupabase.storage.from.mockReturnValue({
      download: mockDownload
    } as any);

    const step = {
      id: 'step-123',
      name: 'create-pr',
      tool: 'git_pr',
      inputs: {
        title: 'Test PR',
        commits: [
          {
            path: 'file.txt',
            fromArtifact: 'artifacts/run-123/step-456/missing.txt'
          }
        ]
      }
    };

    await expect(gitPrHandler.run({
      runId: 'run-123',
      step: step as any
    })).rejects.toThrow('artifact not found');
  });

  it('should use process.env when buildMinimalEnv returns undefined env', async () => {
    // Test env || process.env branch in sh function
    mockBuildMinimalEnv.mockReturnValue(undefined as any);

    const step = {
      id: 'step-123',
      name: 'create-pr',
      tool: 'git_pr',
      inputs: {
        title: 'Test PR',
        commits: [
          {
            path: 'test.txt',
            content: 'test content'
          }
        ]
      }
    };

    await gitPrHandler.run({
      runId: 'run-123',
      step: step as any
    });

    // Should succeed using process.env as fallback
    expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
      status: 'succeeded',
      ended_at: expect.any(String),
      outputs: expect.objectContaining({
        files: ['test.txt']
      })
    });
  });

  it('should handle PR creation with draft option', async () => {
    const step = {
      id: 'step-123',
      name: 'create-pr',
      tool: 'git_pr',
      inputs: {
        title: 'Draft PR',
        body: 'This is a draft',
        draft: true,
        commits: [
          {
            path: 'draft.txt',
            content: 'draft content'
          }
        ]
      }
    };

    await gitPrHandler.run({
      runId: 'run-123',
      step: step as any
    });

    // Should create draft PR
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"draft":true')
      })
    );
  });

  it('should handle PR creation failure and continue', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('API Error')
    } as any);

    const step = {
      id: 'step-123',
      name: 'create-pr',
      tool: 'git_pr',
      inputs: {
        title: 'Test PR',
        commits: [
          {
            path: 'test.txt',
            content: 'test'
          }
        ]
      }
    };

    await gitPrHandler.run({
      runId: 'run-123',
      step: step as any
    });

    // Should succeed even if PR creation fails
    expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
      status: 'succeeded',
      ended_at: expect.any(String),
      outputs: expect.objectContaining({
        prUrl: undefined,
        files: ['test.txt']
      })
    });
  });

  it('should handle parseOrigin with SSH URL', async () => {
    mockSpawnSync.mockImplementation((cmd: any, args?: any) => {
      if (cmd === 'git' && args?.includes('remote.origin.url')) {
        return { status: 0, stdout: 'git@github.com:user/project.git', stderr: '' } as any;
      }
      return { status: 0, stdout: '', stderr: '' } as any;
    });

    const step = {
      id: 'step-123',
      name: 'create-pr',
      tool: 'git_pr',
      inputs: {
        title: 'SSH PR',
        commits: [
          {
            path: 'test.txt',
            content: 'content'
          }
        ]
      }
    };

    await gitPrHandler.run({
      runId: 'run-123',
      step: step as any
    });

    // Should parse SSH URL correctly
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/user/project/pulls',
      expect.any(Object)
    );
  });

  it('should handle parseOrigin with HTTPS URL', async () => {
    mockSpawnSync.mockImplementation((cmd: any, args?: any) => {
      if (cmd === 'git' && args?.includes('remote.origin.url')) {
        return { status: 0, stdout: 'https://github.com/user/project.git', stderr: '' } as any;
      }
      return { status: 0, stdout: '', stderr: '' } as any;
    });

    const step = {
      id: 'step-123',
      name: 'create-pr',
      tool: 'git_pr',
      inputs: {
        title: 'HTTPS PR',
        commits: [
          {
            path: 'test.txt',
            content: 'content'
          }
        ]
      }
    };

    await gitPrHandler.run({
      runId: 'run-123',
      step: step as any
    });

    // Should parse HTTPS URL correctly
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/user/project/pulls',
      expect.any(Object)
    );
  });

  it('should handle parseOrigin with URL without .git extension', async () => {
    mockSpawnSync.mockImplementation((cmd: any, args?: any) => {
      if (cmd === 'git' && args?.includes('remote.origin.url')) {
        return { status: 0, stdout: 'https://github.com/user/repo', stderr: '' } as any;
      }
      return { status: 0, stdout: '', stderr: '' } as any;
    });

    const step = {
      id: 'step-123',
      name: 'create-pr',
      tool: 'git_pr',
      inputs: {
        title: 'No .git PR',
        commits: [
          {
            path: 'test.txt',
            content: 'content'
          }
        ]
      }
    };

    await gitPrHandler.run({
      runId: 'run-123',
      step: step as any
    });

    // Should parse URL without .git extension
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/user/repo/pulls',
      expect.any(Object)
    );
  });

  it('should use default commitMsg when inputs.title is not provided', async () => {
    const step = {
      id: 'step-123',
      name: 'create-pr',
      tool: 'git_pr',
      inputs: {
        // No title - should use default
        commits: [
          {
            path: 'test.txt',
            content: 'test'
          }
        ]
      }
    };

    await gitPrHandler.run({
      runId: 'run-123',
      step: step as any
    });

    // Should use default commit message (check that git commit was called with default msg)
    const commitCalls = mockSpawnSync.mock.calls.filter(
      (call: any) => call[0] === 'git' && call[1]?.[0] === 'commit'
    );
    expect(commitCalls.length).toBeGreaterThan(0);
    expect(commitCalls[0][1]).toEqual(['commit', '-m', 'Update by NOFX run run-123']);

    // Should use default title in PR
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"title":"Update by NOFX run run-123"')
      })
    );
  });

  it('should handle step.inputs being undefined', async () => {
    const step = {
      id: 'step-123',
      name: 'create-pr',
      tool: 'git_pr'
      // inputs is undefined
    } as any;

    await expect(gitPrHandler.run({
      runId: 'run-123',
      step: step
    })).rejects.toThrow('git_pr requires commits');
  });

  it('should handle artifact with null path in listArtifactsByRun', async () => {
    // Set driver back to fs for this test
    (mockStore as any).driver = 'fs';

    mockStore.listStepsByRun.mockResolvedValue([
      { id: 'step-456', name: 'generate' }
    ] as any);

    mockStore.listArtifactsByRun.mockResolvedValue([
      { step_id: 'step-456', path: null }, // Null path
      { step_id: 'step-456', path: 'run-123/step-456/file.txt' }
    ] as any);

    // Mock fs.promises.readFile for the artifact
    const fs = await import('node:fs');
    (fs.promises.readFile as any).mockResolvedValue(Buffer.from('test content'));

    const step = {
      id: 'step-123',
      name: 'create-pr',
      tool: 'git_pr',
      inputs: {
        title: 'Test',
        commits: [
          {
            path: 'output.txt',
            fromStep: 'generate',
            artifactName: 'file.txt'
          }
        ]
      }
    };

    await gitPrHandler.run({
      runId: 'run-123',
      step: step as any
    });

    // Should find artifact with non-null path
    expect(mockStore.listArtifactsByRun).toHaveBeenCalled();
    expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
      status: 'succeeded',
      ended_at: expect.any(String),
      outputs: expect.objectContaining({
        files: ['output.txt']
      })
    });
  });
});
