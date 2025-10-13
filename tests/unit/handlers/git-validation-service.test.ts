/**
 * Comprehensive tests for GitValidationService
 * Target coverage: 95%+
 */

import { jest } from '@jest/globals';
import { GitValidationService, GitOpsInputs } from '../../../src/worker/handlers/git_ops/GitValidationService';

describe('GitValidationService', () => {
  let service: GitValidationService;

  beforeEach(() => {
    service = new GitValidationService();
  });

  describe('validateInputs', () => {
    it('should validate correct inputs', () => {
      const inputs = {
        project_id: 'proj-123',
        operation: 'commit' as const,
        message: 'test commit'
      };

      const result = service.validateInputs(inputs);

      expect(result).toEqual(inputs);
      expect(result.project_id).toBe('proj-123');
      expect(result.operation).toBe('commit');
    });

    it('should throw error when project_id is missing', () => {
      const inputs = {
        operation: 'commit'
      };

      expect(() => service.validateInputs(inputs)).toThrow('project_id is required');
    });

    it('should throw error when project_id is null', () => {
      const inputs = {
        project_id: null,
        operation: 'commit'
      };

      expect(() => service.validateInputs(inputs)).toThrow('project_id is required');
    });

    it('should throw error when project_id is undefined', () => {
      const inputs = {
        project_id: undefined,
        operation: 'commit'
      };

      expect(() => service.validateInputs(inputs)).toThrow('project_id is required');
    });

    it('should throw error when operation is missing', () => {
      const inputs = {
        project_id: 'proj-123'
      };

      expect(() => service.validateInputs(inputs)).toThrow('operation is required');
    });

    it('should throw error when operation is null', () => {
      const inputs = {
        project_id: 'proj-123',
        operation: null
      };

      expect(() => service.validateInputs(inputs)).toThrow('operation is required');
    });

    it('should throw error when operation is undefined', () => {
      const inputs = {
        project_id: 'proj-123',
        operation: undefined
      };

      expect(() => service.validateInputs(inputs)).toThrow('operation is required');
    });

    it('should accept all valid operations', () => {
      const operations: Array<GitOpsInputs['operation']> = [
        'save', 'sync', 'branch', 'revert', 'status',
        'commit', 'push', 'pull', 'checkout', 'merge'
      ];

      operations.forEach(operation => {
        const inputs = {
          project_id: 'proj-123',
          operation
        };

        const result = service.validateInputs(inputs);
        expect(result.operation).toBe(operation);
      });
    });

    it('should preserve optional fields', () => {
      const inputs = {
        project_id: 'proj-123',
        operation: 'commit' as const,
        message: 'test message',
        branch_name: 'feature-branch',
        create_new: true,
        files: ['file1.ts', 'file2.ts'],
        options: { verbose: true },
        remote: 'origin',
        commit_sha: 'abc123',
        steps_back: 2
      };

      const result = service.validateInputs(inputs);

      expect(result.message).toBe('test message');
      expect(result.branch_name).toBe('feature-branch');
      expect(result.create_new).toBe(true);
      expect(result.files).toEqual(['file1.ts', 'file2.ts']);
      expect(result.options).toEqual({ verbose: true });
      expect(result.remote).toBe('origin');
      expect(result.commit_sha).toBe('abc123');
      expect(result.steps_back).toBe(2);
    });

    it('should handle null inputs gracefully', () => {
      expect(() => service.validateInputs(null)).toThrow('project_id is required');
    });

    it('should handle empty object', () => {
      expect(() => service.validateInputs({})).toThrow('project_id is required');
    });
  });

  describe('validateOperationForMode', () => {
    describe('hidden mode', () => {
      const hiddenMode = 'hidden';

      it('should allow save operation', () => {
        expect(() => service.validateOperationForMode('save', hiddenMode)).not.toThrow();
      });

      it('should allow commit operation', () => {
        expect(() => service.validateOperationForMode('commit', hiddenMode)).not.toThrow();
      });

      it('should allow sync operation', () => {
        expect(() => service.validateOperationForMode('sync', hiddenMode)).not.toThrow();
      });

      it('should allow revert operation', () => {
        expect(() => service.validateOperationForMode('revert', hiddenMode)).not.toThrow();
      });

      it('should allow status operation', () => {
        expect(() => service.validateOperationForMode('status', hiddenMode)).not.toThrow();
      });

      it('should reject push operation', () => {
        expect(() => service.validateOperationForMode('push', hiddenMode))
          .toThrow('Operation push not available in hidden mode');
      });

      it('should reject pull operation', () => {
        expect(() => service.validateOperationForMode('pull', hiddenMode))
          .toThrow('Operation pull not available in hidden mode');
      });

      it('should reject branch operation', () => {
        expect(() => service.validateOperationForMode('branch', hiddenMode))
          .toThrow('Operation branch not available in hidden mode');
      });

      it('should reject checkout operation', () => {
        expect(() => service.validateOperationForMode('checkout', hiddenMode))
          .toThrow('Operation checkout not available in hidden mode');
      });

      it('should reject merge operation', () => {
        expect(() => service.validateOperationForMode('merge', hiddenMode))
          .toThrow('Operation merge not available in hidden mode');
      });
    });

    describe('basic mode', () => {
      const basicMode = 'basic';

      it('should allow all operations in basic mode', () => {
        const operations = [
          'save', 'sync', 'branch', 'revert', 'status',
          'commit', 'push', 'pull', 'checkout', 'merge'
        ];

        operations.forEach(operation => {
          expect(() => service.validateOperationForMode(operation, basicMode))
            .not.toThrow();
        });
      });
    });

    describe('advanced mode', () => {
      const advancedMode = 'advanced';

      it('should allow all operations in advanced mode', () => {
        const operations = [
          'save', 'sync', 'branch', 'revert', 'status',
          'commit', 'push', 'pull', 'checkout', 'merge'
        ];

        operations.forEach(operation => {
          expect(() => service.validateOperationForMode(operation, advancedMode))
            .not.toThrow();
        });
      });
    });
  });

  describe('validateAdvancedModeRequirements', () => {
    describe('commit operation', () => {
      it('should require message for commit', () => {
        const inputs = {
          project_id: 'proj-123',
          operation: 'commit' as const
        };

        expect(() => service.validateAdvancedModeRequirements('commit', inputs))
          .toThrow('Commit message is required in advanced mode');
      });

      it('should accept commit with message', () => {
        const inputs = {
          project_id: 'proj-123',
          operation: 'commit' as const,
          message: 'test commit'
        };

        expect(() => service.validateAdvancedModeRequirements('commit', inputs))
          .not.toThrow();
      });

      it('should reject empty commit message', () => {
        const inputs = {
          project_id: 'proj-123',
          operation: 'commit' as const,
          message: ''
        };

        expect(() => service.validateAdvancedModeRequirements('commit', inputs))
          .toThrow('Commit message is required in advanced mode');
      });

      it('should accept whitespace-only message (git allows it)', () => {
        const inputs = {
          project_id: 'proj-123',
          operation: 'commit' as const,
          message: '   '
        };

        // Git allows whitespace messages, so we should too
        expect(() => service.validateAdvancedModeRequirements('commit', inputs))
          .not.toThrow();
      });
    });

    describe('checkout operation', () => {
      it('should require branch_name for checkout', () => {
        const inputs = {
          project_id: 'proj-123',
          operation: 'checkout' as const
        };

        expect(() => service.validateAdvancedModeRequirements('checkout', inputs))
          .toThrow('Branch name is required for checkout');
      });

      it('should accept checkout with branch_name', () => {
        const inputs = {
          project_id: 'proj-123',
          operation: 'checkout' as const,
          branch_name: 'feature-branch'
        };

        expect(() => service.validateAdvancedModeRequirements('checkout', inputs))
          .not.toThrow();
      });

      it('should reject empty branch name', () => {
        const inputs = {
          project_id: 'proj-123',
          operation: 'checkout' as const,
          branch_name: ''
        };

        expect(() => service.validateAdvancedModeRequirements('checkout', inputs))
          .toThrow('Branch name is required for checkout');
      });
    });

    describe('merge operation', () => {
      it('should require branch_name for merge', () => {
        const inputs = {
          project_id: 'proj-123',
          operation: 'merge' as const
        };

        expect(() => service.validateAdvancedModeRequirements('merge', inputs))
          .toThrow('Branch name is required for merge');
      });

      it('should accept merge with branch_name', () => {
        const inputs = {
          project_id: 'proj-123',
          operation: 'merge' as const,
          branch_name: 'feature-branch'
        };

        expect(() => service.validateAdvancedModeRequirements('merge', inputs))
          .not.toThrow();
      });

      it('should reject empty branch name', () => {
        const inputs = {
          project_id: 'proj-123',
          operation: 'merge' as const,
          branch_name: ''
        };

        expect(() => service.validateAdvancedModeRequirements('merge', inputs))
          .toThrow('Branch name is required for merge');
      });
    });

    describe('other operations', () => {
      it('should not validate save operation', () => {
        const inputs = {
          project_id: 'proj-123',
          operation: 'save' as const
        };

        expect(() => service.validateAdvancedModeRequirements('save', inputs))
          .not.toThrow();
      });

      it('should not validate sync operation', () => {
        const inputs = {
          project_id: 'proj-123',
          operation: 'sync' as const
        };

        expect(() => service.validateAdvancedModeRequirements('sync', inputs))
          .not.toThrow();
      });

      it('should not validate push operation', () => {
        const inputs = {
          project_id: 'proj-123',
          operation: 'push' as const
        };

        expect(() => service.validateAdvancedModeRequirements('push', inputs))
          .not.toThrow();
      });

      it('should not validate pull operation', () => {
        const inputs = {
          project_id: 'proj-123',
          operation: 'pull' as const
        };

        expect(() => service.validateAdvancedModeRequirements('pull', inputs))
          .not.toThrow();
      });

      it('should not validate branch operation', () => {
        const inputs = {
          project_id: 'proj-123',
          operation: 'branch' as const
        };

        expect(() => service.validateAdvancedModeRequirements('branch', inputs))
          .not.toThrow();
      });

      it('should not validate revert operation', () => {
        const inputs = {
          project_id: 'proj-123',
          operation: 'revert' as const
        };

        expect(() => service.validateAdvancedModeRequirements('revert', inputs))
          .not.toThrow();
      });

      it('should not validate status operation', () => {
        const inputs = {
          project_id: 'proj-123',
          operation: 'status' as const
        };

        expect(() => service.validateAdvancedModeRequirements('status', inputs))
          .not.toThrow();
      });
    });
  });

  describe('combined validation scenarios', () => {
    it('should validate complete hidden mode flow', () => {
      const inputs = {
        project_id: 'proj-123',
        operation: 'save' as const,
        message: 'Auto-save'
      };

      const validated = service.validateInputs(inputs);
      expect(() => service.validateOperationForMode(validated.operation, 'hidden')).not.toThrow();
    });

    it('should validate complete basic mode flow', () => {
      const inputs = {
        project_id: 'proj-123',
        operation: 'commit' as const,
        message: 'User commit'
      };

      const validated = service.validateInputs(inputs);
      expect(() => service.validateOperationForMode(validated.operation, 'basic')).not.toThrow();
    });

    it('should validate complete advanced mode flow with requirements', () => {
      const inputs = {
        project_id: 'proj-123',
        operation: 'commit' as const,
        message: 'Advanced commit',
        files: ['src/index.ts']
      };

      const validated = service.validateInputs(inputs);
      expect(() => service.validateOperationForMode(validated.operation, 'advanced')).not.toThrow();
      expect(() => service.validateAdvancedModeRequirements(validated.operation, validated)).not.toThrow();
    });

    it('should reject hidden mode advanced operation', () => {
      const inputs = {
        project_id: 'proj-123',
        operation: 'merge' as const,
        branch_name: 'feature'
      };

      const validated = service.validateInputs(inputs);
      expect(() => service.validateOperationForMode(validated.operation, 'hidden'))
        .toThrow('Operation merge not available in hidden mode');
    });

    it('should reject advanced mode operation without requirements', () => {
      const inputs = {
        project_id: 'proj-123',
        operation: 'checkout' as const
        // Missing branch_name
      };

      const validated = service.validateInputs(inputs);
      expect(() => service.validateAdvancedModeRequirements(validated.operation, validated))
        .toThrow('Branch name is required for checkout');
    });
  });

  describe('edge cases', () => {
    it('should handle very long project IDs', () => {
      const inputs = {
        project_id: 'a'.repeat(1000),
        operation: 'status' as const
      };

      const result = service.validateInputs(inputs);
      expect(result.project_id).toHaveLength(1000);
    });

    it('should handle special characters in optional fields', () => {
      const inputs = {
        project_id: 'proj-123',
        operation: 'commit' as const,
        message: 'feat: add ✨ emoji support 🎉',
        branch_name: 'feature/emoji-🎨'
      };

      const result = service.validateInputs(inputs);
      expect(result.message).toContain('✨');
      expect(result.branch_name).toContain('🎨');
    });

    it('should handle numeric project IDs', () => {
      const inputs = {
        project_id: '12345',
        operation: 'status' as const
      };

      const result = service.validateInputs(inputs);
      expect(result.project_id).toBe('12345');
    });

    it('should preserve complex options object', () => {
      const inputs = {
        project_id: 'proj-123',
        operation: 'push' as const,
        options: {
          force: true,
          tags: false,
          upstream: 'origin',
          nested: {
            deep: {
              value: 'test'
            }
          }
        }
      };

      const result = service.validateInputs(inputs);
      expect(result.options).toEqual(inputs.options);
      expect(result.options?.nested?.deep?.value).toBe('test');
    });
  });
});
