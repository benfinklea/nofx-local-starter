/**
 * Basic Mode Service - extracted from git_ops.ts
 * Handles git operations in basic mode (gentle git exposure)
 */

import { SimpleGit } from 'simple-git';
import { log } from '../../../lib/logger';
import { GitOpsInputs } from './GitValidationService';
import { AdvancedModeService } from './AdvancedModeService';

export class BasicModeService {
  constructor(private readonly advancedModeService: AdvancedModeService) {}

  /**
   * Execute operations in basic mode
   */
  async executeOperation(git: SimpleGit, inputs: GitOpsInputs, project: any): Promise<any> {
    switch (inputs.operation) {
      case 'save':
      case 'commit':
        return this.handleCommit(git, inputs);

      case 'branch':
        return this.handleBranch(git, inputs);

      case 'sync':
      case 'pull':
        return this.handlePull(git);

      case 'push':
        return this.handlePush(git);

      case 'revert':
        return this.handleRevert(git, inputs);

      case 'status':
        return this.handleStatus(git);

      default:
        // Allow advanced operations in basic mode with warning
        log.warn({ operation: inputs.operation }, 'Advanced operation used in basic mode');
        return this.advancedModeService.executeOperation(git, inputs, project);
    }
  }

  /**
   * Handle commit operation in basic mode
   */
  private async handleCommit(git: SimpleGit, inputs: GitOpsInputs): Promise<any> {
    const status = await git.status();
    if (status.isClean()) {
      return { message: 'No changes to commit', committed: false };
    }

    await git.add('.');
    const message = inputs.message || `Save progress: ${new Date().toLocaleString()}`;
    await git.commit(message);

    const log = await git.log(['-1']);
    return {
      message: `Saved: ${message}`,
      committed: true,
      version: log.latest?.hash.substring(0, 7),
      branch: status.current
    };
  }

  /**
   * Handle branch operation in basic mode
   */
  private async handleBranch(git: SimpleGit, inputs: GitOpsInputs): Promise<any> {
    if (!inputs.branch_name) {
      // List branches
      const branches = await git.branch();
      return {
        current: branches.current,
        branches: branches.all,
        message: `On branch: ${branches.current}`
      };
    }

    // Create or switch branch
    if (inputs.create_new) {
      await git.checkoutBranch(inputs.branch_name, 'HEAD');
      return { message: `Created and switched to branch: ${inputs.branch_name}` };
    } else {
      await git.checkout(inputs.branch_name);
      return { message: `Switched to branch: ${inputs.branch_name}` };
    }
  }

  /**
   * Handle pull operation in basic mode
   */
  private async handlePull(git: SimpleGit): Promise<any> {
    const before = await git.log(['-1']);
    await git.pull();
    const after = await git.log(['-1']);

    if (before.latest?.hash === after.latest?.hash) {
      return { message: 'Already up to date' };
    }

    return {
      message: 'Updated from remote',
      updated: true,
      newCommits: after.total - before.total
    };
  }

  /**
   * Handle push operation in basic mode
   */
  private async handlePush(git: SimpleGit): Promise<any> {
    await git.push();
    return { message: 'Changes uploaded to remote' };
  }

  /**
   * Handle revert operation in basic mode
   */
  private async handleRevert(git: SimpleGit, inputs: GitOpsInputs): Promise<any> {
    if (inputs.commit_sha) {
      await git.reset(['--hard', inputs.commit_sha]);
    } else {
      const stepsBack = inputs.steps_back || 1;
      await git.reset(['--hard', `HEAD~${stepsBack}`]);
    }

    const log = await git.log(['-1']);
    return {
      message: 'Reverted to previous version',
      currentVersion: log.latest?.hash.substring(0, 7)
    };
  }

  /**
   * Handle status operation in basic mode
   */
  private async handleStatus(git: SimpleGit): Promise<any> {
    const status = await git.status();
    const log = await git.log(['-1']);

    return {
      branch: status.current,
      hasChanges: !status.isClean(),
      filesChanged: status.files.map(f => f.path),
      lastCommit: log.latest?.message,
      ahead: status.ahead,
      behind: status.behind
    };
  }
}