/**
 * Hidden Mode Service - extracted from git_ops.ts
 * Handles git operations in hidden mode (no git terminology)
 */

import { SimpleGit } from 'simple-git';
import { GitOpsInputs } from './GitValidationService';

export class HiddenModeService {
  /**
   * Execute operations in hidden mode
   */
  async executeOperation(git: SimpleGit, inputs: GitOpsInputs, project: any): Promise<any> {
    switch (inputs.operation) {
      case 'save':
      case 'commit':
        return this.handleSave(git, project);

      case 'sync':
        return this.handleSync(git);

      case 'revert':
        return this.handleRevert(git, inputs);

      case 'status':
        return this.handleStatus(git);

      default:
        throw new Error(`Operation ${inputs.operation} not available in hidden mode`);
    }
  }

  /**
   * Handle save operation in hidden mode
   */
  private async handleSave(git: SimpleGit, project: any): Promise<any> {
    const status = await git.status();
    if (status.isClean()) {
      return { message: 'No changes to save' };
    }

    await git.add('.');
    const timestamp = new Date().toLocaleString();
    const message = `Saved progress for ${project.name} - ${timestamp}`;
    await git.commit(message);

    return {
      message: 'Progress saved successfully',
      saved: true
    };
  }

  /**
   * Handle sync operation in hidden mode
   */
  private async handleSync(git: SimpleGit): Promise<any> {
    try {
      await git.pull();
      return { message: 'Project updated to latest version' };
    } catch {
      return { message: 'Project is up to date' };
    }
  }

  /**
   * Handle revert operation in hidden mode
   */
  private async handleRevert(git: SimpleGit, inputs: GitOpsInputs): Promise<any> {
    const stepsBack = inputs.steps_back || 1;
    await git.reset(['--hard', `HEAD~${stepsBack}`]);
    return { message: 'Restored previous version' };
  }

  /**
   * Handle status operation in hidden mode
   */
  private async handleStatus(git: SimpleGit): Promise<any> {
    const status = await git.status();
    return {
      hasChanges: !status.isClean(),
      filesChanged: status.files.length,
      message: status.isClean() ? 'No unsaved changes' : `${status.files.length} file(s) modified`
    };
  }
}