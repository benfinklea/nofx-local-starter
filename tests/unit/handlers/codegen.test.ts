/**
 * Tests for codegen handler
 * Provides coverage for code generation functionality
 */

import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../../src/lib/store', () => ({
  store: {
    updateStep: jest.fn()
  }
}));

jest.mock('../../../src/lib/events', () => ({
  recordEvent: jest.fn()
}));

jest.mock('../../../src/lib/artifacts', () => ({
  saveArtifact: jest.fn()
}));

jest.mock('../../../src/tools/codegen', () => ({
  codegenReadme: jest.fn()
}));

jest.mock('../../../src/lib/settings', () => ({
  getSettings: jest.fn()
}));

jest.mock('../../../src/lib/models', () => ({
  getModelByName: jest.fn()
}));

jest.mock('../../../src/lib/logger', () => ({
  log: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  }
}));

import codegenHandler from '../../../src/worker/handlers/codegen';
import { store } from '../../../src/lib/store';
import { recordEvent } from '../../../src/lib/events';
import { saveArtifact } from '../../../src/lib/artifacts';
import { codegenReadme } from '../../../src/tools/codegen';
import { getSettings } from '../../../src/lib/settings';

const mockStore = jest.mocked(store);
const mockRecordEvent = jest.mocked(recordEvent);
const mockSaveArtifact = jest.mocked(saveArtifact);
const mockCodegenReadme = jest.mocked(codegenReadme);
const mockGetSettings = jest.mocked(getSettings);

describe('codegen handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.updateStep.mockResolvedValue(undefined);
    mockRecordEvent.mockResolvedValue(undefined);
    mockSaveArtifact.mockResolvedValue('https://example.com/file.md');
    mockGetSettings.mockResolvedValue({
      llm: {
        pricing: {
          'gpt-4': { input: 0.03, output: 0.06 }
        }
      }
    } as any);
  });

  describe('match', () => {
    it('should match codegen tool', () => {
      expect(codegenHandler.match('codegen')).toBe(true);
    });

    it('should not match other tools', () => {
      expect(codegenHandler.match('bash')).toBe(false);
      expect(codegenHandler.match('codegen_other')).toBe(false);
      expect(codegenHandler.match('code')).toBe(false);
    });
  });

  describe('run', () => {
    const baseStep = {
      id: 'step-123',
      name: 'generate-readme',
      tool: 'codegen',
      inputs: {
        filename: 'README.md',
        description: 'Generate a README for this project'
      }
    };

    it('should generate code successfully with default filename', async () => {
      const codegenResult = {
        content: '# My Project\n\nThis is a great project.',
        provider: 'openai',
        model: 'gpt-4',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      };

      mockCodegenReadme.mockResolvedValue(codegenResult);

      await codegenHandler.run({
        runId: 'run-123',
        step: {
          ...baseStep,
          inputs: {} // No filename specified
        } as any
      });

      // Should call codegen with empty inputs
      expect(mockCodegenReadme).toHaveBeenCalledWith({});

      // Should save artifact with default filename
      expect(mockSaveArtifact).toHaveBeenCalledWith(
        'run-123',
        'step-123',
        'README.md',
        codegenResult.content,
        'text/markdown'
      );

      // Should update step to succeeded with outputs
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: {
          artifact: 'https://example.com/file.md',
          provider: 'openai',
          model: 'gpt-4',
          usage: codegenResult.usage,
          costUSD: 0
        }
      });

      // Should record step.finished event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-123',
        'step.finished',
        {
          artifact: 'https://example.com/file.md',
          provider: 'openai',
          model: 'gpt-4',
          usage: codegenResult.usage,
          costUSD: 0
        },
        'step-123'
      );
    });

    it('should use custom filename when provided', async () => {
      const codegenResult = {
        content: 'console.log("Hello World");',
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        usage: {
          prompt_tokens: 50,
          completion_tokens: 25,
          total_tokens: 75
        }
      };

      mockCodegenReadme.mockResolvedValue(codegenResult);

      await codegenHandler.run({
        runId: 'run-123',
        step: {
          ...baseStep,
          inputs: {
            filename: 'main.js',
            prompt: 'Generate a hello world script'
          }
        } as any
      });

      // Should call codegen with provided inputs
      expect(mockCodegenReadme).toHaveBeenCalledWith({
        filename: 'main.js',
        prompt: 'Generate a hello world script'
      });

      // Should save artifact with custom filename
      expect(mockSaveArtifact).toHaveBeenCalledWith(
        'run-123',
        'step-123',
        'main.js',
        codegenResult.content,
        'text/markdown'
      );

      // Should update step with correct outputs
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: {
          artifact: 'https://example.com/file.md',
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          usage: codegenResult.usage,
          costUSD: 0
        }
      });
    });

    it('should handle codegen without usage information', async () => {
      const codegenResult = {
        content: '# Simple README',
        provider: 'openai',
        model: 'gpt-3.5-turbo'
        // No usage field
      };

      mockCodegenReadme.mockResolvedValue(codegenResult);

      await codegenHandler.run({
        runId: 'run-123',
        step: baseStep as any
      });

      // Should not include usage or cost when not provided
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'succeeded',
        ended_at: expect.any(String),
        outputs: {
          artifact: 'https://example.com/file.md',
          provider: 'openai',
          model: 'gpt-3.5-turbo'
        }
      });

      // Should record event without usage
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-123',
        'step.finished',
        {
          artifact: 'https://example.com/file.md',
          provider: 'openai',
          model: 'gpt-3.5-turbo'
        },
        'step-123'
      );
    });

    it('should always use text/markdown content type', async () => {
      const testCases = [
        'script.py',
        'config.json',
        'styles.css',
        'index.html',
        'code.txt',
        'README.md'
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        mockStore.updateStep.mockResolvedValue(undefined);
        mockSaveArtifact.mockResolvedValue('https://example.com/file');

        const codegenResult = {
          content: 'test content',
          provider: 'openai',
          model: 'gpt-4'
        };

        mockCodegenReadme.mockResolvedValue(codegenResult);

        await codegenHandler.run({
          runId: 'run-123',
          step: {
            ...baseStep,
            inputs: { filename: testCase }
          } as any
        });

        expect(mockSaveArtifact).toHaveBeenCalledWith(
          'run-123',
          'step-123',
          testCase,
          'test content',
          'text/markdown'
        );
      }
    });

    it('should handle codegen errors properly', async () => {
      mockCodegenReadme.mockRejectedValue(new Error('LLM API failed'));

      await expect(codegenHandler.run({
        runId: 'run-123',
        step: baseStep as any
      })).rejects.toThrow('LLM API failed');

      // Should have started the step
      expect(mockStore.updateStep).toHaveBeenCalledWith('step-123', {
        status: 'running',
        started_at: expect.any(String)
      });

      // Should have recorded start event
      expect(mockRecordEvent).toHaveBeenCalledWith(
        'run-123',
        'step.started',
        { name: 'generate-readme', tool: 'codegen' },
        'step-123'
      );

      // Should not have saved artifact
      expect(mockSaveArtifact).not.toHaveBeenCalled();
    });

    it('should handle artifact save errors', async () => {
      const codegenResult = {
        content: '# Test',
        provider: 'openai',
        model: 'gpt-4'
      };

      mockCodegenReadme.mockResolvedValue(codegenResult);
      mockSaveArtifact.mockRejectedValue(new Error('Storage failed'));

      await expect(codegenHandler.run({
        runId: 'run-123',
        step: baseStep as any
      })).rejects.toThrow('Storage failed');

      // Should have called codegen
      expect(mockCodegenReadme).toHaveBeenCalled();

      // Should have attempted to save artifact
      expect(mockSaveArtifact).toHaveBeenCalled();
    });

    it('should handle empty filename input', async () => {
      const codegenResult = {
        content: 'test content',
        provider: 'openai',
        model: 'gpt-4'
      };

      mockCodegenReadme.mockResolvedValue(codegenResult);

      await codegenHandler.run({
        runId: 'run-123',
        step: {
          ...baseStep,
          inputs: { filename: '   ' } // Whitespace only
        } as any
      });

      // Should default to README.md when filename is empty/whitespace
      expect(mockSaveArtifact).toHaveBeenCalledWith(
        'run-123',
        'step-123',
        'README.md',
        'test content',
        'text/markdown'
      );
    });
  });
});