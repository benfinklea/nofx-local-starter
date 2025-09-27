/**
 * Git Validation Service - extracted from git_ops.ts
 * Handles input validation and security checks
 */

export interface GitOpsInputs {
  project_id: string;
  operation: 'save' | 'sync' | 'branch' | 'revert' | 'status' | 'commit' | 'push' | 'pull' | 'checkout' | 'merge';
  message?: string;
  branch_name?: string;
  create_new?: boolean;
  files?: string[];
  options?: Record<string, any>;
  remote?: string;
  commit_sha?: string;
  steps_back?: number;
}

export class GitValidationService {
  /**
   * Validate git operation inputs
   */
  validateInputs(inputs: any): GitOpsInputs {
    if (!inputs?.project_id) {
      throw new Error('project_id is required');
    }

    if (!inputs?.operation) {
      throw new Error('operation is required');
    }

    return inputs as GitOpsInputs;
  }

  /**
   * Validate operation is allowed for git mode
   */
  validateOperationForMode(operation: string, gitMode: string): void {
    const hiddenModeOperations = ['save', 'commit', 'sync', 'revert', 'status'];

    if (gitMode === 'hidden' && !hiddenModeOperations.includes(operation)) {
      throw new Error(`Operation ${operation} not available in hidden mode`);
    }
  }

  /**
   * Validate advanced mode requirements
   */
  validateAdvancedModeRequirements(operation: string, inputs: GitOpsInputs): void {
    switch (operation) {
      case 'commit':
        if (!inputs.message) {
          throw new Error('Commit message is required in advanced mode');
        }
        break;

      case 'checkout':
        if (!inputs.branch_name) {
          throw new Error('Branch name is required for checkout');
        }
        break;

      case 'merge':
        if (!inputs.branch_name) {
          throw new Error('Branch name is required for merge');
        }
        break;
    }
  }
}