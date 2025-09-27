/**
 * Workspace Management Service - extracted from git_ops.ts
 * Handles project and workspace management
 */

import { getProject } from '../../../lib/projects';
import { workspaceManager } from '../../../lib/workspaces';
import simpleGit, { SimpleGit } from 'simple-git';

export class WorkspaceManagementService {
  /**
   * Setup workspace and git instance for project
   */
  async setupWorkspace(projectId: string): Promise<{ project: any; git: SimpleGit; workspacePath: string }> {
    // Get project details
    const project = await getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Ensure workspace exists
    const workspacePath = await workspaceManager.ensureWorkspace(project);

    // Create git instance
    const git: SimpleGit = simpleGit(workspacePath);

    return { project, git, workspacePath };
  }
}