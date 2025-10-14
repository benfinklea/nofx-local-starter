import simpleGit, { SimpleGit } from 'simple-git';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { Project, updateProject } from './projects';
import { log } from './logger';

export class WorkspaceManager {
  private git: SimpleGit | null = null;

  /**
   * Get the base workspace root directory
   */
  private getWorkspaceRoot(): string {
    return process.env.WORKSPACE_ROOT || path.join(process.cwd(), 'local_data', 'workspaces');
  }

  /**
   * Get the workspace path for a project
   */
  public getWorkspacePath(project: Project): string {
    if (project.workspace_mode === 'local_path' && project.local_path) {
      return project.local_path;
    }
    // For clone/worktree modes, use sandboxed workspace
    return path.join(this.getWorkspaceRoot(), project.id);
  }

  /**
   * Ensure workspace directory exists
   */
  private async ensureWorkspaceDir(workspacePath: string): Promise<void> {
    await fsp.mkdir(workspacePath, { recursive: true });
  }

  /**
   * Check if a directory is a git repository
   */
  private async isGitRepo(dirPath: string): Promise<boolean> {
    try {
      const gitDir = path.join(dirPath, '.git');
      const stats = await fsp.stat(gitDir);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Initialize or ensure workspace for a project
   */
  public async ensureWorkspace(project: Project): Promise<string> {
    const workspacePath = this.getWorkspacePath(project);

    // For local_path mode, just return the path
    if (project.workspace_mode === 'local_path') {
      return workspacePath;
    }

    // Ensure workspace directory exists
    await this.ensureWorkspaceDir(workspacePath);

    // Check if already initialized
    if (project.initialized) {
      const isRepo = await this.isGitRepo(workspacePath);
      if (isRepo) {
        // Sync if it's a cloned repo
        if (project.repo_url) {
          await this.syncWorkspace(project);
        }
        return workspacePath;
      }
    }

    // Initialize based on whether we have a repo_url
    if (project.repo_url) {
      await this.cloneRepo(project);
    } else {
      await this.initializeRepo(project);
    }

    // Mark as initialized
    await updateProject(project.id, { initialized: true });

    return workspacePath;
  }

  /**
   * Initialize a new git repository for a project
   */
  public async initializeRepo(project: Project): Promise<void> {
    const workspacePath = this.getWorkspacePath(project);
    await this.ensureWorkspaceDir(workspacePath);

    log.info({ projectId: project.id, path: workspacePath }, 'Initializing new git repository');

    this.git = simpleGit(workspacePath);

    // Check if directory has any files before git init
    const filesBeforeInit = await fsp.readdir(workspacePath);
    const shouldCreateReadme = filesBeforeInit.length === 0;

    // Initialize repository
    await this.git.init();

    // Create initial files if directory was empty
    if (shouldCreateReadme) {
      // Create a simple README
      const readmePath = path.join(workspacePath, 'README.md');
      await fsp.writeFile(readmePath, `# ${project.name}\n\nThis project was created with NOFX Control Plane.\n`);
    }

    // Initial commit
    await this.git.add('.');

    // Configure git identity if not set
    try {
      await this.git.raw(['config', 'user.email']);
    } catch {
      await this.git.addConfig('user.email', 'nofx@example.com');
      await this.git.addConfig('user.name', 'NOFX System');
    }

    const message = this.generateCommitMessage(project, 'Initial project setup');
    await this.git.commit(message);

    // Set default branch name
    if (project.default_branch && project.default_branch !== 'main') {
      await this.git.branch(['-M', project.default_branch]);
    }
  }

  /**
   * Clone a repository for a project
   */
  public async cloneRepo(project: Project): Promise<void> {
    if (!project.repo_url) {
      throw new Error('Cannot clone repository: repo_url is required but not provided. Specify the repository URL in the workspace configuration.');
    }

    const workspacePath = this.getWorkspacePath(project);
    const parentDir = path.dirname(workspacePath);

    await this.ensureWorkspaceDir(parentDir);

    log.info({ projectId: project.id, repo: project.repo_url, path: workspacePath }, 'Cloning repository');

    // Prepare git instance for parent directory
    this.git = simpleGit(parentDir);

    // Add authentication if available
    const authUrl = this.addAuthToUrl(project.repo_url);

    // Clone with options
    const cloneOptions = ['--depth', '1']; // Shallow clone by default
    if (project.default_branch) {
      cloneOptions.push('--branch', project.default_branch);
    }

    await this.git.clone(authUrl, project.id, cloneOptions);

    // Update git instance to cloned directory
    this.git = simpleGit(workspacePath);
  }

  /**
   * Sync workspace with remote (pull latest changes)
   */
  public async syncWorkspace(project: Project): Promise<void> {
    const workspacePath = this.getWorkspacePath(project);

    if (!await this.isGitRepo(workspacePath)) {
      log.warn({ projectId: project.id }, 'Cannot sync - not a git repository');
      return;
    }

    log.info({ projectId: project.id }, 'Syncing workspace with remote');

    this.git = simpleGit(workspacePath);

    // Stash any uncommitted changes
    const status = await this.git.status();
    if (!status.isClean()) {
      await this.git.stash();
    }

    // Pull latest changes
    try {
      await this.git.pull();
    } catch (error) {
      log.warn({ projectId: project.id, error }, 'Pull failed, workspace may be ahead of remote');
    }

    // Pop stash if we stashed
    if (!status.isClean()) {
      try {
        await this.git.stash(['pop']);
      } catch {
        log.warn({ projectId: project.id }, 'Stash pop failed, manual intervention may be needed');
      }
    }
  }

  /**
   * Auto-commit changes in a project workspace
   */
  public async autoCommit(project: Project, message?: string): Promise<string> {
    const workspacePath = this.getWorkspacePath(project);

    if (!await this.isGitRepo(workspacePath)) {
      log.warn({ projectId: project.id }, 'Cannot commit - not a git repository');
      return '';
    }

    this.git = simpleGit(workspacePath);

    // Check if there are changes to commit
    const status = await this.git.status();
    if (status.isClean()) {
      log.info({ projectId: project.id }, 'No changes to commit');
      return '';
    }

    // Stage all changes
    await this.git.add('.');

    // Generate commit message based on git_mode
    const commitMessage = message || this.generateCommitMessage(project, 'Save progress');

    // Commit
    const commit = await this.git.commit(commitMessage);

    log.info({ projectId: project.id, commit: commit.commit }, 'Auto-committed changes');

    return commit.commit;
  }

  /**
   * Generate appropriate commit message based on project git_mode
   */
  private generateCommitMessage(project: Project, defaultMessage: string): string {
    const timestamp = new Date().toLocaleString();

    switch (project.git_mode) {
      case 'hidden':
        // Business-friendly message, no technical jargon
        return `Updated ${project.name} - ${timestamp}`;

      case 'basic':
        // Simple technical message
        return defaultMessage || `Update: ${timestamp}`;

      case 'advanced':
      default:
        // Standard git message format
        return defaultMessage || `chore: auto-save at ${timestamp}`;
    }
  }

  /**
   * Add authentication to git URL if available
   */
  private addAuthToUrl(url: string): string {
    const token = process.env.GITHUB_TOKEN || process.env.GIT_TOKEN;

    if (!token) {
      return url;
    }

    // Only add auth to HTTPS URLs
    if (url.startsWith('https://')) {
      return url.replace('https://', `https://${token}@`);
    }

    return url;
  }

  /**
   * Get git status for a project
   */
  public async getStatus(project: Project): Promise<any> {
    const workspacePath = this.getWorkspacePath(project);

    if (!await this.isGitRepo(workspacePath)) {
      return null;
    }

    this.git = simpleGit(workspacePath);
    const status = await this.git.status();

    // Format based on git_mode
    if (project.git_mode === 'hidden') {
      // Simplified status
      return {
        hasChanges: !status.isClean(),
        filesChanged: status.files.length
      };
    } else if (project.git_mode === 'basic') {
      // Basic status info
      return {
        branch: status.current,
        hasChanges: !status.isClean(),
        ahead: status.ahead,
        behind: status.behind,
        files: status.files.map(f => f.path)
      };
    } else {
      // Full status for advanced mode
      return status;
    }
  }

  /**
   * Clean up workspace for a project
   */
  public async cleanupWorkspace(project: Project): Promise<void> {
    if (project.workspace_mode === 'local_path') {
      // Don't delete local paths
      return;
    }

    const workspacePath = this.getWorkspacePath(project);

    try {
      await fsp.rm(workspacePath, { recursive: true, force: true });
      log.info({ projectId: project.id, path: workspacePath }, 'Cleaned up workspace');
    } catch (error) {
      log.error({ projectId: project.id, error }, 'Failed to cleanup workspace');
    }
  }
}

// Export singleton instance
export const workspaceManager = new WorkspaceManager();