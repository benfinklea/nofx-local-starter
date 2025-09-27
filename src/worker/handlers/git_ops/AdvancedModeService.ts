/**
 * Advanced Mode Service - extracted from git_ops.ts
 * Handles git operations in advanced mode (full git access)
 */

import { SimpleGit } from 'simple-git';
import { GitOpsInputs } from './GitValidationService';

export class AdvancedModeService {
  /**
   * Execute operations in advanced mode
   */
  async executeOperation(git: SimpleGit, inputs: GitOpsInputs, _project: any): Promise<any> {
    switch (inputs.operation) {
      case 'commit':
        return this.handleCommit(git, inputs);

      case 'push':
        return this.handlePush(git, inputs);

      case 'pull':
        return this.handlePull(git, inputs);

      case 'checkout':
        return this.handleCheckout(git, inputs);

      case 'merge':
        return this.handleMerge(git, inputs);

      case 'status':
        return this.handleStatus(git);

      default:
        throw new Error(`Unknown operation: ${inputs.operation}`);
    }
  }

  /**
   * Handle commit operation in advanced mode
   */
  private async handleCommit(git: SimpleGit, inputs: GitOpsInputs): Promise<any> {
    if (!inputs.message) {
      throw new Error('Commit message is required in advanced mode');
    }

    if (inputs.files && inputs.files.length > 0) {
      await git.add(inputs.files);
    } else {
      await git.add('.');
    }

    const commit = await git.commit(inputs.message, inputs.options);
    return {
      commit: commit.commit,
      branch: commit.branch,
      summary: commit.summary
    };
  }

  /**
   * Handle push operation in advanced mode
   */
  private async handlePush(git: SimpleGit, inputs: GitOpsInputs): Promise<any> {
    const remote = inputs.remote || 'origin';
    const branch = inputs.branch_name || 'HEAD';
    const result = await git.push(remote, branch, inputs.options);

    return {
      pushed: true,
      remote,
      branch,
      result
    };
  }

  /**
   * Handle pull operation in advanced mode
   */
  private async handlePull(git: SimpleGit, inputs: GitOpsInputs): Promise<any> {
    const remote = inputs.remote || 'origin';
    const branch = inputs.branch_name;
    const result = branch
      ? await git.pull(remote, branch, inputs.options)
      : await git.pull(inputs.options);

    return {
      pulled: true,
      summary: result.summary,
      files: result.files,
      insertions: result.insertions,
      deletions: result.deletions
    };
  }

  /**
   * Handle checkout operation in advanced mode
   */
  private async handleCheckout(git: SimpleGit, inputs: GitOpsInputs): Promise<any> {
    if (!inputs.branch_name) {
      throw new Error('Branch name is required for checkout');
    }

    if (inputs.create_new) {
      await git.checkoutBranch(inputs.branch_name, 'HEAD');
    } else {
      await git.checkout(inputs.branch_name, inputs.options);
    }

    const status = await git.status();
    return {
      branch: status.current,
      isClean: status.isClean()
    };
  }

  /**
   * Handle merge operation in advanced mode
   */
  private async handleMerge(git: SimpleGit, inputs: GitOpsInputs): Promise<any> {
    if (!inputs.branch_name) {
      throw new Error('Branch name is required for merge');
    }

    const result = await git.merge([inputs.branch_name]);
    return {
      merged: result.merges.length > 0,
      conflicts: result.conflicts.length > 0,
      result
    };
  }

  /**
   * Handle status operation in advanced mode
   */
  private async handleStatus(git: SimpleGit): Promise<any> {
    const status = await git.status();
    return status; // Return full git status object
  }
}