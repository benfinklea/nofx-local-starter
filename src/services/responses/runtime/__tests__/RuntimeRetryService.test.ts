/**
 * RuntimeRetryService Tests
 * Comprehensive test coverage for retry functionality
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RuntimeRetryService } from '../RuntimeRetryService';
import type { RuntimeBundle } from '../../runtime';
import type { RunRecord } from '../../../../shared/responses/archive';
import type { ResponsesRunResult } from '../../runService';

describe('RuntimeRetryService', () => {
  let service: RuntimeRetryService;
  let mockRuntime: RuntimeBundle;
  let mockArchive: any;
  let mockService: any;
  let mockIncidents: any;

  beforeEach(() => {
    mockArchive = {
      getRun: jest.fn(),
    };

    mockService = {
      execute: jest.fn(),
    };

    mockIncidents = {
      resolveIncidentsByRun: jest.fn(),
    };

    mockRuntime = {
      archive: mockArchive,
      service: mockService,
      incidents: mockIncidents,
    } as any;

    service = new RuntimeRetryService(mockRuntime);
  });

  describe('retryResponsesRun', () => {
    it('should retry a run with minimal configuration', async () => {
      const originalRunId = 'original-run-123';
      const newRunId = 'retry-run-456';

      const originalRun: RunRecord = {
        runId: originalRunId,
        status: 'failed',
        request: {
          model: 'gpt-4',
          input: 'test data',
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      const retryResult = {
        runId: newRunId,
        status: 'completed' as const,
      };

      mockArchive.getRun.mockReturnValue(originalRun);
      mockService.execute.mockResolvedValue(retryResult);

      const result = await service.retryResponsesRun(originalRunId);

      expect(mockArchive.getRun).toHaveBeenCalledWith(originalRunId);
      expect(mockService.execute).toHaveBeenCalledWith({
        tenantId: 'default',
        request: expect.objectContaining({
          model: 'gpt-4',
          input: 'test data',
          metadata: {
            retried_from: originalRunId,
          },
        }),
        metadata: {
          retried_from: originalRunId,
        },
        history: undefined,
        conversationPolicy: { strategy: 'stateless' },
        background: false,
      });
      expect(mockIncidents.resolveIncidentsByRun).toHaveBeenCalledWith(originalRunId, {
        resolvedBy: 'system',
        disposition: 'retry',
        linkedRunId: newRunId,
      });
      expect(result.runId).toBe(newRunId);
    });

    it('should throw error when run not found', async () => {
      mockArchive.getRun.mockReturnValue(null);

      await expect(service.retryResponsesRun('nonexistent-run')).rejects.toThrow('run not found');
    });

    it('should throw error when original run missing input', async () => {
      const originalRun: RunRecord = {
        runId: 'run-123',
        status: 'failed',
        request: {
          model: 'gpt-4',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.getRun.mockReturnValue(originalRun);

      await expect(service.retryResponsesRun('run-123')).rejects.toThrow(
        'original run is missing input payload'
      );
    });

    it('should use custom tenant ID when provided', async () => {
      const originalRun: RunRecord = {
        runId: 'run-123',
        status: 'failed',
        request: {
          model: 'gpt-4',
          input: 'test data',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.getRun.mockReturnValue(originalRun);
      mockService.execute.mockResolvedValue({ runId: 'new-run', status: 'completed', output: [] });

      await service.retryResponsesRun('run-123', { tenantId: 'custom-tenant' });

      expect(mockService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'custom-tenant',
        })
      );
    });

    it('should extract tenant ID from original run metadata', async () => {
      const originalRun: RunRecord = {
        runId: 'run-123',
        status: 'failed',
        request: {
          model: 'gpt-4',
          input: 'test data',
        },
        metadata: { tenant_id: 'tenant-from-metadata' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.getRun.mockReturnValue(originalRun);
      mockService.execute.mockResolvedValue({ runId: 'new-run', status: 'completed', output: [] });

      await service.retryResponsesRun('run-123');

      expect(mockService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-from-metadata',
        })
      );
    });

    it('should support tenantId field in metadata', async () => {
      const originalRun: RunRecord = {
        runId: 'run-123',
        status: 'failed',
        request: {
          model: 'gpt-4',
          input: 'test data',
        },
        metadata: { tenantId: 'tenant-camelcase' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.getRun.mockReturnValue(originalRun);
      mockService.execute.mockResolvedValue({ runId: 'new-run', status: 'completed', output: [] });

      await service.retryResponsesRun('run-123');

      expect(mockService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-camelcase',
        })
      );
    });

    it('should merge custom metadata with original metadata', async () => {
      const originalRun: RunRecord = {
        runId: 'run-123',
        status: 'failed',
        request: {
          model: 'gpt-4',
          input: 'test data',
        },
        metadata: { original_key: 'original_value', shared_key: 'original' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.getRun.mockReturnValue(originalRun);
      mockService.execute.mockResolvedValue({ runId: 'new-run', status: 'completed', output: [] });

      await service.retryResponsesRun('run-123', {
        metadata: { custom_key: 'custom_value', shared_key: 'custom' },
      });

      expect(mockService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            original_key: 'original_value',
            custom_key: 'custom_value',
            shared_key: 'custom',
            retried_from: 'run-123',
          },
        })
      );
    });

    it('should add retried_from to request metadata', async () => {
      const originalRun: RunRecord = {
        runId: 'run-123',
        status: 'failed',
        request: {
          model: 'gpt-4',
          input: 'test data',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.getRun.mockReturnValue(originalRun);
      mockService.execute.mockResolvedValue({ runId: 'new-run', status: 'completed', output: [] });

      await service.retryResponsesRun('run-123');

      expect(mockService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            retried_from: 'run-123',
          },
        })
      );
    });

    it('should support background execution', async () => {
      const originalRun: RunRecord = {
        runId: 'run-123',
        status: 'failed',
        request: {
          model: 'gpt-4',
          input: 'test data',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.getRun.mockReturnValue(originalRun);
      mockService.execute.mockResolvedValue({ runId: 'new-run', status: 'in_progress', output: [] });

      await service.retryResponsesRun('run-123', { background: true });

      expect(mockService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          background: true,
        })
      );
    });

    it('should default to foreground execution', async () => {
      const originalRun: RunRecord = {
        runId: 'run-123',
        status: 'failed',
        request: {
          model: 'gpt-4',
          input: 'test data',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.getRun.mockReturnValue(originalRun);
      mockService.execute.mockResolvedValue({ runId: 'new-run', status: 'completed', output: [] });

      await service.retryResponsesRun('run-123');

      expect(mockService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          background: false,
        })
      );
    });

    it('should resolve related incidents after successful retry', async () => {
      const originalRunId = 'run-123';
      const newRunId = 'retry-run-456';

      const originalRun: RunRecord = {
        runId: originalRunId,
        status: 'failed',
        request: {
          model: 'gpt-4',
          input: 'test data',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.getRun.mockReturnValue(originalRun);
      mockService.execute.mockResolvedValue({ runId: newRunId, status: 'completed', output: [] });

      await service.retryResponsesRun(originalRunId);

      expect(mockIncidents.resolveIncidentsByRun).toHaveBeenCalledTimes(1);
      expect(mockIncidents.resolveIncidentsByRun).toHaveBeenCalledWith(originalRunId, {
        resolvedBy: 'system',
        disposition: 'retry',
        linkedRunId: newRunId,
      });
    });

    it('should preserve original request configuration', async () => {
      const originalRun: RunRecord = {
        runId: 'run-123',
        status: 'failed',
        request: {
          model: 'gpt-4',
          input: 'test data',
          temperature: 0.7,
          max_output_tokens: 1000,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.getRun.mockReturnValue(originalRun);
      mockService.execute.mockResolvedValue({ runId: 'new-run', status: 'completed', output: [] });

      await service.retryResponsesRun('run-123');

      expect(mockService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({
            temperature: 0.7,
            max_output_tokens: 1000,
          }),
        })
      );
    });

    it('should handle complex input payloads', async () => {
      const complexInput = 'This is a complex test input with lots of data and information to test';

      const originalRun: RunRecord = {
        runId: 'run-123',
        status: 'failed',
        request: {
          model: 'gpt-4',
          input: complexInput,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.getRun.mockReturnValue(originalRun);
      mockService.execute.mockResolvedValue({ runId: 'new-run', status: 'completed', output: [] });

      await service.retryResponsesRun('run-123');

      expect(mockService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({
            input: complexInput,
          }),
        })
      );
    });

    it('should use stateless conversation policy', async () => {
      const originalRun: RunRecord = {
        runId: 'run-123',
        status: 'failed',
        request: {
          model: 'gpt-4',
          input: 'test data',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.getRun.mockReturnValue(originalRun);
      mockService.execute.mockResolvedValue({ runId: 'new-run', status: 'completed', output: [] });

      await service.retryResponsesRun('run-123');

      expect(mockService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationPolicy: { strategy: 'stateless' },
          history: undefined,
        })
      );
    });

    it('should handle retry of successful run', async () => {
      const originalRun: RunRecord = {
        runId: 'run-123',
        status: 'completed',
        request: {
          model: 'gpt-4',
          input: 'test data',
        },
        result: {
          id: 'result-123',
          status: 'completed' as const,
          output: [],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.getRun.mockReturnValue(originalRun);
      mockService.execute.mockResolvedValue({ runId: 'new-run', status: 'completed', output: [] });

      const result = await service.retryResponsesRun('run-123');

      expect(result.runId).toBe('new-run');
    });

    it('should handle empty metadata gracefully', async () => {
      const originalRun: RunRecord = {
        runId: 'run-123',
        status: 'failed',
        request: {
          model: 'gpt-4',
          input: 'test data',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.getRun.mockReturnValue(originalRun);
      mockService.execute.mockResolvedValue({ runId: 'new-run', status: 'completed', output: [] });

      await service.retryResponsesRun('run-123');

      expect(mockService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            retried_from: 'run-123',
          },
        })
      );
    });

    it('should handle request with no metadata', async () => {
      const originalRun: RunRecord = {
        runId: 'run-123',
        status: 'failed',
        request: {
          model: 'gpt-4',
          input: 'test data',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.getRun.mockReturnValue(originalRun);
      mockService.execute.mockResolvedValue({ runId: 'new-run', status: 'completed', output: [] });

      await service.retryResponsesRun('run-123');

      expect(mockService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({
            metadata: {
              retried_from: 'run-123',
            },
          }),
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle retry chain (retrying a retry)', async () => {
      const originalRun: RunRecord = {
        runId: 'retry-run-1',
        status: 'failed',
        request: {
          model: 'gpt-4',
          input: 'test data',
          metadata: { retried_from: 'original-run' },
        },
        metadata: { retried_from: 'original-run' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.getRun.mockReturnValue(originalRun);
      mockService.execute.mockResolvedValue({ runId: 'retry-run-2', status: 'completed', output: [] });

      const result = await service.retryResponsesRun('retry-run-1');

      expect(result.runId).toBe('retry-run-2');
      expect(mockService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({
            metadata: expect.objectContaining({
              retried_from: 'retry-run-1',
            }),
          }),
        })
      );
    });

    it('should handle very large input payloads', async () => {
      const largeInput = 'x'.repeat(1000000);

      const originalRun: RunRecord = {
        runId: 'run-123',
        status: 'failed',
        request: {
          model: 'gpt-4',
          input: largeInput,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.getRun.mockReturnValue(originalRun);
      mockService.execute.mockResolvedValue({ runId: 'new-run', status: 'completed', output: [] });

      await service.retryResponsesRun('run-123');

      expect(mockService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({
            input: largeInput,
          }),
        })
      );
    });

    it('should handle special characters in metadata', async () => {
      const originalRun: RunRecord = {
        runId: 'run-123',
        status: 'failed',
        request: {
          model: 'gpt-4',
          input: 'test data',
        },
        metadata: {
          'special-key': 'value!@#$',
          'unicode': '你好🌍',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockArchive.getRun.mockReturnValue(originalRun);
      mockService.execute.mockResolvedValue({ runId: 'new-run', status: 'completed', output: [] });

      await service.retryResponsesRun('run-123');

      expect(mockService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            'special-key': 'value!@#$',
            'unicode': '你好🌍',
          }),
        })
      );
    });
  });
});
