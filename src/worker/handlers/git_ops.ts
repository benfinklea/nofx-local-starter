import type { StepHandler } from "./types";
import { store } from "../../lib/store";
import { recordEvent } from "../../lib/events";
import { getProject } from "../../lib/projects";
import { workspaceManager } from "../../lib/workspaces";
import simpleGit, { SimpleGit } from 'simple-git';
import { log } from "../../lib/logger";

interface GitOpsInputs {
  project_id: string;
  operation: 'save' | 'sync' | 'branch' | 'revert' | 'status' | 'commit' | 'push' | 'pull' | 'checkout' | 'merge';

  // Common parameters
  message?: string;

  // Branch operations
  branch_name?: string;
  create_new?: boolean;

  // Advanced mode parameters
  files?: string[];
  options?: Record<string, any>;
  remote?: string;

  // Revert parameters
  commit_sha?: string;
  steps_back?: number;
}

const handler: StepHandler = {
  match: (tool) => tool === 'git_ops',

  async run({ runId, step }) {
    const stepId = step.id;
    await store.updateStep(stepId, { status: 'running', started_at: new Date().toISOString() });
    await recordEvent(runId, 'step.started', { name: step.name, tool: step.tool }, stepId);

    try {
      const inputs = step.inputs as GitOpsInputs;

      if (!inputs?.project_id) {
        throw new Error('project_id is required');
      }

      if (!inputs?.operation) {
        throw new Error('operation is required');
      }

      // Get project details
      const project = await getProject(inputs.project_id);
      if (!project) {
        throw new Error(`Project ${inputs.project_id} not found`);
      }

      // Ensure workspace exists
      const workspacePath = await workspaceManager.ensureWorkspace(project);

      // Create git instance
      const git: SimpleGit = simpleGit(workspacePath);

      // Execute operation based on git_mode
      const gitMode = project.git_mode || 'hidden';
      let result: any = {};

      switch (gitMode) {
        case 'hidden':
          result = await executeHiddenMode(git, inputs, project);
          break;

        case 'basic':
          result = await executeBasicMode(git, inputs, project);
          break;

        case 'advanced':
          result = await executeAdvancedMode(git, inputs, project);
          break;
      }

      const outputs = {
        operation: inputs.operation,
        git_mode: gitMode,
        workspace: workspacePath,
        ...result
      };

      await store.updateStep(stepId, {
        status: 'succeeded',
        ended_at: new Date().toISOString(),
        outputs
      });
      await recordEvent(runId, 'step.finished', { outputs }, stepId);

    } catch (error) {
      const outputs = {
        error: error instanceof Error ? error.message : 'Unknown error',
        operation: (step.inputs as any)?.operation,
        project_id: (step.inputs as any)?.project_id
      };

      await store.updateStep(stepId, {
        status: 'failed',
        ended_at: new Date().toISOString(),
        outputs
      });
      await recordEvent(runId, 'step.failed', { outputs, error: outputs.error }, stepId);
    }
  }
};

/**
 * Execute operations in hidden mode (no git terminology)
 */
async function executeHiddenMode(git: SimpleGit, inputs: GitOpsInputs, project: any): Promise<any> {
  switch (inputs.operation) {
    case 'save':
    case 'commit': {
      // Auto-save with friendly message
      const status = await git.status();
      if (status.isClean()) {
        return { message: 'No changes to save' };
      }

      await git.add('.');
      const timestamp = new Date().toLocaleString();
      const message = `Saved progress for ${project.name} - ${timestamp}`;
      const commit = await git.commit(message);

      return {
        message: 'Progress saved successfully',
        saved: true
      };
    }

    case 'sync': {
      // Simple sync without git details
      try {
        await git.pull();
        return { message: 'Project updated to latest version' };
      } catch {
        return { message: 'Project is up to date' };
      }
    }

    case 'revert': {
      // Simple revert to previous state
      const stepsBack = inputs.steps_back || 1;
      await git.reset(['--hard', `HEAD~${stepsBack}`]);
      return { message: 'Restored previous version' };
    }

    case 'status': {
      // Simplified status
      const status = await git.status();
      return {
        hasChanges: !status.isClean(),
        filesChanged: status.files.length,
        message: status.isClean() ? 'No unsaved changes' : `${status.files.length} file(s) modified`
      };
    }

    default:
      throw new Error(`Operation ${inputs.operation} not available in hidden mode`);
  }
}

/**
 * Execute operations in basic mode (gentle git exposure)
 */
async function executeBasicMode(git: SimpleGit, inputs: GitOpsInputs, project: any): Promise<any> {
  switch (inputs.operation) {
    case 'save':
    case 'commit': {
      const status = await git.status();
      if (status.isClean()) {
        return { message: 'No changes to commit', committed: false };
      }

      await git.add('.');
      const message = inputs.message || `Save progress: ${new Date().toLocaleString()}`;
      const commit = await git.commit(message);

      const log = await git.log(['-1']);
      return {
        message: `Saved: ${message}`,
        committed: true,
        version: log.latest?.hash.substring(0, 7),
        branch: status.current
      };
    }

    case 'branch': {
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

    case 'sync':
    case 'pull': {
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

    case 'push': {
      await git.push();
      return { message: 'Changes uploaded to remote' };
    }

    case 'revert': {
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

    case 'status': {
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

    default:
      // Allow advanced operations in basic mode with warning
      log.warn({ operation: inputs.operation }, 'Advanced operation used in basic mode');
      return executeAdvancedMode(git, inputs, project);
  }
}

/**
 * Execute operations in advanced mode (full git access)
 */
async function executeAdvancedMode(git: SimpleGit, inputs: GitOpsInputs, project: any): Promise<any> {
  switch (inputs.operation) {
    case 'commit': {
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

    case 'push': {
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

    case 'pull': {
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

    case 'checkout': {
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

    case 'merge': {
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

    case 'status': {
      const status = await git.status();
      return status; // Return full git status object
    }

    default:
      throw new Error(`Unknown operation: ${inputs.operation}`);
  }
}

export default handler;